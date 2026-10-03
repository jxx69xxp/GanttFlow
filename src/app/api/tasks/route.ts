import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/encryption'
import { SprintKickoffClient } from '@/lib/sprint-kickoff/client'
import { toGanttTask } from '@/lib/tasks/mapTask'
import { getErpNextClient } from '@/lib/erpnext/client'
import { ERP_STATUS_FOR, taskStatusFromErp } from '@/lib/erpnext/transformers'
import { packTaskMeta } from '@/lib/tasks/meta'
import type { TaskStatus } from '@/lib/types'
import { importBacklogsForSprint } from '@/lib/frappe/persistSprint'
import { toSprintDocId, sprintsFromBacklogs } from '@/lib/frappe/sprint'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sprint   = searchParams.get('sprint')
  const sprintId = searchParams.get('sprintId')
  const assignee = searchParams.get('assignee')
  const status   = searchParams.get('status')
  const chartId  = searchParams.get('chart')
  const forceSync = searchParams.get('sync') === '1'

  const where: Record<string, unknown> = {}
  if (assignee) where.assigneeEmail = assignee
  if (status)   where.status        = status

  // sprintId is the real Frappe Sprint name (may contain spaces, e.g. "CORE - SPRINT 3") — use as-is.
  // Only the legacy `sprint` display-name param gets underscore-normalised.
  const sprintDocId = sprintId?.trim() || toSprintDocId(sprint)
  if (sprintDocId) {
    where.sprintId = sprintDocId
  } else if (chartId) {
    where.chartId = chartId
  }

  if (sprintDocId) {
    try {
      await importBacklogsForSprint(sprintDocId, chartId, { force: forceSync })
    } catch (e) {
      console.error('Sprint Backlogs import failed:', e)
    }
  }

  const [tasks, lastSync] = await Promise.all([
    prisma.task.findMany({ where, orderBy: { startDate: 'asc' } }),
    prisma.syncLog.findFirst({ orderBy: { ranAt: 'desc' } }),
  ])

  // Pass sprint bounds so undated tasks span the sprint instead of collapsing to a point
  const sprintRecord = sprintDocId
    ? await prisma.sprint.findFirst({ where: { externalId: sprintDocId } })
    : null
  const sprintStartDate = sprintRecord?.startDate instanceof Date
    ? sprintRecord.startDate.toISOString().slice(0, 10)
    : null
  const sprintEndDate = sprintRecord?.endDate instanceof Date
    ? sprintRecord.endDate.toISOString().slice(0, 10)
    : null

  return NextResponse.json({
    tasks: tasks.map(t => toGanttTask({ ...t, sprintStartDate, sprintEndDate })),
    sprints: sprintsFromBacklogs(tasks),
    lastSyncedAt: new Date().toISOString(),
    live: true,
    lastSyncLogAt: lastSync?.ranAt ?? null,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const title = String(body.title ?? '').trim()
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const startDate = body.startDate ? new Date(body.startDate) : new Date()
  const endDate = body.endDate ? new Date(body.endDate) : startDate
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const erpStatusIn     = str(body.erpStatus)        // raw ERP value from the dialog ("Open", "Working"…)
  const priority        = str(body.priority)
  const currentAssignee = str(body.currentAssignee) ?? str(body.assigneeEmail)
  const devAssignee     = str(body.devAssignee)
  const pts = Number(body.sprintPoints)
  const sprintPoints = body.sprintPoints !== undefined && body.sprintPoints !== '' && Number.isFinite(pts) && pts >= 0 ? pts : undefined
  const status = erpStatusIn
    ? taskStatusFromErp(erpStatusIn)
    : body.status === 'Completed' ? 'Completed' : (body.status || 'Not Started')
  const progress = status === 'Completed' ? 100 : Number(body.progress ?? 0)

  let externalId = typeof body.externalId === 'string' && body.externalId.trim()
    ? body.externalId.trim()
    : `local-${crypto.randomUUID()}`
  let source = body.source === 'sprint_kickoff'
    ? 'sprint_kickoff'
    : body.source === 'erpnext'
      ? 'erpnext'
      : 'manual'

  if (source === 'sprint_kickoff') {
    try {
      const settings = await prisma.settings.findFirst()
      if (settings?.sprintKickoffUrl && settings.sprintKickoffApiKey && settings.sprintKickoffApiSecret) {
        const client = new SprintKickoffClient({
          baseUrl: settings.sprintKickoffUrl,
          apiKey: decrypt(settings.sprintKickoffApiKey),
          apiSecret: decrypt(settings.sprintKickoffApiSecret),
        })
        const created = await client.createTask({
          title,
          start_date: startDate.toISOString().slice(0, 10),
          due_date: endDate.toISOString().slice(0, 10),
          status,
          description: body.description,
          sprint_id: body.sprintId,
        })
        if (created.id) externalId = created.id
      }
    } catch (e) {
      console.error('Sprint Kickoff create failed, saving locally:', e)
      source = 'manual'
    }
  }

  // New rows in a real ERP sprint become Sprint Backlogs in Frappe; ERP failure is returned, never a silent local-only copy
  const sprintDocId = typeof body.sprintId === 'string' ? body.sprintId.trim() : ''
  let erpStatus: string | undefined
  const erp = source === 'erpnext' && !body.externalId && sprintDocId && !sprintDocId.startsWith('local-')
    ? getErpNextClient(await prisma.settings.findFirst())
    : null
  if (source === 'erpnext' && !body.externalId && !erp) source = 'manual'  // local sprint / no ERP → local row
  if (erp) {
    erpStatus = erpStatusIn ?? ERP_STATUS_FOR[status as TaskStatus] ?? 'Open'
    try {
      externalId = await erp.createSprintBacklog({
        subject: title,
        exp_start_date: startDate.toISOString().slice(0, 10),
        exp_end_date: endDate.toISOString().slice(0, 10),
        status: erpStatus,
        sprint_assign: sprintDocId,
        priority,
        current_assignee: currentAssignee,
        dev_assignee: devAssignee,
        sprint_points: sprintPoints,
        description: str(body.description),
      })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Sprint Backlog create failed' }, { status: 502 })
    }
  }
  const description = packTaskMeta(str(body.description) ?? null, { erpStatus, priority, currentAssignee, devAssignee, sprintPoints: sprintPoints?.toString() })

  const task = await prisma.task.create({
    data: {
      externalId,
      source,
      title,
      description,
      assigneeEmail: currentAssignee || devAssignee || null,
      status,
      progress,
      startDate,
      endDate,
      sprintName: body.sprintName || null,
      sprintId: typeof body.sprintId === 'string' ? body.sprintId.trim() || null : null,
      chartId: body.chartId || null,
      isOverdue: status === 'Overdue',
    },
  })

  return NextResponse.json({ task: toGanttTask(task) }, { status: 201 })
}
