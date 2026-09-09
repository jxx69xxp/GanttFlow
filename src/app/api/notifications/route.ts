import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const event     = searchParams.get('event')
  const recipient = searchParams.get('recipient')
  const from      = searchParams.get('from')
  const to        = searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (event)     where.event     = event
  if (recipient) where.recipient = recipient
  if (from || to) {
    where.sentAt = {}
    if (from) (where.sentAt as Record<string,unknown>).gte = new Date(from)
    if (to)   (where.sentAt as Record<string,unknown>).lte = new Date(to)
  }

  const notifications = await prisma.notificationLog.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ notifications })
}
