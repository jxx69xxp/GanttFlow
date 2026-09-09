import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function POST(req: NextRequest) {
  const { email, name, role } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const member = await prisma.teamMember.upsert({
    where: { email },
    create: { email, name, role },
    update: { name, role, isActive: true },
  })
  return NextResponse.json(member, { status: 201 })
}
