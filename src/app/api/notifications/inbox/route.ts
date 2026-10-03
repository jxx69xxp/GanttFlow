import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getErpNextClient } from '@/lib/erpnext/client'
import { getSession } from '@/lib/session'
import { toGanttTask } from '@/lib/tasks/mapTask'

const PAGE_SIZE = 20
const READ_FILTER = { all: undefined, unread: 0, read: 1 } as const

// "Me" = the signed-in member. Their Frappe Notification Log is read with the shared API key —
// that key's ERP user must be Administrator (Frappe only shows non-admins their own notifications).
// ?filter=all|unread|read&page=1  → one page of the Frappe feed + totals for the pager and badge.
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const client = getErpNextClient(await prisma.settings.findFirst())
  if (!client) return NextResponse.json({ error: 'ERP not configured' }, { status: 503 })
  const me = session.email
  const forUser = session.email      // Frappe keys Notification Log by user, which is the email

  const filterParam = req.nextUrl.searchParams.get('filter') ?? 'all'
  const filter = (filterParam in READ_FILTER ? filterParam : 'all') as keyof typeof READ_FILTER
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1)
  const read = READ_FILTER[filter]

  const [logs, total, unread, rows] = await Promise.all([
    client.fetchNotificationLogs(forUser, { start: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, read })
      .catch(e => { console.error(e); return null }),  // null = ERP session expired/refused
    client.countNotificationLogs(forUser, read),
    client.countNotificationLogs(forUser, 0),
    prisma.task.findMany({ where: { source: 'erpnext' } }),
  ])
  if (logs === null) {
    return NextResponse.json({ error: 'Couldn’t read notifications from ERP. Check the API key in Settings belongs to an ERP Administrator.' }, { status: 502 })
  }
  const tasks = rows.map(r => toGanttTask(r))
  const byExternal = new Map(tasks.map(t => [t.externalId, t]))
  const lower = me.toLowerCase()
  const isMine = (v?: string | null) => v?.toLowerCase() === lower

  const assigned = tasks
    .filter(t => t.status !== 'Completed' && (isMine(t.currentAssignee) || isMine(t.devAssignee) || isMine(t.assigneeEmail)))
    .sort((a, b) => (b.dateAssigned || b.start).localeCompare(a.dateAssigned || a.start))

  return NextResponse.json({
    me,
    filter,
    page,
    pageSize: PAGE_SIZE,
    total,
    unread,
    feed: logs.map(l => {
      const task = l.document_name ? byExternal.get(l.document_name) : undefined
      return { ...l, task: task ?? null }  // full task so the page can open the drawer in place
    }),
    assigned,
  })
}

// Toggle one Frappe Notification Log entry read/unread.
export async function POST(req: NextRequest) {
  const { name, read = true } = await req.json().catch(() => ({}))
  if (typeof name !== 'string' || !name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const client = getErpNextClient(await prisma.settings.findFirst())
  if (!client) return NextResponse.json({ error: 'ERP not configured' }, { status: 503 })
  const ok = await client.setNotificationRead(name, Boolean(read))
  return NextResponse.json({ ok }, { status: ok ? 200 : 502 })
}

// Mark all of the signed-in member's notifications as read.
export async function PATCH(req: NextRequest) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const client = getErpNextClient(await prisma.settings.findFirst())
  if (!client) return NextResponse.json({ error: 'ERP not configured' }, { status: 503 })
  try {
    return NextResponse.json({ updated: await client.markAllNotificationsRead(session.email) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Mark all read failed' }, { status: 502 })
  }
}
