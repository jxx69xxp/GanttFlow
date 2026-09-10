'use client'
import { useState } from 'react'
import { Flag, Plus, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

export function CreateSprintDialog({
  variant = 'toolbar',
  onCreated,
}: {
  variant?: 'toolbar' | 'setup' | 'icon'
  onCreated?: (sprint: {
    id: string
    name: string
    externalId?: string
    startDate?: string
    endDate?: string
    chartId?: string | null
  }) => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const [form, setForm] = useState({ name: '', startDate: today, endDate: inTwoWeeks })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Could not create sprint on ERP')
        return json
      }),
    onSuccess: (json) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['sprints'] })
      qc.invalidateQueries({ queryKey: ['charts'] })
      setOpen(false)
      setForm({ name: '', startDate: today, endDate: inTwoWeeks })
      if (json?.sprint) onCreated?.(json.sprint)
      else onCreated?.({ id: '', name: form.name, startDate: form.startDate, endDate: form.endDate })
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(''); setOpen(true) }}
        className={cn(
          'flex items-center justify-center font-semibold',
          variant === 'icon'
            ? 'h-8 w-8 rounded-md border border-line bg-input text-ink hover:bg-hover'
            : variant === 'setup'
              ? 'gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500'
              : 'gap-1.5 rounded-md bg-hover px-3 py-1 text-xs text-ink hover:bg-line'
        )}
        title="Create sprint"
      >
        {variant === 'icon' ? <Plus className="h-3.5 w-3.5" /> : <><Flag className="h-3.5 w-3.5" /> Create sprint</>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">New sprint</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-soft hover:bg-input">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted">Sprint name</span>
                <input
                  value={form.name}
                  onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink"
                  placeholder="Sprint 1"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-muted">Start</span>
                  <input type="date" value={form.startDate}
                    onChange={e => setForm(s => ({ ...s, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted">End</span>
                  <input type="date" value={form.endDate}
                    onChange={e => setForm(s => ({ ...s, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink" />
                </label>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="button"
                disabled={!form.name || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating…' : 'Create sprint'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
