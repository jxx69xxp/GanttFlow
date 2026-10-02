import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/encryption'
import { isMaskedSecret } from '@/lib/utils'
import { ErpNextClient } from '@/lib/erpnext/client'

function resolveSecret(incoming: unknown, stored: string | null | undefined) {
  if (!isMaskedSecret(incoming as string)) return String(incoming)
  return stored ? decrypt(stored) : ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const settings = await prisma.settings.findFirst()

    const baseUrl = String(body.erpnextBaseUrl || settings?.erpnextBaseUrl || '').replace(/\/+$/, '')
    const authMode = (body.erpnextAuthMode || settings?.erpnextAuthMode || 'api') as 'api' | 'login'

    if (!baseUrl) {
      return NextResponse.json({ ok: false, error: 'Base URL is required.' }, { status: 400 })
    }

    let client: ErpNextClient
    if (authMode === 'login') {
      const username = String(body.erpnextUsername || settings?.erpnextUsername || '')
      const password = resolveSecret(body.erpnextPassword, settings?.erpnextPassword)
      if (!username || !password) {
        return NextResponse.json({ ok: false, error: 'Username and password are required.' }, { status: 400 })
      }
      client = new ErpNextClient({ baseUrl, authMode: 'login', username, password })
    } else {
      const apiKey = resolveSecret(body.erpnextApiKey, settings?.erpnextApiKey)
      const apiSecret = resolveSecret(body.erpnextApiSecret, settings?.erpnextApiSecret)
      if (!apiKey || !apiSecret) {
        return NextResponse.json({ ok: false, error: 'API Key and API Secret are required.' }, { status: 400 })
      }
      if (apiKey.includes('@')) {
        return NextResponse.json({
          ok: false,
          error: 'That looks like a login email. Paste the API Key from User → API Access, or switch to username/password mode.',
        }, { status: 400 })
      }
      client = new ErpNextClient({ baseUrl, authMode: 'api', apiKey, apiSecret })
    }

    const result = await client.testConnection()
    return NextResponse.json(result, { status: result.ok ? 200 : 401 })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Connection test failed',
    }, { status: 500 })
  }
}
