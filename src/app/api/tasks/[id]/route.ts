import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/encryption'
import { getErpNextClient } from '@/lib/erpnext/client'
import { SprintKickoffClient } from '@/lib/sprint-kickoff/client'
import { toGanttTask } from '@/lib/tasks/mapTask'
import { packTaskMeta, unpackTaskMeta } from '@/lib/tasks/meta'
import { ERP_STATUS_FOR, taskStatusFromErp } from '@/lib/erpnext/transformers'
import type { TaskStatus } from '@/lib/types'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined)

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json()
  const { startDate, endDate, progress, sprintId } = body
  const priority        = str(body.priority)
  const currentAssignee = str(body.currentAssignee)
  const devAssignee     = str(body.devAssignee)
  // erpStatus = raw ERP value from the dropdown ("Pending Review"); status = Gantt status ("Completed")
  const erpStatus  = str(body.erpStatus) || (body.status ? ERP_STATUS_FOR[body.status as TaskStatus] : undefined)
  const nextStatus = str(body.erpStatus) ? taskStatusFromErp(erpStatus!) : (body.status || undefined)
  const nextProgress = nextStatus === 'Completed'
    ? 100
    : progress !== undefined
      ? Number(progress)
      : undefined

  // priority / assignees live in the packed meta header of `description`
  let metaData: { description?: string; assigneeEmail?: string | null } = {}
  if (priority !== undefined || currentAssignee !== undefined || devAssignee !== undefined || erpStatus) {
    const existing = await prisma.task.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    const { description, meta } = unpackTaskMeta(existing.description)
    const cur = currentAssignee ?? meta.currentAssignee ?? existing.assigneeEmail
    const dev = devAssignee ?? meta.devAssignee
    metaData = {
      description: packTaskMeta(description, {
        ...meta,
        ...(priority !== undefined && { priority }),
        ...(erpStatus && existing.source === 'erpnext' && { erpStatus }),
        currentAssignee: cur,
        devAssignee: dev,
      }),
      assigneeEmail: cur || dev || null,  // same precedence as transformSprintBacklog
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate   && { endDate:   new Date(endDate)   }),
      ...(nextProgress !== undefined && { progress: nextProgress }),
      ...(nextStatus && { status: nextStatus }),
      ...(nextStatus === 'Completed' && { isOverdue: false }),
      ...(sprintId !== undefined && { sprintId: sprintId || null }),
      ...metaData,
    },
  })

  const settings = await prisma.settings.findFirst()

  let erpnextSync = false
  const erp = task.source === 'erpnext' ? getErpNextClient(settings) : null
  if (erp) {
    const isBacklog = task.externalId.startsWith('SPB-')
    try {
      await erp.patchTask(task.externalId, {
        ...(startDate && { exp_start_date: startDate }),
        ...(endDate   && { exp_end_date:   endDate   }),
        ...(nextProgress !== undefined && { progress: nextProgress }),
        ...(erpStatus && { status: erpStatus }),
        ...(sprintId !== undefined && { sprint_assign: sprintId || '' }),
        ...(priority !== undefined && { priority }),
        // assignee fields only exist on the Sprint Backlogs doctype
        ...(isBacklog && currentAssignee !== undefined && { current_assignee: currentAssignee }),
        ...(isBacklog && devAssignee !== undefined && { dev_assignee: devAssignee }),
      })
      erpnextSync = true
    } catch (e) {
      console.error('ERPNext write-back failed:', e)
    }
  }

  let sprintKickoffSync = false
  if (task.source === 'sprint_kickoff' && settings?.sprintKickoffUrl && settings.sprintKickoffApiKey && settings.sprintKickoffApiSecret) {
    try {
      const client = new SprintKickoffClient({
        baseUrl: settings.sprintKickoffUrl,
        apiKey: decrypt(settings.sprintKickoffApiKey),
        apiSecret: decrypt(settings.sprintKickoffApiSecret),
      })
      await client.patchTask(task.externalId, {
        ...(startDate && { start_date: startDate }),
        ...(endDate && { due_date: endDate }),
        ...(nextProgress !== undefined && { progress: nextProgress }),
        ...(nextStatus && { status: nextStatus }),
      })
      sprintKickoffSync = true
    } catch (e) {
      console.error('Sprint Kickoff write-back failed:', e)
    }
  }

  return NextResponse.json({ task: toGanttTask(task), erpnextSync, sprintKickoffSync })
}
