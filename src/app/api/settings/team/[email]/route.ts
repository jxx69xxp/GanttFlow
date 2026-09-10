import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ email: string }> }) {
  const { email: raw } = await ctx.params
  const email = decodeURIComponent(raw)
  await prisma.teamMember.delete({ where: { email } }).catch(() => {})
  return new NextResponse(null, { status: 204 })
}
