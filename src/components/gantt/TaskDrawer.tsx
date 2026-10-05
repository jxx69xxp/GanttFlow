'use client'
import { useState, useRef, useEffect } from 'react'
import {
  X, CheckCircle, Link2, RefreshCw, Save, MessageSquare,
  Send, Calendar, ChevronDown, AlertCircle,
} from 'lucide-react'
import { useGanttStore } from '@/store/ganttStore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { STATUS_COLORS, TASK_STATUSES, PRIORITY_ORDER, isOverdueTask, type TaskStatus, type GanttTask, type TeamMember } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'
import { safeHtml } from '@/lib/safeHtml'
import { ERP_STATUS_FOR, STATUS_MAP } from '@/lib/erpnext/transformers'
import { commentHtml, mentionQuery } from '@/lib/mentions'
import { CreateTaskDialog } from './CreateTaskDialog'

/** Value the status dropdown edits: raw ERP status for ERP rows, Gantt status otherwise. */
const commentsUrl = (t: GanttTask) =>
  `/api/tasks/${encodeURIComponent(t.id)}/comments${t.erpDoctype ? `?doctype=${encodeURIComponent(t.erpDoctype)}` : ''}`

const statusValue = (t: GanttTask) =>
  t.source === 'erpnext' ? (t.erpStatus || ERP_STATUS_FOR[t.status]) : t.status

interface Comment {
  name: string
  owner: string
  comment_by?: string
  content: string
  creation: string
}

const INPUT = 'w-full rounded-md border border-line bg-input px-2 py-1.5 text-xs text-ink focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40'

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white uppercase">
      {name[0]}
    </div>
  )
}

