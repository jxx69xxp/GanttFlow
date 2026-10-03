import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getSession } from '@/lib/session'
import { MIN_PASSWORD, hashPassword, verifyPassword } from '@/lib/password'

// "Me" = the signed-in team member.
export async function GET(req: NextRequest) {
  const s = getSession(req)
  if (!s) return NextResponse.json({ email: null, name: null, isAdmin: false })
  const m = await prisma.teamMember.findFirst({
    where: { email: { equals: s.email, mode: 'insensitive' } },
    select: { name: true, isAdmin: true },
  })
  return NextResponse.json({ email: s.email, name: m?.name ?? null, isAdmin: m?.isAdmin ?? false })
}

// Update your own profile: name, and/or password (needs the current one).
export async function PATCH(req: NextRequest) {
  const s = getSession(req)
  if (!s) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { name, currentPassword, newPassword } = await req.json().catch(() => ({}))
  const member = await prisma.teamMember.findFirst({
    where: { email: { equals: s.email, mode: 'insensitive' }, isActive: true },
    select: { id: true, passwordHash: true },
  })
  if (!member) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const data: { name?: string | null; passwordHash?: string } = {}
  if (typeof name === 'string') data.name = name.trim() || null
  if (newPassword !== undefined && newPassword !== '') {
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `New password must be at least ${MIN_PASSWORD} characters` }, { status: 400 })
    }
    if (!(await verifyPassword(String(currentPassword ?? ''), member.passwordHash))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }
    data.passwordHash = await hashPassword(newPassword)
  }
  await prisma.teamMember.update({ where: { id: member.id }, data })
  return NextResponse.json({ ok: true, passwordChanged: Boolean(data.passwordHash) })
}
