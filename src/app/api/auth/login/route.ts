import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyPassword } from '@/lib/password'
import { SESSION_COOKIE, sealSession } from '@/lib/session'

// Local accounts only: an active team member with a password set in Settings → Team.
export async function POST(req: NextRequest) {
  const { email, password, remember } = await req.json().catch(() => ({}))
  const addr = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!addr || typeof password !== 'string' || !password) {
    return NextResponse.json({ error: 'Enter your email and password' }, { status: 400 })
  }

  const member = await prisma.teamMember.findFirst({
    where: { email: { equals: addr, mode: 'insensitive' }, isActive: true },
    select: { email: true, passwordHash: true },
  })
  // one message for "no such user" and "wrong password" — don't reveal which emails exist
  if (!member || !(await verifyPassword(password, member.passwordHash))) {
    return NextResponse.json({ error: 'Email or password is incorrect' }, { status: 401 })
  }

  const { value, options } = sealSession(member.email.toLowerCase(), Boolean(remember))
  const res = NextResponse.json({ email: member.email })
  res.cookies.set(SESSION_COOKIE, value, options)
  return res
}