export function TaskDrawer({ colors = STATUS_COLORS }: { colors?: Record<TaskStatus, string> }) {
  const { selectedTask, drawerOpen, closeDrawer, selectTask } = useGanttStore()
  const qc = useQueryClient()

  // local editable state — initialised from task, not live-bound
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [sprintId, setSprintId]   = useState('')
  const [status, setStatus]       = useState('')
  const [priority, setPriority]   = useState('')
  const [currentAssignee, setCurrentAssignee] = useState('')
  const [devAssignee, setDevAssignee] = useState('')
  const [comment, setComment]     = useState('')
  const [mentions, setMentions]   = useState<Record<string, string>>({})  // picked @label → email
  const [mentionQ, setMentionQ]   = useState<string | null>(null)
  const [dirty, setDirty]         = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const commentRef = useRef<HTMLTextAreaElement>(null)

  // Reset local state when task changes
  useEffect(() => {
    if (!selectedTask) return
    setStartDate(selectedTask.start || '')
    setEndDate(selectedTask.end || '')
    setSprintId(selectedTask.sprintId || '')
    setStatus(statusValue(selectedTask))
    setPriority(selectedTask.priority || '')
    setCurrentAssignee(selectedTask.currentAssignee ?? selectedTask.assigneeEmail ?? '')
    setDevAssignee(selectedTask.devAssignee || '')
    setDirty(false)
    setSaveStatus('idle')
    setComment('')
    setMentions({})
    setMentionQ(null)
  }, [selectedTask?.id])

  // ── sprints list ────────────────────────────────────────────────────────────
  const { data: sprintsData } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => fetch('/api/sprints').then(r => r.json()),
    enabled: drawerOpen,
    staleTime: 60_000,
  })
  const sprints: Array<{ id: string; externalId?: string; name: string }> = sprintsData?.sprints ?? []

  // ── select options from the Frappe DocType (status / priority) ─────────────
  const optionsDoctype = selectedTask?.externalId?.startsWith('SPB-') ? 'Sprint Backlogs' : 'Task'
  const { data: erpOptions } = useQuery<{ status?: string[]; priority?: string[] }>({
    queryKey: ['erp-options', optionsDoctype],
    queryFn: () => fetch(`/api/erp-options?doctype=${encodeURIComponent(optionsDoctype)}`).then(r => r.json()),
    enabled: drawerOpen && selectedTask?.source === 'erpnext',
    staleTime: Infinity,
  })

  // ── comments ────────────────────────────────────────────────────────────────
  const { data: commentsData, refetch: refetchComments, isFetching: loadingComments } = useQuery({
    queryKey: ['task-comments', selectedTask?.id],
    queryFn: () => fetch(commentsUrl(selectedTask!)).then(r => r.json()),
    enabled: drawerOpen && !!selectedTask,
    staleTime: 30_000,
  })
  const comments: Comment[] = commentsData?.comments ?? []

  // @mention candidates: team members (named) + anyone seen on loaded tasks
  const { data: settingsData } = useQuery<{ teamMembers?: TeamMember[] }>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
    enabled: drawerOpen,
    staleTime: 5 * 60_000,
  })

  // ── mutations ───────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetch(`/api/tasks/${selectedTask!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.task) {
        // update the task in the list and in the drawer
        qc.setQueriesData({ queryKey: ['tasks'] }, (old: { tasks?: unknown[] } | undefined) => {
          if (!old?.tasks) return old
          return { ...old, tasks: (old.tasks as Array<{ id: string }>).map(t => t.id === data.task.id ? { ...t, ...data.task } : t) }
        })
        selectTask(data.task)
      }
      // ERP rejected the write → next sync would revert it; keep the Save button up
      if (data?.task?.source === 'erpnext' && data.erpnextSync === false) {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
        return
      }
      setSaveStatus('saved')
      setDirty(false)
      setTimeout(() => setSaveStatus('idle'), 2000)
    },
    onError: () => { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000) },
    onMutate: () => setSaveStatus('saving'),
  })

  const completeMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/tasks/${selectedTask!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed', progress: 100 }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      if (data?.task) selectTask(data.task)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    },
  })

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      fetch(commentsUrl(selectedTask!), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }).then(r => r.json()),
    onSuccess: () => {
      setComment('')
      setMentions({})
      setMentionQ(null)
      refetchComments()
    },
  })

  // ── sync from ERP ───────────────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: () => fetch('/api/sync', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      refetchComments()
    },
  })

  if (!drawerOpen || !selectedTask) return null

  // assignee suggestions from tasks already loaded (free text still allowed)
  const people = [...new Set(
    qc.getQueriesData<{ tasks?: GanttTask[] }>({ queryKey: ['tasks'] })
      .flatMap(([, d]) => d?.tasks ?? [])
      .flatMap(t => [t.assigneeEmail, t.currentAssignee, t.devAssignee])
      .filter((e): e is string => !!e),
  )].sort()
  const isErp = selectedTask.source === 'erpnext'
  const mentionable = new Map<string, string>()  // email → label
  for (const m of settingsData?.teamMembers ?? []) if (m.isActive) mentionable.set(m.email.toLowerCase(), m.name || m.email.split('@')[0])
  for (const e of people) if (!mentionable.has(e.toLowerCase())) mentionable.set(e.toLowerCase(), e.split('@')[0])
  const mentionHits = mentionQ === null ? [] : [...mentionable]
    .filter(([email, label]) => `${label} ${email}`.toLowerCase().includes(mentionQ.toLowerCase()))
    .slice(0, 6)
  const sendComment = () => { if (comment.trim()) commentMutation.mutate(commentHtml(comment.trim(), mentions)) }
  function pickMention(email: string, label: string) {
    const el = commentRef.current
    const caret = el?.selectionStart ?? comment.length
    const before = comment.slice(0, caret).replace(/@[^\s@]*$/, `@${label} `)
    setComment(before + comment.slice(caret))
    setMentions(m => ({ ...m, [label]: email }))
    setMentionQ(null)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(before.length, before.length) })
  }
  const withCurrent = (list: string[], v: string) => [...new Set([...list, ...(v ? [v] : [])])]
  const priorities = withCurrent(erpOptions?.priority?.length ? erpOptions.priority : Object.keys(PRIORITY_ORDER), priority)
  const statuses = withCurrent(
    !isErp ? TASK_STATUSES : erpOptions?.status?.length ? erpOptions.status : Object.keys(STATUS_MAP),
    status,
  )

  const color   = colors[selectedTask.status] ?? STATUS_COLORS[selectedTask.status]
  const overdue = isOverdueTask(selectedTask)
  const isBacklog = selectedTask.externalId?.startsWith('SPB-')
  const readOnly = Boolean(selectedTask.erpDoctype)  // not in any sprint here → view + comment only
  const erpUrl  = selectedTask.source === 'erpnext' && selectedTask.externalId
    ? `#erp-${selectedTask.externalId}`  // placeholder — real URL would need ERP base URL
    : null

  const duration = startDate && endDate
    ? Math.max(0, Math.ceil((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000))
    : null

  function handleSave() {
    const payload: Record<string, unknown> = {}
    if (startDate !== selectedTask!.start) payload.startDate = startDate
    if (endDate   !== selectedTask!.end)   payload.endDate   = endDate
    if (sprintId  !== selectedTask!.sprintId) payload.sprintId = sprintId
    if (status    !== statusValue(selectedTask!)) payload[isErp ? 'erpStatus' : 'status'] = status
    if (priority  !== (selectedTask!.priority || '')) payload.priority = priority
    if (currentAssignee !== (selectedTask!.currentAssignee ?? selectedTask!.assigneeEmail ?? '')) payload.currentAssignee = currentAssignee
    if (devAssignee !== (selectedTask!.devAssignee || '')) payload.devAssignee = devAssignee
    if (Object.keys(payload).length === 0) return
    saveMutation.mutate(payload)
  }

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={closeDrawer} />

      <aside className="fixed right-0 top-0 z-50 flex h-full flex-col border-l border-line bg-panel shadow-2xl" style={{ width: 'clamp(380px, 50vw, 800px)' }}>
        {/* ── header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-soft">
                {selectedTask.erpDoctype ?? (isBacklog ? 'Sprint Backlog' : 'Task')}
              </span>
              {selectedTask.externalId && (
                <span className="rounded bg-hover px-1.5 py-0.5 font-mono text-[10px] text-muted">
                  {selectedTask.externalId}
                </span>
              )}
            </div>
            <h2 className="mt-1 text-sm font-semibold leading-snug text-ink">{selectedTask.name}</h2>
            {/* status badge */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: `${color}20`, color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                {selectedTask.erpStatus || selectedTask.status}
              </span>
              {selectedTask.devopsStatus && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                  {selectedTask.devopsStatus}
                </span>
              )}
              {overdue && (
                <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                  <AlertCircle className="h-3 w-3" /> Overdue
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              title="Sync from ERP"
              className="rounded p-1.5 text-soft hover:bg-hover disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', syncMutation.isPending && 'animate-spin')} />
            </button>
            <button onClick={closeDrawer} className="rounded p-1.5 text-soft hover:bg-hover">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* edits sync to a sprint row; docs outside a sprint are view-only */}
          <fieldset disabled={readOnly} className="contents">
          {/* ── Timeline edit ──────────────────────────────────────────────── */}
          <section className="border-b border-line px-4 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Calendar className="h-3.5 w-3.5" /> Timeline
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-soft">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setDirty(true) }}
                  className="w-full rounded-md border border-line bg-input px-2 py-1.5 text-xs text-ink focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-soft">End date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => { setEndDate(e.target.value); setDirty(true) }}
                  className="w-full rounded-md border border-line bg-input px-2 py-1.5 text-xs text-ink focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
              </div>
            </div>
            {duration != null && (
              <p className="mt-1.5 text-[11px] text-soft">{duration} working day{duration !== 1 ? 's' : ''}</p>
            )}
          </section>

          {/* ── Sprint change ──────────────────────────────────────────────── */}
          <section className="border-b border-line px-4 py-3">
            <label className="mb-1.5 block text-[10px] font-semibold text-soft uppercase tracking-wider">Sprint</label>
            <div className="relative">
              <select
                value={sprintId}
                onChange={e => { setSprintId(e.target.value); setDirty(true) }}
                className="w-full appearance-none rounded-md border border-line bg-input py-1.5 pl-2.5 pr-7 text-xs text-ink focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              >
                <option value="">— No sprint —</option>
                {sprints.map(s => (
                  <option key={s.externalId || s.id} value={s.externalId || s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-soft" />
            </div>
          </section>

          {/* ── Priority + assignees (editable) ───────────────────────────── */}
          <section className="border-b border-line px-4 py-3">
            <datalist id="gf-people">{people.map(p => <option key={p} value={p} />)}</datalist>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="gf-status" className="mb-1 block text-[10px] font-medium text-soft">Status</label>
                <div className="relative">
                  <select
                    id="gf-status"
                    value={status}
                    onChange={e => { setStatus(e.target.value); setDirty(true) }}
                    className={cn(INPUT, 'appearance-none pr-7')}
                  >
                    {statuses.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-soft" />
                </div>
              </div>
              <div>
                <label htmlFor="gf-priority" className="mb-1 block text-[10px] font-medium text-soft">Priority</label>
                <div className="relative">
                  <select
                    id="gf-priority"
                    value={priority}
                    onChange={e => { setPriority(e.target.value); setDirty(true) }}
                    className={cn(INPUT, 'appearance-none pr-7')}
                  >
                    <option value="">—</option>
                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-soft" />
                </div>
              </div>
              <div>
                <label htmlFor="gf-current" className="mb-1 block text-[10px] font-medium text-soft">Current assignee</label>
                <input
                  id="gf-current"
                  type="email"
                  list="gf-people"
                  value={currentAssignee}
                  onChange={e => { setCurrentAssignee(e.target.value); setDirty(true) }}
                  placeholder="name@company.com"
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="gf-dev" className="mb-1 block text-[10px] font-medium text-soft">
                  Dev assignee{selectedTask.assigneeName && <span className="ml-1 text-muted">· {selectedTask.assigneeName}</span>}
                </label>
                <input
                  id="gf-dev"
                  type="email"
                  list="gf-people"
                  value={devAssignee}
                  onChange={e => { setDevAssignee(e.target.value); setDirty(true) }}
                  placeholder="name@company.com"
                  className={INPUT}
                />
              </div>
            </div>
          </section>

          </fieldset>

          {/* ── Meta grid ─────────────────────────────────────────────────── */}
          <section className="border-b border-line px-4 py-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                ['Points',      selectedTask.sprintPoints],
                ['Type',        selectedTask.workType],
                ['Module',      selectedTask.module],
                ['Project',     selectedTask.projectName],
                ['Assigned',    selectedTask.dateAssigned ? formatDate(selectedTask.dateAssigned) : null],
              ].map(([label, value]) => value ? (
                <div key={label as string}>
                  <p className="text-[10px] text-soft">{label}</p>
                  <p className="mt-0.5 text-xs font-medium text-ink">{value}</p>
                </div>
              ) : null)}
            </div>

            {selectedTask.qaAssignee && (
              <div className="mt-1.5 flex items-center gap-2">
                <Avatar name={selectedTask.qaAssignee} />
                <div>
                  <p className="text-[10px] text-soft">QA</p>
                  <p className="text-xs font-medium text-ink">{selectedTask.qaAssignee}</p>
                </div>
              </div>
            )}
          </section>

          {/* ── Progress bar ─────────────────────────────────────────────── */}
          <section className="border-b border-line px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-soft">Progress</p>
              <p className="text-xs font-bold text-ink">{selectedTask.progress}%</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-hover">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${selectedTask.progress}%`, background: color }}
              />
            </div>
          </section>

          {/* ── Description ──────────────────────────────────────────────── */}
          {selectedTask.description && (
            <section className="border-b border-line px-4 py-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-soft">Description</p>
              <div
                className="prose prose-sm max-w-none text-xs text-muted [&_img]:max-w-full [&_img]:rounded [&_a]:text-blue-500 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: safeHtml(selectedTask.description) }}
              />
            </section>
          )}

          {/* ── Parent / Dependencies ────────────────────────────────────── */}
          {(selectedTask.parentBacklogId || selectedTask.dependencies) && (
            <section className="border-b border-line px-4 py-3 space-y-2">
              {selectedTask.parentBacklogId && (
                <div>
                  <p className="text-[10px] text-soft">Parent backlog</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {selectedTask.parentBacklogName
                      ? `${selectedTask.parentBacklogName} (${selectedTask.parentBacklogId})`
                      : selectedTask.parentBacklogId}
                  </p>
                </div>
              )}
              {selectedTask.dependencies && (
                <div>
                  <p className="text-[10px] text-soft">Depends on</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">{selectedTask.dependencies}</p>
                </div>
              )}
            </section>
          )}

          {/* ── Comments ─────────────────────────────────────────────────── */}
          <section className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-soft">
                <MessageSquare className="h-3.5 w-3.5" />
                Comments {comments.length > 0 && `(${comments.length})`}
              </p>
              <button
                type="button"
                onClick={() => refetchComments()}
                disabled={loadingComments}
                className="flex items-center gap-1 text-[10px] text-soft hover:text-ink disabled:opacity-40"
              >
                <RefreshCw className={cn('h-3 w-3', loadingComments && 'animate-spin')} />
                {loadingComments ? 'Fetching…' : 'Refresh'}
              </button>
            </div>

            {/* loading skeleton */}
            {loadingComments && comments.length === 0 && (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="flex gap-2 animate-pulse">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-hover" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-24 rounded bg-hover" />
                      <div className="h-2 w-full rounded bg-hover" />
                      <div className="h-2 w-3/4 rounded bg-hover" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* comment list — newest first */}
            {!loadingComments && comments.length === 0 && (
              <p className="text-[11px] text-soft">No comments yet.</p>
            )}
            <div className="space-y-3">
              {[...comments].reverse().map(c => (
                <div key={c.name} className="flex gap-2">
                  <Avatar name={c.comment_by || c.owner} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold text-ink">{c.comment_by || c.owner}</span>
                      <span className="text-[10px] text-soft">
                        {new Date(c.creation).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div
                      className="mt-0.5 text-xs leading-relaxed text-muted [&_img]:mt-1 [&_img]:max-w-full [&_img]:rounded [&_a]:text-blue-500 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: safeHtml(c.content) }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* add comment */}
            <div className="relative mt-3 flex gap-2">
              {mentionHits.length > 0 && (
                <ul role="listbox" aria-label="Mention someone" className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-md border border-line bg-panel shadow-lg">
                  {mentionHits.map(([email, label], i) => (
                    <li key={email}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === 0}
                        onMouseDown={e => { e.preventDefault(); pickMention(email, label) }}
                        className={cn('flex w-full flex-col px-2.5 py-1.5 text-left hover:bg-hover', i === 0 && 'bg-hover')}
                      >
                        <span className="text-xs font-medium text-ink">{label}</span>
                        <span className="truncate text-[10px] text-soft">{email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <textarea
                ref={commentRef}
                value={comment}
                onChange={e => {
                  setComment(e.target.value)
                  setMentionQ(mentionQuery(e.target.value.slice(0, e.target.selectionStart)))
                }}
                onBlur={() => setMentionQ(null)}
                onKeyDown={e => {
                  if (mentionHits.length && (e.key === 'Enter' || e.key === 'Tab')) {
                    e.preventDefault()
                    pickMention(...mentionHits[0])
                  } else if (e.key === 'Escape' && mentionQ !== null) {
                    e.stopPropagation()
                    setMentionQ(null)
                  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    sendComment()
                  }
                }}
                placeholder="Add a comment… @ to mention (⌘↵ to send)"
                rows={2}
                className="flex-1 resize-none rounded-md border border-line bg-input px-2.5 py-2 text-xs text-ink placeholder:text-soft focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
              <button
                type="button"
                disabled={!comment.trim() || commentMutation.isPending}
                onClick={sendComment}
                className="self-end rounded-md bg-blue-600 p-2 text-white hover:bg-blue-500 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        </div>

        {/* ── footer actions ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
          {/* Save + ERP sync */}
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors',
                saveStatus === 'saved'  ? 'bg-emerald-600 text-white' :
                saveStatus === 'error'  ? 'bg-red-600 text-white' :
                                          'bg-blue-600 text-white hover:bg-blue-500',
                saveMutation.isPending && 'opacity-70'
              )}
            >
              <Save className="h-4 w-4" />
              {saveStatus === 'saving' ? 'Saving…' :
               saveStatus === 'saved'  ? 'Saved ✓' :
               saveStatus === 'error'  ? 'Failed — retry' :
               isErp ? 'Save & sync to Frappe' : 'Save'}
            </button>
          )}

          {/* Complete */}
          {!readOnly && selectedTask.status !== 'Completed' && (
            <button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              {completeMutation.isPending ? 'Marking…' : 'Mark complete'}
            </button>
          )}

          {/* Follow-up: new backlog in the same sprint, cross-linked by comments */}
          {!readOnly && isBacklog && selectedTask.sprintId && (
            <CreateTaskDialog
              label="Add follow-up task"
              followUpOf={selectedTask}
              sprintId={selectedTask.sprintId}
              sprintName={selectedTask.sprintName ?? undefined}
            />
          )}

          {/* Open in ERP */}
          {erpUrl && (
            <p className="flex items-center gap-1 text-center text-[11px] text-soft">
              <Link2 className="h-3 w-3" />
              {selectedTask.erpDoctype ?? (isBacklog ? 'Sprint Backlogs' : 'ERPNext')} · {selectedTask.externalId}
            </p>
          )}
        </div>
      </aside>
    </>
  )
}
