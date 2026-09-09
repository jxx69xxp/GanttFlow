import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { encrypt } from '@/lib/encryption'
import { maskSecret } from '@/lib/utils'

export async function GET() {
  const settings = await prisma.settings.findFirst()
  const teamMembers = await prisma.teamMember.findMany({ orderBy: { createdAt: 'asc' } })

  return NextResponse.json({
    erpnextBaseUrl:       settings?.erpnextBaseUrl ?? '',
    erpnextApiKey:        maskSecret(settings?.erpnextApiKey),
    sprintKickoffUrl:     settings?.sprintKickoffUrl ?? '',
    sprintKickoffToken:   maskSecret(settings?.sprintKickoffToken),
    syncIntervalMinutes:  settings?.syncIntervalMinutes ?? 15,
    teamMembers,
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (body.erpnextBaseUrl      !== undefined) data.erpnextBaseUrl     = body.erpnextBaseUrl
  if (body.erpnextApiKey       !== undefined) data.erpnextApiKey      = encrypt(body.erpnextApiKey)
  if (body.erpnextApiSecret    !== undefined) data.erpnextApiSecret   = encrypt(body.erpnextApiSecret)
  if (body.sprintKickoffUrl    !== undefined) data.sprintKickoffUrl   = body.sprintKickoffUrl
  if (body.sprintKickoffToken  !== undefined) data.sprintKickoffToken = encrypt(body.sprintKickoffToken)
  if (body.syncIntervalMinutes !== undefined) data.syncIntervalMinutes = body.syncIntervalMinutes

  const existing = await prisma.settings.findFirst()
  const settings = existing
    ? await prisma.settings.update({ where: { id: existing.id }, data })
    : await prisma.settings.create({ data })

  return NextResponse.json({ ok: true, id: settings.id })
}
