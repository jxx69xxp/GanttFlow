'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, CircleDot, ListTodo, Users, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { TaskDrawer } from '@/components/gantt/TaskDrawer'
import { useGanttStore } from '@/store/ganttStore'
import {
  LIVE_SYNC_MS, PRIORITY_STYLES, STATUS_COLORS, TASK_STATUSES, isOverdueTask, priorityRank, sprintAnalytics,
  type GanttTask, type TaskStatus, type TeamMember,
} from '@/lib/types'
import { cn, dayDiff, formatDate, initials } from '@/lib/utils'

interface SprintOption { id: string; name: string; externalId?: string; startDate?: string; endDate?: string; status?: string }
type Filter = 'all' | 'mine' | 'overdue' | 'soon'

const owns = (t: GanttTask, email: string) => {
  const e = email.toLowerCase()
  return [t.assigneeEmail, t.currentAssignee, t.devAssignee].some(v => v?.toLowerCase() === e)
}
const points = (ts: GanttTask[]) => ts.reduce((n, t) => n + (Number(t.sprintPoints) || 0), 0)
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
/** days until due for open tasks; null when done or undated */
const dueIn = (t: GanttTask) => (t.end && t.status !== 'Completed' ? dayDiff(new Date(), t.end) : null)
const dueSoon = (t: GanttTask) => { const d = dueIn(t); return d !== null && d >= 0 && d <= 2 && !isOverdueTask(t) }

const CARD = 'rounded-2xl border border-line bg-panel'
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50'

function Avatar({ label, you, size = 'md' }: { label?: string | null; you?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span aria-hidden="true" className={cn(
      'flex shrink-0 items-center justify-center rounded-full font-bold',
      size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-9 w-9 text-xs',
      you ? 'bg-blue-600 text-white' : 'bg-hover text-muted',
    )}>{initials(label)}</span>
  )
}

/* ── two concentric rings: outer = time used, inner = work done ─────────────── */
function ProgressRing({ work, time, behind }: { work: number; time: number; behind: boolean }) {
  const ring = (r: number, value: number, cls: string, w: number) => {
    const c = 2 * Math.PI * r
    return (
      <>
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth={w} className="stroke-[var(--hover)]" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth={w} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          className={cn(cls, 'motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700')} />
      </>
    )
  }
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img"
        aria-label={`${work}% of work done, ${time}% of sprint time elapsed`}>
        {ring(54, time, 'stroke-slate-400 dark:stroke-slate-500', 5)}
        {ring(42, work, behind ? 'stroke-orange-500' : 'stroke-emerald-500', 11)}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-ink">{work}%</span>
        <span className="text-[11px] text-soft">done</span>
      </div>
    </div>
  )
}

