import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sprint    = searchParams.get('sprint')
  const assignee  = searchParams.get('assignee')
  const status    = searchParams.get('status')
  const from      = searchParams.get('from')
  const to        = searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (sprint)   where.sprintName   = sprint
  if (assignee) where.assigneeEmail = assignee
  if (status)   where.status        = status
  if (from || to) {
    where.startDate = {}
    if (from) (where.startDate as Record<string,unknown>).gte = new Date(from)
    if (to)   (where.startDate as Record<string,unknown>).lte = new Date(to)
  }

  const [tasks, sprints, lastSync] = await Promise.all([
    prisma.task.findMany({ where, orderBy: { startDate: 'asc' } }),
    prisma.sprint.findMany({ orderBy: { startDate: 'asc' } }),
    prisma.syncLog.findFirst({ orderBy: { ranAt: 'desc' } }),
  ])

  return NextResponse.json({ tasks, sprints, lastSyncedAt: lastSync?.ranAt ?? null })
}
