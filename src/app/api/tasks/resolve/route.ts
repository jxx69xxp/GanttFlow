import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getErpNextClient } from '@/lib/erpnext/client'
import { importBacklogsForSprint } from '@/lib/frappe/persistSprint'
import { toGanttTask } from '@/lib/tasks/mapTask'

// GET ?externalId=SPB-… → the local task, importing its sprint from ERP first if it isn't loaded yet.
// Lets a notification open any backlog, not just ones in sprints already visited.
export async function GET(req: NextRequest) {
  const externalId = req.nextUrl.searchParams.get('externalId')?.trim()
  if (!externalId) return NextResponse.json({ error: 'externalId required' }, { status: 400 })

  const find = () => prisma.task.findUnique({ where: { externalId } })
  let task = await find()
  if (!task) {
    const client = getErpNextClient(await prisma.settings.findFirst())
    const doc = client ? (await client.fetchSprintBacklogDocs([externalId])).get(externalId) : undefined
    if (doc?.sprint_assign) {
      await importBacklogsForSprint(doc.sprint_assign, null, { force: true })
      task = await find()
    }
  }
  // parent backlogs aren't stored (the Gantt shows their leaf tasks), so they can still miss
  if (!task) return NextResponse.json({ error: `${externalId} isn't a task in any sprint here` }, { status: 404 })
  return NextResponse.json({ task: toGanttTask(task) })
}
