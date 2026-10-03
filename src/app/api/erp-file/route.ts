import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getErpNextClient } from '@/lib/erpnext/client'

// Streams Frappe attachments (/files, /private/files) with ERP auth so images in descriptions/comments render.
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') ?? ''
  // query allowed: Frappe private images carry ?fid=<File name>
  if (!/^\/(private\/)?files\/[^?#]+(\?[^#]*)?$/.test(path) || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }
  const client = getErpNextClient(await prisma.settings.findFirst())
  if (!client) return NextResponse.json({ error: 'ERP not configured' }, { status: 503 })

  const res = await client.fetchFile(path)
  if (!res.ok || !res.body) {
    console.error(`ERP file fetch ${path} → ${res.status}`)
    return new NextResponse(null, { status: res.status || 502 })
  }
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
