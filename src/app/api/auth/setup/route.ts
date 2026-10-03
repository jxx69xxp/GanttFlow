import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { MIN_PASSWORD, hashPassword } from '@/lib/password'
import { SESSION_COOKIE, sealSession } from '@/lib/session'

// First run: until any account has a password, the login page offers "Create the admin account".
const setupNeeded = async () => (await prisma.teamMember.count({ where: { passwordHash: { not: null } } })) === 0

export async function GET() {
  return NextResponse.json({ needed: await setupNeeded() })
}

export async function POST(req: NextRequest) {
  if (!(await setupNeeded())) return NextResponse.json({ error: 'Setup is already done — sign in instead' }, { status: 409 })
  const { email, name, password } = await req.json().catch(() => ({}))
  const addr = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD} characters` }, { status: 400 })
  }
  const data = { name: typeof name === 'string' && name.trim() ? name.trim() : null, passwordHash: await hashPassword(password), isAdmin: true, isActive: true }
  await prisma.teamMember.upsert({ where: { email: addr }, create: { email: addr, ...data }, update: data })

  const { value, options } = sealSession(addr, true)
  const res = NextResponse.json({ email: addr }, { status: 201 })
  res.cookies.set(SESSION_COOKIE, value, options)
  return res
}
