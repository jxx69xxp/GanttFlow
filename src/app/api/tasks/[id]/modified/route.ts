import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getErpNextClient } from '@/lib/erpnext/client'

/** Returns the ERP `modified` timestamp for a task — used for change detection. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task?.externalId) return NextResponse.json({ modified: null })

  const settings = await prisma.settings.findFirst()
  const client = getErpNextClient(settings)
  if (!client) return NextResponse.json({ modified: null })

  const doctype = task.externalId.startsWith('SPB-') ? 'Sprint Backlogs' : 'Task'
  const modified = await client.fetchModified(doctype, task.externalId)
  return NextResponse.json({ modified })
}