/* ── hero: sprint phase, health, ring, KPIs ─────────────────────────────────── */
function SprintHero({ sprint, tasks }: { sprint: SprintOption; tasks: GanttTask[] }) {
  const stats = sprintAnalytics(tasks)
  const start = sprint.startDate, end = sprint.endDate
  const length = start && end ? dayDiff(start, end) + 1 : 0
  const today = new Date()
  const untilStart = start ? dayDiff(today, start) : 0
  const sinceEnd = end ? dayDiff(end, today) : 0
  const dayN = start ? dayDiff(start, today) + 1 : 0

  const phase = !length ? null
    : untilStart > 0 ? (untilStart === 1 ? 'Starts tomorrow' : `Starts in ${untilStart} days`)
    : sinceEnd > 0 ? (sinceEnd === 1 ? 'Ended yesterday' : `Ended ${sinceEnd} days ago`)
    : `Day ${dayN} of ${length} · ${length - dayN === 0 ? 'last day' : `${length - dayN} days left`}`
  const timePct = !length ? 0 : untilStart > 0 ? 0 : sinceEnd > 0 ? 100 : pct(dayN, length)
  const workPct = pct(stats.completed, stats.total)
  const running = length > 0 && untilStart <= 0 && sinceEnd <= 0
  const behind = running && stats.total > 0 && workPct + 15 < timePct
  const pts = points(tasks), ptsDone = points(tasks.filter(t => t.status === 'Completed'))

  const kpis = [
    { label: 'Tasks', value: stats.total, icon: ListTodo, tone: 'text-ink' },
    { label: 'In progress', value: stats.ongoing, icon: CircleDot, tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Done', value: stats.completed, icon: CheckCircle2, tone: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, tone: stats.overdue ? 'text-orange-600 dark:text-orange-400' : 'text-soft' },
  ]

  return (
    <section aria-label="Sprint summary" className={cn(CARD, 'p-5 sm:p-6')}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <ProgressRing work={workPct} time={timePct} behind={behind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-bold tracking-tight text-ink">{sprint.name}</h2>
            {running && stats.total > 0 && (
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold',
                behind ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}>
                {behind ? 'Behind schedule' : 'On track'}
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {start && end && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-soft" aria-hidden="true" />{formatDate(start)} – {formatDate(end)}</span>}
            {phase && <span>{phase}</span>}
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
            <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" aria-hidden="true" />Time elapsed <b className="tabular-nums text-ink">{timePct}%</b></li>
            <li className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', behind ? 'bg-orange-500' : 'bg-emerald-500')} aria-hidden="true" />Work done <b className="tabular-nums text-ink">{workPct}%</b></li>
            {pts > 0 && <li>Points <b className="tabular-nums text-ink">{ptsDone}/{pts}</b></li>}
          </ul>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl bg-input px-4 py-3">
            <dt className="flex items-center gap-1.5 text-xs text-soft"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</dt>
            <dd className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ── status mix as one stacked bar + labelled legend (not colour alone) ─────── */
function StatusBreakdown({ tasks, colors }: { tasks: GanttTask[]; colors: Record<TaskStatus, string> }) {
  const counts = TASK_STATUSES.map(s => ({ status: s, n: tasks.filter(t => t.status === s).length })).filter(c => c.n)
  return (
    <section aria-labelledby="status-h" className={cn(CARD, 'p-5')}>
      <h2 id="status-h" className="text-sm font-semibold text-ink">Status breakdown</h2>
      {counts.length === 0 ? <p className="mt-3 text-sm text-soft">No tasks yet.</p> : (
        <>
          <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {counts.map(c => <div key={c.status} style={{ flexGrow: c.n, background: colors[c.status] ?? STATUS_COLORS[c.status] }} />)}
          </div>
          <ul className="mt-4 space-y-2">
            {counts.map(c => (
              <li key={c.status} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[c.status] ?? STATUS_COLORS[c.status] }} aria-hidden="true" />
                <span className="text-muted">{c.status}</span>
                <span className="ml-auto font-semibold tabular-nums text-ink">{c.n}</span>
                <span className="w-10 text-right text-xs tabular-nums text-soft">{pct(c.n, tasks.length)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/* ── overdue + due within 2 days, worst first ───────────────────────────────── */
function NeedsAttention({ tasks, nameFor, onOpen }: { tasks: GanttTask[]; nameFor: (e?: string | null) => string | null; onOpen: (t: GanttTask) => void }) {
  const list = tasks.filter(t => isOverdueTask(t) || dueSoon(t))
    .sort((a, b) => (dueIn(a) ?? 0) - (dueIn(b) ?? 0) || priorityRank(a.priority) - priorityRank(b.priority))
  return (
    <section aria-labelledby="attn-h" className={cn(CARD, 'flex flex-col p-5 lg:col-span-2')}>
      <h2 id="attn-h" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <AlertTriangle className="h-4 w-4 text-orange-500" aria-hidden="true" /> Needs attention
        {list.length > 0 && <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">{list.length}</span>}
      </h2>
      {list.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-soft"><CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />Nothing overdue or due in the next 2 days.</p>
      ) : (
        <ul className="-mx-2 mt-2 max-h-64 overflow-y-auto">
          {list.map(t => {
            const d = dueIn(t) ?? 0
            const late = isOverdueTask(t)
            const who = nameFor(t.currentAssignee || t.assigneeEmail || t.devAssignee)
            return (
              <li key={t.id}>
                <button type="button" onClick={() => onOpen(t)}
                  className={cn('flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover', FOCUS)}>
                  <span className={cn('w-16 shrink-0 text-xs font-semibold tabular-nums', late ? 'text-orange-600 dark:text-orange-400' : 'text-amber-700 dark:text-amber-300')}>
                    {late ? `${Math.abs(d)}d late` : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d}d`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.name}</span>
                  <span className="hidden max-w-[120px] truncate text-xs text-soft sm:inline">{who ?? 'Unassigned'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function DashboardPage() {
  const { data: sprintsData, isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => fetch('/api/sprints').then(r => r.json()),
  })
  const sprints: SprintOption[] = sprintsData?.sprints ?? []
  const selectTask = useGanttStore(s => s.selectTask)  // same drawer as clicking a bar in the Gantt
  const [picked, setPicked] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [person, setPerson] = useState<string | null>(null)  // team card click → filter tasks
  const sprint = sprints.find(s => (s.externalId || s.id) === picked) ?? sprints[0]
  const sprintId = sprint?.externalId || sprint?.id || ''

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', sprintId, 'dashboard'],
    queryFn: () => fetch(`/api/tasks?sprintId=${encodeURIComponent(sprintId)}`).then(r => r.json()),
    enabled: Boolean(sprintId),
    staleTime: 0,
    refetchInterval: LIVE_SYNC_MS,
    refetchOnWindowFocus: true,
  })
  const tasks: GanttTask[] = data?.tasks ?? []

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
    staleTime: Infinity,
  })
  const colors: Record<TaskStatus, string> = settings?.statusColors ?? STATUS_COLORS

  const { data: meData } = useQuery<{ email: string | null }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me').then(r => r.json()),
    staleTime: Infinity,
  })
  const me = meData?.email?.toLowerCase() ?? ''
  const isMe = (m: TeamMember) => !!me && m.email.toLowerCase() === me
  const teamList: TeamMember[] = (settings?.teamMembers ?? []).filter((m: TeamMember) => m.isActive)
  const members: TeamMember[] = me && !teamList.some(isMe)
    ? [{ id: 'me', email: meData!.email!, name: null, role: null, isActive: true }, ...teamList]
    : teamList
  const nameFor = (email?: string | null) => {
    const m = email ? teamList.find(t => t.email.toLowerCase() === email.toLowerCase()) : undefined
    return m?.name || email?.split('@')[0] || null
  }

  const team = members.map(m => {
    const mine = tasks.filter(t => owns(t, m.email))
    const stats = sprintAnalytics(mine)
    return {
      member: m, ...stats,
      pct: pct(stats.completed, stats.total),
      points: points(mine),
      pointsDone: points(mine.filter(t => t.status === 'Completed')),
    }
  }).sort((a, b) => Number(isMe(b.member)) - Number(isMe(a.member)) || b.total - a.total)
  const unowned = tasks.filter(t => !members.some(m => owns(t, m.email))).length

  const FILTERS: Array<{ id: Filter; label: string; test: (t: GanttTask) => boolean }> = [
    { id: 'all', label: 'All', test: () => true },
    ...(me ? [{ id: 'mine' as const, label: 'Mine', test: (t: GanttTask) => owns(t, me) }] : []),
    { id: 'overdue', label: 'Overdue', test: isOverdueTask },
    { id: 'soon', label: 'Due soon', test: dueSoon },
  ]
  const activeTest = FILTERS.find(f => f.id === filter)?.test ?? (() => true)
  // overdue first, then priority, then soonest due
  const shownTasks = tasks
    .filter(t => activeTest(t) && (!person || owns(t, person)))
    .sort((a, b) =>
      Number(isOverdueTask(b)) - Number(isOverdueTask(a))
      || priorityRank(a.priority) - priorityRank(b.priority)
      || (a.end || '').localeCompare(b.end || ''))

  const loading = sprintsLoading || (isLoading && !data)

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Dashboard"
          description="How the sprint and the team are tracking."
          actions={
            <div className="relative w-full sm:w-auto">
              <label htmlFor="dash-sprint" className="sr-only">Sprint</label>
              <select
                id="dash-sprint"
                value={sprintId}
                onChange={e => { setPicked(e.target.value); setPerson(null) }}
                disabled={sprintsLoading}
                className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-line bg-panel pl-3 pr-9 text-sm font-medium text-ink focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/15 disabled:opacity-60 sm:w-auto sm:min-w-[280px]"
              >
                {sprintsLoading && <option value="">Loading sprints…</option>}
                {!sprintsLoading && sprints.length === 0 && <option value="">No sprints</option>}
                {sprints.map(s => (
                  <option key={s.externalId || s.id} value={s.externalId || s.id}>
                    {s.name}{s.startDate ? ` · ${formatDate(s.startDate)}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
            </div>
          }
        />

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-3" aria-label="Loading sprint">
            <div className={cn(CARD, 'h-[300px] animate-pulse lg:col-span-3')} />
            <div className={cn(CARD, 'h-[220px] animate-pulse')} />
            <div className={cn(CARD, 'h-[220px] animate-pulse lg:col-span-2')} />
          </div>
        ) : !sprint ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            No sprints yet. Create one from the Gantt chart.
          </p>
        ) : (
          <>
            <SprintHero sprint={sprint} tasks={tasks} />
            <div className="grid gap-6 lg:grid-cols-3">
              <StatusBreakdown tasks={tasks} colors={colors} />
              <NeedsAttention tasks={tasks} nameFor={nameFor} onOpen={selectTask} />
            </div>
          </>
        )}

        {/* ── team ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="team-h">
          <h2 id="team-h" className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
            <Users className="h-4 w-4 text-blue-600" aria-hidden="true" /> Team
            <span className="text-xs font-normal text-soft">· click a person to filter tasks</span>
          </h2>
          {members.length === 0 ? (
            <p className="text-sm text-soft">
              No team members yet. Add them in <Link href="/settings" className="text-blue-600 hover:underline">Settings → Team</Link>.
            </p>
          ) : (
            <>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {team.map(r => {
                  const you = isMe(r.member)
                  const idle = r.total === 0
                  const on = person?.toLowerCase() === r.member.email.toLowerCase()
                  const label = r.member.name || r.member.email.split('@')[0]
                  return (
                    <li key={r.member.email}>
                      <button type="button" aria-pressed={on} onClick={() => setPerson(on ? null : r.member.email)}
                        className={cn(CARD, FOCUS, 'w-full cursor-pointer p-4 text-left transition-colors duration-150 hover:border-blue-400',
                          on && 'border-blue-600 ring-1 ring-blue-600', idle && 'opacity-70')}>
                        <div className="flex items-center gap-3">
                          <Avatar label={r.member.name || r.member.email} you={you} />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                              <span className="truncate">{label}</span>
                              {you && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">You</span>}
                            </p>
                            <p className="truncate text-xs text-soft">{r.member.role || r.member.email}</p>
                          </div>
                          <span className="text-lg font-bold tabular-nums text-ink">{idle ? '–' : `${r.pct}%`}</span>
                        </div>
                        {/* done / active / overdue share of this person's tasks */}
                        <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-hover" aria-hidden="true">
                          {r.completed > 0 && <div className="bg-emerald-500" style={{ flexGrow: r.completed }} />}
                          {r.ongoing > 0 && <div className="bg-blue-500" style={{ flexGrow: r.ongoing }} />}
                          {r.overdue > 0 && <div className="bg-orange-500" style={{ flexGrow: r.overdue }} />}
                        </div>
                        <p className="mt-2 flex flex-wrap gap-x-3 text-xs tabular-nums text-muted">
                          {idle ? <span className="text-soft">No tasks this sprint</span> : <>
                            <span>{r.total} tasks</span>
                            <span className="text-emerald-700 dark:text-emerald-400">{r.completed} done</span>
                            <span>{r.ongoing} active</span>
                            {r.overdue > 0 && <span className="font-semibold text-orange-600 dark:text-orange-400">{r.overdue} overdue</span>}
                            {r.points > 0 && <span className="ml-auto text-soft">{r.pointsDone}/{r.points} pts</span>}
                          </>}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {unowned > 0 && (
                <p className="mt-2 text-xs text-soft">
                  {unowned} task{unowned !== 1 ? 's are' : ' is'} assigned to people outside the team list.
                </p>
              )}
            </>
          )}
        </section>

        {/* ── tasks ─────────────────────────────────────────────────────── */}
        {tasks.length > 0 && (
          <section aria-labelledby="tasks-h">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 id="tasks-h" className="mr-2 text-base font-semibold text-ink">
                Tasks <span className="font-normal text-soft">({shownTasks.length})</span>
              </h2>
              <div role="group" aria-label="Filter tasks" className="flex flex-wrap gap-1.5">
                {FILTERS.map(f => (
                  <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                    className={cn('h-8 cursor-pointer rounded-full border px-3 text-xs font-medium transition-colors duration-150', FOCUS,
                      filter === f.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-line bg-panel text-muted hover:bg-hover hover:text-ink')}>
                    {f.label}
                  </button>
                ))}
                {person && (
                  <button type="button" onClick={() => setPerson(null)}
                    className={cn('flex h-8 cursor-pointer items-center gap-1 rounded-full bg-blue-600/10 px-3 text-xs font-medium text-blue-700 hover:bg-blue-600/20 dark:text-blue-300', FOCUS)}
                    aria-label={`Clear filter: ${nameFor(person)}`}>
                    {nameFor(person)} <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <div className={cn(CARD, 'overflow-x-auto')}>
              {shownTasks.length === 0 ? (
                <p className="p-8 text-center text-sm text-soft">No tasks match this filter.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-input text-left text-xs text-soft">
                      <th scope="col" className="px-5 py-2.5 font-medium">Task</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Assignee</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Priority</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                      <th scope="col" className="px-5 py-2.5 font-medium">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownTasks.map(task => {
                      const overdue = isOverdueTask(task)
                      const who = task.currentAssignee || task.assigneeEmail || task.devAssignee
                      const pr = task.priority ? PRIORITY_STYLES[task.priority] : undefined
                      const color = colors[task.status] ?? STATUS_COLORS[task.status]
                      const d = dueIn(task)
                      return (
                        <tr key={task.id} onClick={() => selectTask(task)}
                          className="cursor-pointer border-t border-line first:border-t-0 hover:bg-hover/60">
                          <td className="max-w-[420px] px-5 py-3">
                            <button type="button" onClick={e => { e.stopPropagation(); selectTask(task) }}
                              className="block max-w-full truncate text-left font-medium text-ink hover:underline focus-visible:underline focus-visible:outline-none">
                              {task.name}
                            </button>
                            <span className="font-mono text-[11px] text-soft">{task.externalId}</span>
                          </td>
                          <td className="px-3 py-3">
                            {who ? (
                              <span className="flex items-center gap-2 text-muted">
                                <Avatar label={nameFor(who)} size="sm" />
                                <span className="truncate">{nameFor(who)}</span>
                              </span>
                            ) : <span className="text-soft">Unassigned</span>}
                          </td>
                          <td className="px-3 py-3">
                            {task.priority ? (
                              <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
                                style={pr ? { color: pr.color, background: `${pr.color}1a` } : undefined}>
                                {task.priority}
                              </span>
                            ) : <span className="text-soft">–</span>}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted">
                              <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
                              {task.erpStatus || task.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">
                            <span className={cn(overdue ? 'font-semibold text-orange-600' : 'text-muted')}>{formatDate(task.end)}</span>
                            {d !== null && (
                              <span className={cn('ml-2 text-xs', overdue ? 'text-orange-600' : 'text-soft')}>
                                {overdue ? <><AlertTriangle className="mb-0.5 inline h-3 w-3" aria-hidden="true" /> {Math.abs(d)}d late</> : d === 0 ? 'today' : `in ${d}d`}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </div>
      <TaskDrawer colors={colors} />
    </div>
  )
}
