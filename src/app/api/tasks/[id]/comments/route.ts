import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getErpNextClient } from '@/lib/erpnext/client'
import { allowedDoctype, doctypeFor } from '@/lib/erpnext/doctypes'

/** Stored task → its ERP doc; unsaved docs (Sprint Archive, Product Backlog) pass ?doctype= and id = doc name. */
async function target(req: NextRequest, id: string) {
  const doctype = allowedDoctype(req.nextUrl.searchParams.get('doctype'))
  if (doctype) return { doctype, docname: id }
  const task = await prisma.task.findUnique({ where: { id } })
  return task?.externalId ? { doctype: doctypeFor(task.externalId), docname: task.externalId } : null
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const doc = await target(req, (await ctx.params).id)
  const client = getErpNextClient(await prisma.settings.findFirst())
  if (!doc || !client) return NextResponse.json({ comments: [] })
  return NextResponse.json({ comments: await client.fetchComments(doc.doctype, doc.docname) })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const doc = await target(req, (await ctx.params).id)
  if (!doc) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  const client = getErpNextClient(await prisma.settings.findFirst())
  if (!client) return NextResponse.json({ error: 'ERP not configured' }, { status: 503 })

  const result = await client.addComment(doc.doctype, doc.docname, content.trim())
  return NextResponse.json(result, { status: result.ok ? 201 : 502 })
}
