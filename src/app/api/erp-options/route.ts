import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getErpNextClient } from '@/lib/erpnext/client'

// Select options for editable fields, read from the Frappe DocType so the UI never offers a value ERP rejects.
const FIELDS = ['status', 'priority'] as const
const DOCTYPES = ['Sprint Backlogs', 'Task'] as const

export async function GET(req: NextRequest) {
  const doctype = req.nextUrl.searchParams.get('doctype') ?? 'Sprint Backlogs'
  if (!(DOCTYPES as readonly string[]).includes(doctype)) {
    return NextResponse.json({ error: 'Unsupported doctype' }, { status: 400 })
  }
  const client = getErpNextClient(await prisma.settings.findFirst())
  if (!client) return NextResponse.json({ status: [], priority: [] })
  const [status, priority] = await Promise.all(FIELDS.map(f => client.fetchSelectOptions(doctype, f)))
  return NextResponse.json({ status, priority })
}
