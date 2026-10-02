'use client'
import { useState, useRef, useEffect } from 'react'
import {
  X, CheckCircle, Link2, RefreshCw, Save, MessageSquare,
  Send, Calendar, ChevronDown, AlertCircle,
} from 'lucide-react'
import { useGanttStore } from '@/store/ganttStore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { STATUS_COLORS, TASK_STATUSES, isOverdueTask, type TaskStatus } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'

interface Comment {
  name: string
  owner: string
  comment_by?: string
  content: string
  creation: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

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
  const [comment, setComment]     = useState('')
  const [dirty, setDirty]         = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const commentRef = useRef<HTMLTextAreaElement>(null)

  // Reset local state when task changes
  useEffect(() => {
    if (!selectedTask) return
    setStartDate(selectedTask.start || '')
    setEndDate(selectedTask.end || '')
    setSprintId(selectedTask.sprintId || '')
    setDirty(false)
    setSaveStatus('idle')
    setComment('')
  }, [selectedTask?.id])

  // ── sprints list ────────────────────────────────────────────────────────────
  const { data: sprintsData } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => fetch('/api/sprints').then(r => r.json()),
    enabled: drawerOpen,
    staleTime: 60_000,
  })
  const sprints: Array<{ id: string; externalId?: string; name: string }> = sprintsData?.sprints ?? []

  // ── comments ────────────────────────────────────────────────────────────────
  const { data: commentsData, refetch: refetchComments, isFetching: loadingComments } = useQuery({
    queryKey: ['task-comments', selectedTask?.id],
    queryFn: () => fetch(`/api/tasks/${selectedTask!.id}/comments`).then(r => r.json()),
    enabled: drawerOpen && !!selectedTask,
    staleTime: 30_000,
  })
  const comments: Comment[] = commentsData?.comments ?? []

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
      fetch(`/api/tasks/${selectedTask!.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }).then(r => r.json()),
    onSuccess: () => {
      setComment('')
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

  const color   = colors[selectedTask.status] ?? STATUS_COLORS[selectedTask.status]
  const overdue = isOverdueTask(selectedTask)
  const isBacklog = selectedTask.externalId?.startsWith('SPB-')
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
                {isBacklog ? 'Sprint Backlog' : 'Task'}
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

          {/* ── Meta grid ─────────────────────────────────────────────────── */}
          <section className="border-b border-line px-4 py-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                ['Priority',    selectedTask.priority],
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

            {/* Assignees */}
            {(selectedTask.assigneeEmail || selectedTask.assigneeName) && (
              <div className="mt-3 flex items-center gap-2">
                <Avatar name={selectedTask.assigneeName || selectedTask.assigneeEmail || '?'} />
                <div>
                  {selectedTask.assigneeName && <p className="text-xs font-medium text-ink">{selectedTask.assigneeName}</p>}
                  {selectedTask.assigneeEmail && <p className="text-[11px] text-soft">{selectedTask.assigneeEmail}</p>}
                </div>
              </div>
            )}
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
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">{stripHtml(selectedTask.description)}</p>
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
                    <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-muted">
                      {stripHtml(c.content)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* add comment */}
            <div className="mt-3 flex gap-2">
              <textarea
                ref={commentRef}
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && comment.trim()) {
                    commentMutation.mutate(comment.trim())
                  }
                }}
                placeholder="Add a comment… (⌘↵ to send)"
                rows={2}
                className="flex-1 resize-none rounded-md border border-line bg-input px-2.5 py-2 text-xs text-ink placeholder:text-soft focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
              <button
                type="button"
                disabled={!comment.trim() || commentMutation.isPending}
                onClick={() => commentMutation.mutate(comment.trim())}
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
               'Save & sync to ERP'}
            </button>
          )}

          {/* Complete */}
          {selectedTask.status !== 'Completed' && (
            <button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              {completeMutation.isPending ? 'Marking…' : 'Mark complete'}
            </button>
          )}

          {/* Open in ERP */}
          {erpUrl && (
            <p className="flex items-center gap-1 text-center text-[11px] text-soft">
              <Link2 className="h-3 w-3" />
              {isBacklog ? 'Sprint Backlogs' : 'ERPNext'} · {selectedTask.externalId}
            </p>
          )}
        </div>
      </aside>
    </>
  )
}
