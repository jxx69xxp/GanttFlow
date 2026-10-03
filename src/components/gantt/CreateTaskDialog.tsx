'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PRIORITY_ORDER, type GanttTask, type TeamMember } from '@/lib/types'
import { STATUS_MAP } from '@/lib/erpnext/transformers'
import { cn } from '@/lib/utils'
import { safeHtml } from '@/lib/safeHtml'
import { RichTextInput } from './RichTextInput'

/** true if the editor holds text or an image (contentEditable leaves <br> behind when emptied) */
const hasContent = (html: string) => /<img/i.test(html) || html.replace(/<[^>]*>|&nbsp;/g, '').trim() !== ''

const FIELD = 'w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink'

interface SprintRef {
  name: string
  id?: string
  externalId?: string
}

interface Props {
  sprintId?: string
  sprintName?: string
  sprints?: SprintRef[]
  label?: string
  defaultStart?: string
  defaultEnd?: string
  chartId?: string
}

export function CreateTaskDialog({
  sprintId,
  sprintName,
  sprints = [],
  label = 'Add row',
  defaultStart,
  defaultEnd,
  chartId,
}: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const startDefault = defaultStart || today
  const endDefault = defaultEnd || defaultStart || today
  const selected = sprints.find(s => s.externalId === sprintId || s.id === sprintId) ?? sprints[0]
  const lockedSprintId = sprintId || selected?.externalId || selected?.id || ''
  const lockedSprintName = sprintName || selected?.name || ''
  const [form, setForm] = useState({
    title: '',
    startDate: startDefault,
    endDate: endDefault,
    status: 'Open',
    priority: '',
    sprintPoints: '',
    currentAssignee: '',
    devAssignee: '',
    description: '',
  })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          startDate: form.startDate,
          endDate: form.endDate,
          erpStatus: form.status,
          priority: form.priority || undefined,
          sprintPoints: form.sprintPoints || undefined,
          currentAssignee: form.currentAssignee.trim() || undefined,
          devAssignee: form.devAssignee.trim() || undefined,
          description: hasContent(form.description) ? safeHtml(form.description, { proxyFiles: false }) : undefined,
          sprintName: lockedSprintName || undefined,
          sprintId: lockedSprintId || undefined,
          chartId: chartId || undefined,
          source: 'erpnext',  // creates a Sprint Backlog in Frappe
        }),
      }).then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Could not create task')
        return json
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setOpen(false)
      setForm({
        title: '', startDate: today, endDate: today, status: 'Open', priority: '', sprintPoints: '',
        currentAssignee: '', devAssignee: '', description: '',
      })
    },
    onError: (e: Error) => setError(e.message),
  })

  const { data: erpOptions } = useQuery<{ status?: string[]; priority?: string[] }>({
    queryKey: ['erp-options', 'Sprint Backlogs'],
    queryFn: () => fetch('/api/erp-options?doctype=Sprint%20Backlogs').then(r => r.json()),
    enabled: open,
    staleTime: Infinity,
  })
  const statuses = erpOptions?.status?.length ? erpOptions.status : Object.keys(STATUS_MAP)
  const priorities = erpOptions?.priority?.length ? erpOptions.priority : Object.keys(PRIORITY_ORDER)
  const team = qc.getQueryData<{ teamMembers?: TeamMember[] }>(['settings'])?.teamMembers ?? []
  const people = [...new Set([
    ...team.map(m => m.email),
    ...qc.getQueriesData<{ tasks?: GanttTask[] }>({ queryKey: ['tasks'] })
      .flatMap(([, d]) => d?.tasks ?? [])
      .flatMap(t => [t.assigneeEmail, t.currentAssignee, t.devAssignee]),
  ].filter((e): e is string => !!e))].sort()

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('')
          setForm(s => ({
            ...s,
            startDate: defaultStart || s.startDate || today,
            endDate: defaultEnd || defaultStart || s.endDate || today,
          }))
          setOpen(true)
        }}
        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
      >
        <Plus className="h-3.5 w-3.5" />
        {label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-h-[90vh] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Add row</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-soft hover:bg-input">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted">Task</span>
                <input
                  value={form.title}
                  onChange={e => setForm(s => ({ ...s, title: e.target.value }))}
                  className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink"
                  placeholder="Task name"
                />
              </label>
              {lockedSprintId && (
                <p className="rounded-lg border border-line bg-input px-3 py-2 text-xs text-muted">
                  Sprint ID <span className="font-mono text-ink">{lockedSprintId}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-muted">From</span>
                  <input type="date" value={form.startDate}
                    onChange={e => setForm(s => ({ ...s, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted">To</span>
                  <input type="date" value={form.endDate}
                    onChange={e => setForm(s => ({ ...s, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink" />
                </label>
              </div>
              <datalist id="new-task-people">{people.map(p => <option key={p} value={p} />)}</datalist>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-muted">Status</span>
                  <select value={form.status} onChange={e => setForm(s => ({ ...s, status: e.target.value }))} className={FIELD}>
                    {[...new Set([form.status, ...statuses])].map(s => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted">Priority</span>
                  <select value={form.priority} onChange={e => setForm(s => ({ ...s, priority: e.target.value }))} className={FIELD}>
                    <option value="">—</option>
                    {priorities.map(p => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <label className="col-span-2 block space-y-1">
                  <span className="text-xs text-muted">Sprint points</span>
                  <input type="number" inputMode="decimal" min={0} step="any" value={form.sprintPoints}
                    onChange={e => setForm(s => ({ ...s, sprintPoints: e.target.value }))}
                    className={FIELD} placeholder="e.g. 3" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted">Current assignee</span>
                  <input type="email" list="new-task-people" value={form.currentAssignee}
                    onChange={e => setForm(s => ({ ...s, currentAssignee: e.target.value }))}
                    className={FIELD} placeholder="name@company.com" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted">Dev assignee</span>
                  <input type="email" list="new-task-people" value={form.devAssignee}
                    onChange={e => setForm(s => ({ ...s, devAssignee: e.target.value }))}
                    className={FIELD} placeholder="name@company.com" />
                </label>
              </div>
              <div className="space-y-1">
                <label htmlFor="new-task-desc" className="text-xs text-muted">Description</label>
                <RichTextInput id="new-task-desc" onChange={html => setForm(s => ({ ...s, description: html }))} />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="button"
                disabled={!form.title || !lockedSprintId || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className={cn(
                  'w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500',
                  'disabled:opacity-50'
                )}
              >
                {createMutation.isPending ? 'Creating…' : 'Add row'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
