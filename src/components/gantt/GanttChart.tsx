'use client'
import { useEffect, useRef } from 'react'
import { useGanttStore } from '@/store/ganttStore'
import {
  ALMOST_OVERDUE_COLOR,
  STATUS_COLORS,
  barStatusLabel,
  chartMonthStart,
  isAlmostOverdue,
  sprintWeekHeader,
  isOverdueTask,
  toLocalYmd,
  type GanttTask,
  type TaskStatus,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/components/ThemeProvider'

const RANGE_ID = 'chart-range'
const BAR_HEIGHT = 28
const ROW_PAD = 16
const ROW_HEIGHT = BAR_HEIGHT + ROW_PAD
const HEADER_HEIGHT = 68

function monthName(d: Date) {
  return d.toLocaleString('en', { month: 'long' })
}

function monthChanged(d: Date, last?: Date) {
  return !last || d.getMonth() !== last.getMonth() || d.getFullYear() !== last.getFullYear()
}

function viewModes(sprintStart?: string | null, current?: string) {
  const modes = [
  {
    name: 'Day',
    padding: ['0d', '3d'],
    step: '1d',
    date_format: 'YYYY-MM-DD',
    column_width: 38,
    lower_text: (d: Date) => String(d.getDate()),
    upper_text: (d: Date, last?: Date) => monthChanged(d, last) ? monthName(d) : '',
  },
  {
    name: 'Week',
    padding: ['0d', '7d'],
    step: '1d',
    date_format: 'YYYY-MM-DD',
    column_width: 42,
    lower_text: (d: Date) => String(d.getDate()),
    upper_text: (d: Date, last?: Date) => sprintWeekHeader(d, last, sprintStart),
  },
  {
    name: 'Month',
    padding: ['0d', '1m'],
    step: '1m',
    date_format: 'YYYY-MM',
    column_width: 120,
    lower_text: (d: Date) => monthName(d),
    upper_text: (d: Date, last?: Date) => !last || d.getFullYear() !== last.getFullYear() ? String(d.getFullYear()) : '',
  },
  {
    name: 'Year',
    padding: ['0d', '1y'],
    step: '1y',
    date_format: 'YYYY',
    column_width: 120,
    lower_text: (d: Date) => String(d.getFullYear()),
    upper_text: (d: Date, last?: Date) => {
      const decade = (date: Date) => String(date.getFullYear() - (date.getFullYear() % 10))
      return !last || decade(d) !== decade(last) ? decade(d) : ''
    },
  },
  ]
  const selected = modes.find(mode => mode.name === current)
  return selected ? [selected, ...modes.filter(mode => mode.name !== current)] : modes
}

function rangeAnchor(from: string, to: string): GanttTask {
  return {
    id: RANGE_ID,
    name: 'Chart dates (not saved)',
    start: from,
    end: to,
    progress: 0,
    status: 'Not Started',
    source: 'local',
    externalId: RANGE_ID,
  }
}

function barClass(task: GanttTask) {
  if (task.id === RANGE_ID) return 'gantt-range-anchor'
  if (isOverdueTask(task)) return 'status-overdue'
  if (isAlmostOverdue(task)) return 'status-almost-overdue'
  return `status-${task.status.replace(/\s+/g, '-').toLowerCase()}`
}

interface Props {
  tasks: GanttTask[]
  colors?: Record<TaskStatus, string>
}

export function GanttChart({ tasks, colors = STATUS_COLORS }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nameColRef = useRef<HTMLDivElement>(null)
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const { theme } = useTheme()
  const { viewMode, selectTask, chartFrom, chartTo } = useGanttStore()
  const qc = useQueryClient()
  const taskKey = tasks.map(t => `${t.id}:${t.name}:${t.status}:${t.erpStatus}:${t.devopsStatus}:${t.start}:${t.end}:${t.progress}`).join('|')

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; startDate?: string; endDate?: string; progress?: number; status?: string }) =>
      fetch(`/api/tasks/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueriesData({ queryKey: ['tasks'] }, (old: { tasks?: GanttTask[] } | undefined) => {
        if (!old?.tasks || !data?.task) return old
        return {
          ...old,
          tasks: old.tasks.map(t => t.id === data.task.id ? { ...t, ...data.task } : t),
        }
      })
    },
  })

  useEffect(() => {
    if (!containerRef.current) return
    const host = containerRef.current
    host.innerHTML = ''

    if (!document.querySelector('#frappe-gantt-css')) {
      const link = document.createElement('link')
      link.id = 'frappe-gantt-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdn.jsdelivr.net/npm/frappe-gantt@1.2.2/dist/frappe-gantt.css'
      document.head.appendChild(link)
    }

    let cancelled = false
    let saveTimer: ReturnType<typeof setTimeout> | undefined

    import('frappe-gantt').then(({ default: Gantt }) => {
      if (cancelled || !containerRef.current) return

      const ends = tasks.map(t => t.end).filter(Boolean).sort()
      const from = (viewMode === 'Week' ? chartFrom : chartMonthStart(chartFrom) || chartFrom)
        || new Date().toISOString().slice(0, 7) + '-01'
      const to = [chartTo, ends[ends.length - 1]].filter(Boolean).sort().at(-1) || from
      const visible = tasks.length > 0 ? tasks : [rangeAnchor(from, to)]
      const byExternal = new Map(visible.map(t => [t.externalId, t.id]))
      const knownIds = new Set(visible.map(t => t.id))
      const frappeTasks = visible.map(t => {
        const start = t.start && t.start < from ? from : (t.start || from)
        const deps = (t.dependencies ?? '')
          .split(',')
          .map(item => item.trim())
          .map(item => byExternal.get(item) ?? item)
          .filter(id => knownIds.has(id) && id !== t.id)
        return {
          id: t.id,
          name: t.id === RANGE_ID ? '' : barStatusLabel(t),
          start,
          end: t.end || t.start || to,
          progress: t.status === 'Completed' ? 100 : t.progress,
          custom_class: barClass(t),
          ...(deps.length ? { dependencies: deps.join(', ') } : {}),
        }
      })

      const queueSave = (payload: { id: string; startDate?: string; endDate?: string; progress?: number; status?: string }) => {
        if (payload.id === RANGE_ID) return
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => updateMutation.mutate(payload), 350)
      }

      try {
        new Gantt(host, frappeTasks, {
          view_mode: viewMode,
          view_modes: viewModes(chartFrom, viewMode),
          scroll_to: from,
          today_button: false,
          infinite_padding: false,
          readonly: false,
          readonly_dates: false,
          bar_height: BAR_HEIGHT,
          padding: ROW_PAD,
          upper_header_height: 40,
          lower_header_height: 28,
          on_click: (task: { id: string }) => {
            if (task.id === RANGE_ID) return
            const found = tasksRef.current.find(t => t.id === task.id)
            if (found) selectTask(found)
          },
          on_date_change: (task: { id: string }, start: Date, end: Date) => {
            queueSave({
              id: task.id,
              startDate: toLocalYmd(start),
              endDate: toLocalYmd(end),
            })
          },
          on_progress_change: (task: { id: string }, progress: number) => {
            queueSave({
              id: task.id,
              progress,
              ...(progress >= 100 ? { status: 'Completed' } : {}),
            })
          },
          popup: ({ task }: { task: { id: string; name: string; _start: Date; _end: Date; progress: number } }) => {
            if (task.id === RANGE_ID) {
              return 'Drag bars to change dates. Drag either end to resize.'
            }
            const t = tasksRef.current.find(g => g.id === task.id)
            const overdue = t ? isOverdueTask(t) : false
            const almost = t ? isAlmostOverdue(t) : false
            const color = overdue ? colors.Overdue : almost ? ALMOST_OVERDUE_COLOR : colors[t?.status ?? 'Not Started']
            const label = t ? barStatusLabel(t) : task.name
            return `<div style="min-width:200px">
              <strong>${t?.name ?? task.name}</strong><br/>
              <span style="color:${color}">${overdue ? 'Overdue' : almost ? 'Almost Overdue' : label}</span><br/>
              <span>${task._start?.toDateString?.() ?? ''} → ${task._end?.toDateString?.() ?? ''}</span><br/>
              Progress: ${task.progress}%
            </div>`
          },
        })
      } catch (err) {
        console.error('Gantt render failed', err)
      }

      const style = document.querySelector('#gantt-status-styles') ?? document.createElement('style')
      style.id = 'gantt-status-styles'
      style.textContent = `
        .gantt-container { background: var(--gantt-bg); padding: 0; margin: 0; }
        .gantt .bar { fill: ${colors['In Progress']}; }
        .gantt .bar-label { fill: var(--gantt-label); font-size: 12px; font-weight: 700; }
        .gantt .bar-wrapper.status-blocked .bar-label,
        .gantt .bar-wrapper.status-overdue .bar-label { fill: #fff; }
        .gantt .handle { fill: #64748b; opacity: 0.95; cursor: ew-resize; }
        .gantt .bar-wrapper { cursor: grab; }
        .gantt .bar-wrapper.status-not-started .bar { fill: ${colors['Not Started']}; }
        .gantt .bar-wrapper.status-in-progress .bar { fill: ${colors['In Progress']}; }
        .gantt .bar-wrapper.status-completed .bar   { fill: ${colors.Completed}; }
        .gantt .bar-wrapper.status-overdue .bar     { fill: ${colors.Overdue}; }
        .gantt .bar-wrapper.status-blocked .bar     { fill: ${colors.Blocked}; }
        .gantt .bar-wrapper.status-almost-overdue .bar { fill: ${ALMOST_OVERDUE_COLOR}; }
        .gantt .bar-wrapper.gantt-range-anchor .bar { fill: #475569; opacity: 0.7; }
        .gantt .lower-text, .gantt .upper-text { fill: var(--gantt-text); font-weight: 600; }
        .gantt .side-header, .gantt .today-button { display: none !important; }
        .gantt .grid-header { height: ${HEADER_HEIGHT}px; fill: var(--panel); }
        .gantt .holiday-highlight, .gantt .weekend-highlight { fill: var(--hover); }
      `
      if (!style.parentElement) document.head.appendChild(style)

      const header = nameColRef.current?.querySelector('[data-name-header]') as HTMLElement | null
      const rows = [...(nameColRef.current?.querySelectorAll('[data-name-row]') ?? [])] as HTMLElement[]
      const gridHeader = host.querySelector('.grid-header') as HTMLElement | null
      if (header && gridHeader) header.style.height = `${gridHeader.getBoundingClientRect().height || HEADER_HEIGHT}px`
      const gridRows = [...host.querySelectorAll('.grid-row')]
      gridRows.forEach((row, i) => {
        const el = rows[i]
        if (!el) return
        const height = Number((row as SVGElement).getAttribute('height')) || ROW_HEIGHT
        el.style.height = `${height}px`
      })
    })

    return () => {
      cancelled = true
      clearTimeout(saveTimer)
      host.innerHTML = ''
    }
  }, [taskKey, viewMode, colors, chartFrom, chartTo, theme])

  return (
    <div className="flex h-full min-h-[400px] flex-col">
      <p className="border-b border-line bg-panel px-4 py-1.5 text-xs text-soft">
        {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}. Week view uses one column per day, grouped from the sprint start.
      </p>
      <div className="flex min-h-0 flex-1">
        <aside ref={nameColRef} className="w-80 shrink-0 border-r border-line bg-panel">
          <div
            data-name-header
            className="flex items-end justify-between border-b border-line px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-soft"
            style={{ height: HEADER_HEIGHT }}
          >
            <span>Task</span>
            <span className="tabular-nums text-ink">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <p className="px-3 py-3 text-xs text-soft">No tasks yet</p>
          ) : (
            tasks.map((task, index) => {
              const overdue = isOverdueTask(task)
              return (
                <button
                  key={task.id}
                  data-name-row
                  type="button"
                  onClick={() => selectTask(task)}
                  className={cn(
                    'flex w-full items-center gap-2 border-b px-3 text-left',
                    overdue
                      ? 'border-orange-300 bg-orange-50 hover:bg-orange-100 dark:border-orange-500/40 dark:bg-orange-500/15 dark:hover:bg-orange-500/25'
                      : 'border-line hover:bg-hover',
                  )}
                  style={{ height: ROW_HEIGHT }}
                  title={task.name}
                >
                  <span className={cn('w-5 shrink-0 text-xs font-bold tabular-nums', overdue ? 'text-orange-700 dark:text-orange-300' : 'text-soft')}>
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-semibold', overdue ? 'text-orange-800 dark:text-orange-200' : 'text-ink')}>
                      {task.name}
                    </span>
                    {task.externalId && !task.externalId.startsWith('local-') && (
                      <span className={cn('block truncate text-[11px]', overdue ? 'text-orange-700 dark:text-orange-300/80' : 'text-soft')}>
                        {task.externalId}
                      </span>
                    )}
                  </span>
                </button>
              )
            })
          )}
        </aside>
        <div
          ref={containerRef}
          data-testid="gantt-chart"
          className="min-h-[400px] min-w-0 flex-1 overflow-x-auto"
        />
      </div>
    </div>
  )
}
