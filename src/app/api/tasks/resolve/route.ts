import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getErpNextClient } from '@/lib/erpnext/client'
import { transformSprintBacklog } from '@/lib/erpnext/transformers'
import { allowedDoctype } from '@/lib/erpnext/doctypes'
import { importBacklogsForSprint } from '@/lib/frappe/persistSprint'
import { toGanttTask } from '@/lib/tasks/mapTask'

// GET ?externalId=SPB-…&doctype=… → the local task, importing its sprint from ERP first if it isn't loaded yet.
// Docs that live outside a sprint (Sprint Archive, Product Backlog) come back unsaved and read-only.
export async function GET(req: NextRequest) {
  const externalId = req.nextUrl.searchParams.get('externalId')?.trim()
  if (!externalId) return NextResponse.json({ error: 'externalId required' }, { status: 400 })
  const doctype = allowedDoctype(req.nextUrl.searchParams.get('doctype')) ?? 'Sprint Backlogs'

  const find = () => prisma.task.findUnique({ where: { externalId } })
  let task = await find()
  if (task) return NextResponse.json({ task: toGanttTask(task) })

  const client = getErpNextClient(await prisma.settings.findFirst())
  if (!client) return NextResponse.json({ error: 'ERP not configured' }, { status: 503 })
  // falls back to Sprint Backlogs, so a doc that moved since the notification still opens
  const doc = await client.fetchSprintBacklogDoc(doctype, externalId)
  if (!doc) return NextResponse.json({ error: `${externalId} wasn't found in ERP` }, { status: 404 })

  const actual = doc.doctype ?? doctype
  if (actual === 'Sprint Backlogs' && doc.sprint_assign) {
    await importBacklogsForSprint(doc.sprint_assign, null, { force: true })
    task = await find()
    if (task) return NextResponse.json({ task: toGanttTask(task) })
  }
  // archive / product backlog / parent backlog: show it, but don't store it in any sprint
  return NextResponse.json({ task: { ...transformSprintBacklog(doc), erpDoctype: actual } })
}
