import { NextResponse } from 'next/server'
import { runSync } from '@/lib/sync/syncEngine'

export async function POST() {
  try {
    const result = await runSync()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
