import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { encrypt } from '@/lib/encryption'
import { isMaskedSecret, maskSecret } from '@/lib/utils'
import { mergeStatusColors } from '@/lib/types'

export async function GET() {
  const settings = await prisma.settings.findFirst()
  const teamMembers = await prisma.teamMember.findMany({ orderBy: { createdAt: 'asc' } })

  return NextResponse.json({
    erpnextBaseUrl:        settings?.erpnextBaseUrl ?? '',
    erpnextApiKey:         maskSecret(settings?.erpnextApiKey),
    erpnextApiSecret:      maskSecret(settings?.erpnextApiSecret),
    erpnextAuthMode:       settings?.erpnextAuthMode ?? 'api',
    erpnextUsername:       settings?.erpnextUsername ?? '',
    erpnextPassword:       maskSecret(settings?.erpnextPassword),
    sprintKickoffUrl:      settings?.sprintKickoffUrl ?? '',
    sprintKickoffApiKey:   maskSecret(settings?.sprintKickoffApiKey),
    sprintKickoffApiSecret: maskSecret(settings?.sprintKickoffApiSecret),
    statusColors:          mergeStatusColors(settings?.statusColors),
    syncIntervalMinutes:   settings?.syncIntervalMinutes ?? 15,
    teamMembers,
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (body.erpnextBaseUrl !== undefined) data.erpnextBaseUrl = String(body.erpnextBaseUrl).replace(/\/+$/, '')
  if (body.erpnextApiKey !== undefined && !isMaskedSecret(body.erpnextApiKey)) {
    data.erpnextApiKey = encrypt(body.erpnextApiKey)
  }
  if (body.erpnextApiSecret !== undefined && !isMaskedSecret(body.erpnextApiSecret)) {
    data.erpnextApiSecret = encrypt(body.erpnextApiSecret)
  }
  if (body.erpnextAuthMode !== undefined) data.erpnextAuthMode = body.erpnextAuthMode
  if (body.erpnextUsername !== undefined) data.erpnextUsername = body.erpnextUsername
  if (body.erpnextPassword !== undefined && !isMaskedSecret(body.erpnextPassword)) {
    data.erpnextPassword = encrypt(body.erpnextPassword)
  }
  if (body.sprintKickoffUrl !== undefined) data.sprintKickoffUrl = String(body.sprintKickoffUrl).replace(/\/+$/, '')
  if (body.sprintKickoffApiKey !== undefined && !isMaskedSecret(body.sprintKickoffApiKey)) {
    data.sprintKickoffApiKey = encrypt(body.sprintKickoffApiKey)
  }
  if (body.sprintKickoffApiSecret !== undefined && !isMaskedSecret(body.sprintKickoffApiSecret)) {
    data.sprintKickoffApiSecret = encrypt(body.sprintKickoffApiSecret)
  }
  if (body.statusColors !== undefined) data.statusColors = JSON.stringify(body.statusColors)
  if (body.syncIntervalMinutes !== undefined) data.syncIntervalMinutes = body.syncIntervalMinutes

  const existing = await prisma.settings.findFirst()
  const settings = existing
    ? await prisma.settings.update({ where: { id: existing.id }, data })
    : await prisma.settings.create({ data })

  return NextResponse.json({ ok: true, id: settings.id })
}
