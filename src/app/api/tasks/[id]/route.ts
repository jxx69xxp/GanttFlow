import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/encryption'
import { ErpNextClient } from '@/lib/erpnext/client'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { startDate, endDate, progress, status } = body

  const task = await prisma.task.update({
    where: { id: params.id },
    data: {
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate   && { endDate:   new Date(endDate)   }),
      ...(progress  !== undefined && { progress }),
      ...(status    && { status }),
    },
  })

  // Write-back to ERPNext
  let erpnextSync = false
  if (task.source === 'erpnext') {
    try {
      const settings = await prisma.settings.findFirst()
      if (settings?.erpnextBaseUrl && settings.erpnextApiKey && settings.erpnextApiSecret) {
        const client = new ErpNextClient({
          baseUrl: settings.erpnextBaseUrl,
          apiKey: decrypt(settings.erpnextApiKey),
          apiSecret: decrypt(settings.erpnextApiSecret),
        })
        await client.patchTask(task.externalId, {
          ...(startDate && { exp_start_date: startDate }),
          ...(endDate   && { exp_end_date:   endDate   }),
          ...(progress  !== undefined && { progress }),
          ...(status    && { status }),
        })
        erpnextSync = true
      }
    } catch (e) {
      console.error('ERPNext write-back failed:', e)
    }
  }

  return NextResponse.json({ task, erpnextSync })
}
