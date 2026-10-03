'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { TaskDrawer } from '@/components/gantt/TaskDrawer'
import { useGanttStore } from '@/store/ganttStore'
import {
  LIVE_SYNC_MS, PRIORITY_STYLES, STATUS_COLORS, isOverdueTask, priorityRank, sprintAnalytics,
  type GanttTask, type TaskStatus, type TeamMember,
} from '@/lib/types'
import { cn, dayDiff, formatDate, initials } from '@/lib/utils'

interface SprintOption { id: string; name: string; externalId?: string; startDate?: string; endDate?: string; status?: string }

const owns = (t: GanttTask, email: string) => {
  const e = email.toLowerCase()
  return [t.assigneeEmail, t.currentAssignee, t.devAssignee].some(v => v?.toLowerCase() === e)
}
const points = (ts: GanttTask[]) => ts.reduce((n, t) => n + (Number(t.sprintPoints) || 0), 0)
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

function Avatar({ label, you }: { label?: string | null; you?: boolean }) {
  return (
    <span aria-hidden="true" className={cn(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
      you ? 'bg-blue-600 text-white' : 'bg-hover text-muted',
    )}>{initials(label)}</span>
  )
}

function Bar({ value, tone, label }: { value: number; tone: string; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}
      className="h-2 overflow-hidden rounded-full bg-hover">
      <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${value}%` }} />
    </div>
  )
}

/* ── where the sprint stands: time used vs work done ─────────────────────── */
function SprintSummary({ sprint, tasks }: { sprint: SprintOption; tasks: GanttTask[] }) {
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

  return (
    <section aria-label="Sprint summary" className="rounded-2xl border border-line bg-panel p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-lg font-semibold text-ink">{sprint.name}</h2>
        {start && end && <p className="text-sm text-muted">{formatDate(start)} – {formatDate(end)}</p>}
      </div>
      {phase && (
        <p className="mt-1 flex items-center gap-2 text-sm">
          <span className="text-muted">{phase}</span>
          {running && stats.total > 0 && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold',
              behind ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}>
              {behind ? 'Behind schedule' : 'On track'}
            </span>
          )}
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-muted">Time elapsed</span>
            <span className="font-semibold tabular-nums text-ink">{timePct}%</span>
          </div>
          <Bar value={timePct} tone="bg-slate-400 dark:bg-slate-500" label="Time elapsed" />
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-muted">Work done{pts > 0 && <span className="text-soft"> · {ptsDone}/{pts} pts</span>}</span>
            <span className="font-semibold tabular-nums text-ink">{workPct}%</span>
          </div>
          <Bar value={workPct} tone={behind ? 'bg-orange-500' : 'bg-emerald-500'} label="Work done" />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {[
          ['Tasks', stats.total, 'text-ink'],
          ['In progress', stats.ongoing, 'text-ink'],
          ['Done', stats.completed, 'text-emerald-700 dark:text-emerald-400'],
          ['Overdue', stats.overdue, stats.overdue ? 'text-orange-600 dark:text-orange-400' : 'text-soft'],
        ].map(([label, value, tone]) => (
          <div key={label as string} className="bg-panel px-4 py-3">
            <dt className="text-xs text-soft">{label}</dt>
            <dd className={cn('mt-0.5 text-2xl font-semibold tabular-nums', tone as string)}>{value}</dd>
          </div>
        ))}
      </dl>
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

  // overdue first, then priority, then soonest due
  const sortedTasks = [...tasks].sort((a, b) =>
    Number(isOverdueTask(b)) - Number(isOverdueTask(a))
    || priorityRank(a.priority) - priorityRank(b.priority)
    || (a.end || '').localeCompare(b.end || ''))

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Dashboard"
          description="How the sprint and the team are tracking."
          actions={
            <div className="relative w-full sm:w-auto">
              <label htmlFor="dash-sprint" className="sr-only">Sprint</label>
              <select
                id="dash-sprint"
                value={sprintId}
                onChange={e => setPicked(e.target.value)}
                disabled={sprintsLoading}
                className="h-10 w-full appearance-none sm:w-auto sm:min-w-[260px] rounded-lg border border-line bg-panel pl-3 pr-9 text-sm font-medium text-ink shadow-sm focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/15 disabled:opacity-60"
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

        {sprintsLoading || (isLoading && !data) ? (
          <div className="h-[260px] animate-pulse rounded-2xl border border-line bg-panel" aria-label="Loading sprint" />
        ) : sprint ? (
          <SprintSummary sprint={sprint} tasks={tasks} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            No sprints yet. Create one from the Gantt chart.
          </p>
        )}

        {/* ── team ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="team-h">
          <h2 id="team-h" className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
            <Users className="h-4 w-4 text-blue-600" /> Team
          </h2>
          {members.length === 0 ? (
            <p className="text-sm text-soft">
              No team members yet. Add them in <Link href="/settings" className="text-blue-600 hover:underline">Settings → Team</Link>.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-soft">
                    <th scope="col" className="px-5 py-3 font-medium">Member</th>
                    <th scope="col" className="w-[30%] px-5 py-3 font-medium">Completion</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Tasks</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">In progress</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Done</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Overdue</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map(r => {
                    const you = isMe(r.member)
                    const idle = r.total === 0
                    return (
                      <tr key={r.member.email} className={cn('border-t border-line first:border-t-0', you && 'bg-blue-500/[.04]')}>
                        <td className="px-5 py-3">
                          <div className={cn('flex items-center gap-3', idle && 'opacity-60')}>
                            <Avatar label={r.member.name || r.member.email} you={you} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">
                                {r.member.name || r.member.email.split('@')[0]}
                                {you && <span className="ml-2 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">You</span>}
                              </p>
                              <p className="truncate text-xs text-soft">{r.member.role ? `${r.member.role} · ` : ''}{r.member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {idle ? <span className="text-xs text-soft">No tasks this sprint</span> : (
                            <div className="flex items-center gap-3">
                              <div className="flex-1"><Bar value={r.pct} tone="bg-emerald-500" label={`${r.member.name || r.member.email} completion`} /></div>
                              <span className="w-10 text-right text-xs font-semibold tabular-nums text-ink">{r.pct}%</span>
                            </div>
                          )}
                        </td>
                        <td className={cn('px-3 py-3 text-right tabular-nums', idle ? 'text-soft' : 'text-ink')}>{r.total}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted">{r.ongoing || '–'}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{r.completed || <span className="text-soft">–</span>}</td>
                        <td className={cn('px-3 py-3 text-right tabular-nums', r.overdue ? 'font-semibold text-orange-600' : 'text-soft')}>{r.overdue || '–'}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted">{r.points ? `${r.pointsDone}/${r.points}` : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {unowned > 0 && (
                <p className="border-t border-line px-5 py-2.5 text-xs text-soft">
                  {unowned} task{unowned !== 1 ? 's are' : ' is'} assigned to people outside the team list.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── tasks ─────────────────────────────────────────────────────── */}
        {tasks.length > 0 && (
          <section aria-labelledby="tasks-h">
            <h2 id="tasks-h" className="mb-3 text-base font-semibold text-ink">
              Tasks <span className="font-normal text-soft">({tasks.length})</span>
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-soft">
                    <th scope="col" className="px-5 py-3 font-medium">Task</th>
                    <th scope="col" className="px-3 py-3 font-medium">Assignee</th>
                    <th scope="col" className="px-3 py-3 font-medium">Priority</th>
                    <th scope="col" className="px-3 py-3 font-medium">Status</th>
                    <th scope="col" className="px-5 py-3 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map(task => {
                    const overdue = isOverdueTask(task)
                    const who = task.currentAssignee || task.assigneeEmail || task.devAssignee
                    const pr = task.priority ? PRIORITY_STYLES[task.priority] : undefined
                    const color = colors[task.status] ?? STATUS_COLORS[task.status]
                    const dueIn = task.end ? dayDiff(new Date(), task.end) : null
                    return (
                      <tr key={task.id} onClick={() => selectTask(task)}
                        className="cursor-pointer border-t border-line first:border-t-0 hover:bg-hover/60">
                        <td className="max-w-[420px] px-5 py-3">
                          <button type="button" onClick={e => { e.stopPropagation(); selectTask(task) }}
                            className="block max-w-full truncate text-left font-medium text-ink hover:underline focus-visible:underline focus-visible:outline-none">
                            {task.name}
                          </button>
                          <span className="text-xs text-soft">{task.externalId}</span>
                        </td>
                        <td className="px-3 py-3">
                          {who ? (
                            <span className="flex items-center gap-2 text-muted">
                              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-hover text-[10px] font-bold">{initials(nameFor(who))}</span>
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
                          {dueIn !== null && task.status !== 'Completed' && (
                            <span className={cn('ml-2 text-xs', overdue ? 'text-orange-600' : 'text-soft')}>
                              {overdue ? <><AlertTriangle className="mb-0.5 inline h-3 w-3" /> {Math.abs(dueIn)}d late</> : dueIn === 0 ? 'today' : `in ${dueIn}d`}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      <TaskDrawer colors={colors} />
    </div>
  )
}
