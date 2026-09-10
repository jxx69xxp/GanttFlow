import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/encryption'
import { isMaskedSecret } from '@/lib/utils'
import { ErpNextClient } from '@/lib/erpnext/client'
import { SprintKickoffClient } from '@/lib/sprint-kickoff/client'

function resolveSecret(
  incoming: unknown,
  stored: string | null | undefined,
) {
  if (!isMaskedSecret(incoming as string)) return String(incoming)
  return stored ? decrypt(stored) : ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const settings = await prisma.settings.findFirst()
    const source = body.source === 'sprint_kickoff' ? 'sprint_kickoff' : 'erpnext'

    const baseUrl = String(
      source === 'sprint_kickoff'
        ? (body.sprintKickoffUrl || settings?.sprintKickoffUrl || '')
        : (body.erpnextBaseUrl || settings?.erpnextBaseUrl || ''),
    ).replace(/\/+$/, '')

    const apiKey = resolveSecret(
      source === 'sprint_kickoff' ? body.sprintKickoffApiKey : body.erpnextApiKey,
      source === 'sprint_kickoff' ? settings?.sprintKickoffApiKey : settings?.erpnextApiKey,
    )
    const apiSecret = resolveSecret(
      source === 'sprint_kickoff' ? body.sprintKickoffApiSecret : body.erpnextApiSecret,
      source === 'sprint_kickoff' ? settings?.sprintKickoffApiSecret : settings?.erpnextApiSecret,
    )

    if (!baseUrl || !apiKey || !apiSecret) {
      return NextResponse.json({
        ok: false,
        error: 'API Key and API Secret are required. Username/password will not work when MFA is enabled.',
      }, { status: 400 })
    }

    if (apiKey.includes('@')) {
      return NextResponse.json({
        ok: false,
        error: 'That looks like a login email. Paste the API Key from User → API Access, not your username.',
      }, { status: 400 })
    }

    const result = source === 'sprint_kickoff'
      ? await new SprintKickoffClient({ baseUrl, apiKey, apiSecret }).testConnection()
      : await new ErpNextClient({ baseUrl, apiKey, apiSecret }).testConnection()

    return NextResponse.json(result, { status: result.ok ? 200 : 401 })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Connection test failed',
    }, { status: 500 })
  }
}
