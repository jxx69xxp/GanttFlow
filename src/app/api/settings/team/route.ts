import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { MIN_PASSWORD, hashPassword } from '@/lib/password'
import { requireAdmin } from '@/lib/session'

// Add or update a member (admins only). Re-submitting an existing email updates it — that's how passwords are reset.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Only admins can manage the team' }, { status: 403 })
  const { email, name, role, password, isAdmin } = await req.json().catch(() => ({}))
  const addr = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!addr) return NextResponse.json({ error: 'email required' }, { status: 400 })
  if (password !== undefined && password !== '' && (typeof password !== 'string' || password.length < MIN_PASSWORD)) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD} characters` }, { status: 400 })
  }

  const data = {
    ...(name !== undefined && { name: name || null }),
    ...(role !== undefined && { role: role || null }),
    ...(typeof isAdmin === 'boolean' && { isAdmin }),
    ...(password && { passwordHash: await hashPassword(password) }),
  }
  const member = await prisma.teamMember.upsert({
    where: { email: addr },
    create: { email: addr, ...data },
    update: { ...data, isActive: true },
    select: { id: true, email: true, name: true, role: true, isActive: true, isAdmin: true },
  })
  return NextResponse.json(member, { status: 201 })
}
