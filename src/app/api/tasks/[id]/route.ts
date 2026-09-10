import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/encryption'
import { ErpNextClient } from '@/lib/erpnext/client'
import { SprintKickoffClient } from '@/lib/sprint-kickoff/client'
import { toGanttTask } from '@/lib/tasks/mapTask'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json()
  const { startDate, endDate, progress, status } = body

  const nextStatus = status || undefined
  const nextProgress = nextStatus === 'Completed'
    ? 100
    : progress !== undefined
      ? Number(progress)
      : undefined

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate   && { endDate:   new Date(endDate)   }),
      ...(nextProgress !== undefined && { progress: nextProgress }),
      ...(nextStatus && { status: nextStatus }),
      ...(nextStatus === 'Completed' && { isOverdue: false }),
    },
  })

  const settings = await prisma.settings.findFirst()

  let erpnextSync = false
  if (task.source === 'erpnext' && settings?.erpnextBaseUrl && settings.erpnextApiKey && settings.erpnextApiSecret) {
    try {
      const client = new ErpNextClient({
        baseUrl: settings.erpnextBaseUrl,
        apiKey: decrypt(settings.erpnextApiKey),
        apiSecret: decrypt(settings.erpnextApiSecret),
      })
      await client.patchTask(task.externalId, {
        ...(startDate && { exp_start_date: startDate }),
        ...(endDate   && { exp_end_date:   endDate   }),
        ...(nextProgress !== undefined && { progress: nextProgress }),
        ...(nextStatus && { status: nextStatus }),
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
