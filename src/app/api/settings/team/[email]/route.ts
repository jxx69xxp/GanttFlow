import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function DELETE(_req: NextRequest, { params }: { params: { email: string } }) {
  const email = decodeURIComponent(params.email)
  await prisma.teamMember.delete({ where: { email } }).catch(() => {})
  return new NextResponse(null, { status: 204 })
}
