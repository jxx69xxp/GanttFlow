import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/encryption'
import { SprintKickoffClient } from '@/lib/sprint-kickoff/client'
import { toGanttTask } from '@/lib/tasks/mapTask'
import { importBacklogsForSprint } from '@/lib/frappe/persistSprint'
import { toSprintDocId, sprintsFromBacklogs } from '@/lib/frappe/sprint'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sprint   = searchParams.get('sprint')
  const sprintId = searchParams.get('sprintId')
  const assignee = searchParams.get('assignee')
  const status   = searchParams.get('status')
  const chartId  = searchParams.get('chart')

  const where: Record<string, unknown> = {}
  if (assignee) where.assigneeEmail = assignee
  if (status)   where.status        = status

  const sprintDocId = toSprintDocId(sprintId || sprint)
  if (sprintDocId) {
    where.sprintId = sprintDocId
  } else if (chartId) {
    where.chartId = chartId
  }

  if (sprintDocId) {
    try {
      await importBacklogsForSprint(sprintDocId, chartId)
    } catch (e) {
      console.error('Sprint Backlogs import failed:', e)
    }
  }

  const [tasks, lastSync] = await Promise.all([
    prisma.task.findMany({ where, orderBy: { startDate: 'asc' } }),
    prisma.syncLog.findFirst({ orderBy: { ranAt: 'desc' } }),
  ])

  return NextResponse.json({
    tasks: tasks.map(toGanttTask),
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
  const status = body.status === 'Completed' ? 'Completed' : (body.status || 'Not Started')
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

  const task = await prisma.task.create({
    data: {
      externalId,
      source,
      title,
      description: body.description || null,
      assigneeEmail: body.assigneeEmail || null,
      status,
      progress,
      startDate,
      endDate,
      sprintName: body.sprintName || null,
      sprintId: toSprintDocId(body.sprintId) || null,
      chartId: body.chartId || null,
      isOverdue: status === 'Overdue',
    },
  })

  return NextResponse.json({ task: toGanttTask(task) }, { status: 201 })
}
