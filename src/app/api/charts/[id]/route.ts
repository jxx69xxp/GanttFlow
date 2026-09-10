import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { toGanttBoard } from '@/lib/charts/mapChart'
import type { ViewMode } from '@/lib/types'

const VIEWS: ViewMode[] = ['Day', 'Week', 'Month', 'Year']

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const chart = await prisma.chart.findUnique({
    where: { id },
    include: { _count: { select: { tasks: true } } },
  })
  if (!chart) return NextResponse.json({ error: 'Chart not found' }, { status: 404 })
  return NextResponse.json({ chart: toGanttBoard(chart) })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json()
  const data: {
    name?: string
    startDate?: Date
    endDate?: Date
    viewMode?: string
  } = {}

  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (body.startDate) data.startDate = new Date(body.startDate)
  if (body.endDate) data.endDate = new Date(body.endDate)
  if (VIEWS.includes(body.viewMode)) data.viewMode = body.viewMode

  const chart = await prisma.chart.update({
    where: { id },
    data,
    include: { _count: { select: { tasks: true } } },
  })
  return NextResponse.json({ chart: toGanttBoard(chart) })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await prisma.chart.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
