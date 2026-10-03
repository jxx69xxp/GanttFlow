import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/session'

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ email: string }> }) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Only admins can manage the team' }, { status: 403 })
  const { email: raw } = await ctx.params
  const email = decodeURIComponent(raw)
  if (email.toLowerCase() === admin.email.toLowerCase()) {
    return NextResponse.json({ error: 'You can’t remove your own account' }, { status: 400 })  // never lock the last admin out
  }
  await prisma.teamMember.delete({ where: { email } }).catch(() => {})
  return new NextResponse(null, { status: 204 })
}
