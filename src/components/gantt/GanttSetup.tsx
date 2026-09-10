'use client'
import { useEffect, useState } from 'react'
import { CalendarRange, Columns3, Rows3 } from 'lucide-react'
import { useGanttStore } from '@/store/ganttStore'
import { cn } from '@/lib/utils'
import type { GanttBoard, ViewMode } from '@/lib/types'

const VIEWS: ViewMode[] = ['Day', 'Week', 'Month', 'Year']

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
}

export function GanttSetup({
  onCreated,
}: {
  onCreated: (chart: GanttBoard) => void
}) {
  const { viewMode, setViewMode } = useGanttStore()
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const invalid = !from || !to || from > to

  useEffect(() => {
    setFrom(isoDaysFromNow(0))
    setTo(isoDaysFromNow(30))
  }, [])

  async function createChart() {
    setError('')
    setPending(true)
    try {
      const res = await fetch('/api/charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Untitled chart',
          startDate: from,
          endDate: to,
          viewMode,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not create chart')
      onCreated(json.chart)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create chart')
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      data-testid="gantt-setup"
      className="mx-auto flex max-w-xl flex-col gap-4 p-6"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">New Gantt chart</p>
        <h2 className="mt-1 text-xl font-semibold text-ink">Set dates, then generate the chart</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Each chart is saved. You can create as many as you need and switch them in the sidebar.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Chart name</span>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Website rebuild"
          className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink"
        />
      </label>

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CalendarRange className="h-4 w-4 text-muted" />
          1. Chart dates
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-muted">From</span>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted">To</span>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Columns3 className="h-4 w-4 text-muted" />
          2. Columns
        </p>
        <div className="flex rounded-lg bg-input p-1">
          {VIEWS.map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setViewMode(v)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                viewMode === v ? 'bg-blue-600 text-white' : 'text-muted hover:text-ink'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        disabled={invalid || pending}
        onClick={createChart}
        className="rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Generate Gantt'}
      </button>

      <p className="flex items-center gap-2 text-xs text-soft">
        <Rows3 className="h-3.5 w-3.5" />
        After generate: Add row for each task, or create another chart anytime.
      </p>
    </div>
  )
}
