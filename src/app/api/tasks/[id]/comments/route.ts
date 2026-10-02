import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getErpNextClient } from '@/lib/erpnext/client'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ comments: [] })

  const settings = await prisma.settings.findFirst()
  const client = getErpNextClient(settings)
  if (!client || !task.externalId) return NextResponse.json({ comments: [] })

  const doctype = task.externalId.startsWith('SPB-') ? 'Sprint Backlogs' : 'Task'
  const comments = await client.fetchComments(doctype, task.externalId)
  return NextResponse.json({ comments })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const settings = await prisma.settings.findFirst()
  const client = getErpNextClient(settings)
  if (!client || !task.externalId) {
    return NextResponse.json({ error: 'ERP not configured' }, { status: 503 })
  }

  const doctype = task.externalId.startsWith('SPB-') ? 'Sprint Backlogs' : 'Task'
  const result = await client.addComment(doctype, task.externalId, content.trim())
  return NextResponse.json(result, { status: result.ok ? 201 : 502 })
}
