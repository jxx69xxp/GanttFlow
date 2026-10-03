import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getErpNextClient } from '@/lib/erpnext/client'
import { boardsFromErpSprints } from '@/lib/frappe/persistSprint'
import { ERPNEXT_SPRINT_URL } from '@/lib/frappe/sprint'

function ymd(value: Date | string) {
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

async function boardsFromStore() {
  // stored ERP sprints already come from the CORE TEAM department query
  const sprints = await prisma.sprint.findMany({ orderBy: { startDate: 'desc' } })
  const charts = await prisma.chart.findMany()
  return sprints.map(sprint => {
    const chart = charts.find(c => c.name.toLowerCase() === sprint.name.toLowerCase())
    return {
      id: sprint.id,
      externalId: sprint.externalId,
      name: sprint.name,
      startDate: ymd(sprint.startDate),
      endDate: ymd(sprint.endDate),
      status: sprint.status,
      chartId: chart?.id ?? null,
    }
  })
}

export async function GET() {
  const settings = await prisma.settings.findFirst()
  const client = getErpNextClient(settings)
  if (client) {
    try {
      const remote = await client.fetchSprints()
      if (remote.length) {
        const charts = await prisma.chart.findMany({ select: { id: true, name: true } })
        return NextResponse.json({
          sprints: boardsFromErpSprints(remote, charts),
          source: 'erpnext',
        })
      }
    } catch (e) {
      console.error('ERP Sprint fetch failed:', e)
    }
  }

  return NextResponse.json({
    sprints: await boardsFromStore(),
    source: client ? 'local-fallback' : 'local',
    hint: client ? undefined : `Add ERPNext API keys in Settings. Sprint list: ${ERPNEXT_SPRINT_URL}/app/sprint`,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = String(body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Sprint name is required' }, { status: 400 })
  }

  const startDate = body.startDate ? new Date(body.startDate) : new Date()
  const endDate = body.endDate ? new Date(body.endDate) : new Date(startDate.getTime() + 14 * 86400000)
  const payload = { name, startDate: ymd(startDate), endDate: ymd(endDate) }

  const settings = await prisma.settings.findFirst()
  const client = getErpNextClient(settings)
  let externalId = `local-${crypto.randomUUID()}`
  let erpnextSync = false
  let remoteError = ''

  if (client) {
    try {
      const created = await client.createSprint(payload)
      externalId = created.id
      erpnextSync = true
    } catch (e) {
      remoteError = e instanceof Error ? e.message : 'ERPNext Sprint create failed'
    }
  }

  if (remoteError && !erpnextSync && (settings?.erpnextBaseUrl || settings?.erpnextApiKey)) {
    return NextResponse.json({ error: remoteError }, { status: 502 })
  }

  const sprint = await prisma.sprint.create({
    data: {
      externalId,
      name,
      startDate,
      endDate,
      status: body.status || 'Active',
    },
  })

  const chart = await prisma.chart.create({
    data: { name, startDate, endDate, viewMode: 'Week' },
  })

  return NextResponse.json({
    sprint: {
      id: sprint.id,
      externalId: sprint.externalId,
      name: sprint.name,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: sprint.status,
      chartId: chart.id,
    },
    erpnextSync,
  }, { status: 201 })
}
