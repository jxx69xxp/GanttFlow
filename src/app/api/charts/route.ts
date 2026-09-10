import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { toGanttBoard } from '@/lib/charts/mapChart'
import { FOCUSED_SPRINT_NAME } from '@/lib/frappe/sprint'
import type { ViewMode } from '@/lib/types'

async function ensureCoreDevelopmentChart() {
  const startDate = new Date('2026-09-07')
  const endDate = new Date('2026-09-18')
  let chart = await prisma.chart.findFirst({ where: { name: FOCUSED_SPRINT_NAME } })
  if (!chart) {
    chart = await prisma.chart.create({
      data: { name: FOCUSED_SPRINT_NAME, startDate, endDate, viewMode: 'Week' },
    })
  }

  await prisma.sprint.upsert({
    where: { externalId: 'CORE_DEVELOPMENT_-_1' },
    create: {
      externalId: 'CORE_DEVELOPMENT_-_1',
      name: FOCUSED_SPRINT_NAME,
      startDate,
      endDate,
      status: 'Active',
    },
    update: { name: FOCUSED_SPRINT_NAME, startDate, endDate },
  })
}

const VIEWS: ViewMode[] = ['Day', 'Week', 'Month', 'Year']

export async function GET() {
  await ensureCoreDevelopmentChart()
  const existing = await prisma.chart.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { tasks: true } } },
  })

  if (existing.length === 0) {
    const orphans = await prisma.task.findMany({
      where: { chartId: null, source: { in: ['manual', 'local'] } },
      orderBy: { startDate: 'asc' },
    })
    if (orphans.length > 0) {
      const starts = orphans.map(t => t.startDate).filter(Boolean) as Date[]
      const ends = orphans.map(t => t.endDate).filter(Boolean) as Date[]
      const startDate = starts[0] ?? new Date()
      const endDate = ends[ends.length - 1] ?? startDate
      const chart = await prisma.chart.create({
        data: {
          name: 'My first chart',
          startDate,
          endDate,
          viewMode: 'Week',
        },
      })
      await prisma.task.updateMany({
        where: { id: { in: orphans.map(t => t.id) } },
        data: { chartId: chart.id },
      })
      const created = await prisma.chart.findUnique({
        where: { id: chart.id },
        include: { _count: { select: { tasks: true } } },
      })
      return NextResponse.json({ charts: created ? [toGanttBoard(created)] : [] })
    }
  }

  return NextResponse.json({ charts: existing.map(toGanttBoard) })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = String(body.name ?? '').trim() || 'Untitled chart'
  const startDate = body.startDate ? new Date(body.startDate) : new Date()
  const endDate = body.endDate ? new Date(body.endDate) : startDate
  const viewMode = VIEWS.includes(body.viewMode) ? body.viewMode : 'Week'

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return NextResponse.json({ error: 'Set a valid From and To date' }, { status: 400 })
  }

  const chart = await prisma.chart.create({
    data: { name, startDate, endDate, viewMode },
    include: { _count: { select: { tasks: true } } },
  })

  return NextResponse.json({ chart: toGanttBoard(chart) }, { status: 201 })
}
