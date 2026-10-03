'use client'
/**
 * Custom Gantt chart — pure React/CSS grid.
 *
 * Alignment is guaranteed by construction: every row is a single flex div
 * whose left cell is the task name and right cell is the bar canvas.
 * No post-hoc DOM sync needed.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useGanttStore } from '@/store/ganttStore'
import {
  ALMOST_OVERDUE_COLOR,
  PRIORITY_STYLES,
  STATUS_COLORS,
  isAlmostOverdue,
  isOverdueTask,
  toLocalYmd,
  type GanttTask,
  type TaskStatus,
} from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── constants ───────────────────────────────────────────────────────────────
const SIDEBAR_W   = 256   // px — task name column
const ROW_H       = 40    // px — every row
const HEADER_H    = 52    // px — date header
const COL_W_DAY   = 28    // px per day in Day/Week view
const COL_W_MONTH = 120   // px per month in Month view
const COL_W_YEAR  = 120   // px per year in Year view
const BAR_H       = 22    // px — bar height inside row
const BAR_RADIUS  = 4     // px — bar corner radius

// ─── date helpers ─────────────────────────────────────────────────────────────
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

function diffDays(a: string, b: string) {
  return Math.round(
    (new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000
  )
}

function isWeekend(iso: string) {
  const d = new Date(`${iso}T00:00:00`).getDay()
  return d === 0 || d === 6
}

function shortLabel(iso?: string) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// ─── grid builder ─────────────────────────────────────────────────────────────
type ColMode = 'day' | 'month' | 'year'

interface Col {
  iso: string          // representative date string
  label: string        // lower header label
  groupLabel?: string  // upper header label (only on first col of group)
  x: number            // pixel offset from timeline left
  w: number            // pixel width
  isWeekend: boolean
  isToday: boolean
}

function buildCols(
  from: string,
  to: string,
  mode: ColMode,
  sprintStart?: string | null,
): { cols: Col[]; totalW: number } {
  const cols: Col[] = []
  const today = ymd(new Date())

  if (mode === 'month') {
    // one column per month
    let cursor = from.slice(0, 7) + '-01'
    const end  = to.slice(0, 7) + '-01'
    let x = 0
    while (cursor <= end) {
      const d = new Date(`${cursor}T00:00:00`)
      const label = d.toLocaleString('en', { month: 'long' })
      const yearLabel = cursor.slice(0, 4)
      const prevYear = cols.length === 0 ? '' : cols.at(-1)!.iso.slice(0, 4)
      cols.push({
        iso: cursor, label, x, w: COL_W_MONTH,
        groupLabel: yearLabel !== prevYear ? yearLabel : undefined,
        isWeekend: false, isToday: today.slice(0, 7) === cursor.slice(0, 7),
      })
      x += COL_W_MONTH
      const nd = new Date(d)
      nd.setMonth(nd.getMonth() + 1)
      cursor = ymd(nd).slice(0, 7) + '-01'
    }
    return { cols, totalW: x }
  }

  if (mode === 'year') {
    let cursor = from.slice(0, 4) + '-01-01'
    const end  = to.slice(0, 4) + '-12-31'
    let x = 0
    while (cursor <= end) {
      const yr = cursor.slice(0, 4)
      const decade = String(Math.floor(Number(yr) / 10) * 10)
      const prevDecade = cols.length === 0 ? '' : String(Math.floor(Number(cols.at(-1)!.iso.slice(0, 4)) / 10) * 10)
      cols.push({
        iso: cursor, label: yr, x, w: COL_W_YEAR,
        groupLabel: decade !== prevDecade ? decade + 's' : undefined,
        isWeekend: false, isToday: today.slice(0, 4) === yr,
      })
      x += COL_W_YEAR
      const nd = new Date(`${cursor}T00:00:00`)
      nd.setFullYear(nd.getFullYear() + 1)
      cursor = ymd(nd).slice(0, 4) + '-01-01'
    }
    return { cols, totalW: x }
  }

  // day mode (Day + Week view)
  let cursor = from
  let x = 0
  let lastGroupLabel = ''
  const anchor = sprintStart || from

  while (cursor <= to) {
    const weekend = isWeekend(cursor)
    const d = new Date(`${cursor}T00:00:00`)
    const dayNum = String(d.getDate())

    // upper header: sprint week or month name
    let groupLabel: string | undefined
    const diff = diffDays(anchor, cursor)
    const weekIdx = Math.floor(diff / 7)
    const weekKey = `W${weekIdx}`
    if (weekKey !== lastGroupLabel) {
      // compute Mon–Fri range label
      const wStart = new Date(`${anchor}T00:00:00`)
      wStart.setDate(wStart.getDate() + weekIdx * 7)
      const wEnd = new Date(wStart)
      wEnd.setDate(wStart.getDate() + 4)
      const sm = wStart.toLocaleString('en', { month: 'short' })
      const em = wEnd.toLocaleString('en', { month: 'short' })
      groupLabel = sm === em
        ? `${sm} ${wStart.getDate()}–${wEnd.getDate()}`
        : `${sm} ${wStart.getDate()}–${em} ${wEnd.getDate()}`
      lastGroupLabel = weekKey
    }

    if (!weekend) {
      cols.push({
        iso: cursor, label: dayNum, x, w: COL_W_DAY,
        groupLabel, isWeekend: false, isToday: cursor === today,
      })
      x += COL_W_DAY
    }
    cursor = addDays(cursor, 1)
  }
  return { cols, totalW: x }
}

// ─── bar positioning ──────────────────────────────────────────────────────────
function barGeometry(
  start: string,
  end: string,
  cols: Col[],
  totalW: number,
): { x: number; w: number } | null {
  if (!start || !end || cols.length === 0) return null
  const firstCol = cols[0]
  const lastCol  = cols.at(-1)!
  const clampedStart = start < firstCol.iso ? firstCol.iso : start > lastCol.iso ? lastCol.iso : start
  const clampedEnd   = end   < firstCol.iso ? firstCol.iso : end   > lastCol.iso ? lastCol.iso : end

  // find x for start
  const startCol = cols.find(c => c.iso >= clampedStart)
  if (!startCol) return null
  const endCol = [...cols].reverse().find(c => c.iso <= clampedEnd)
  const x = startCol.x
  const rightEdge = endCol ? endCol.x + endCol.w : totalW
  const w = Math.max(rightEdge - x, startCol.w) // minimum one column
  return { x, w }
}

// ─── color helpers ────────────────────────────────────────────────────────────
const ERP_STATUS_BUCKET: Record<string, TaskStatus> = {
  'open': 'In Progress', 'working': 'In Progress',
  'on hold': 'Not Started', 'pending': 'Not Started',
  'cancelled': 'Blocked', 'closed': 'Completed', 'completed': 'Completed',
  'testing': 'In Progress', 'qa': 'In Progress', 'review': 'In Progress',
}

function taskColor(task: GanttTask, colors: Record<TaskStatus, string>): string {
  if (isOverdueTask(task))    return colors.Overdue
  if (isAlmostOverdue(task))  return ALMOST_OVERDUE_COLOR
  const erp = task.erpStatus?.trim().toLowerCase()
  const bucket = erp ? ERP_STATUS_BUCKET[erp] : undefined
  return bucket ? colors[bucket] : colors[task.status] ?? colors['Not Started']
}

function isLightColor(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160
}

// ─── drag-to-resize state ─────────────────────────────────────────────────────
interface DragState {
  taskId: string
  type: 'move' | 'left' | 'right'
  startX: number
  origStart: string
  origEnd: string
}

// ─── component ────────────────────────────────────────────────────────────────
interface Props {
  tasks: GanttTask[]
  colors?: Record<TaskStatus, string>
}

export function GanttChart({ tasks, colors = STATUS_COLORS }: Props) {
  const { viewMode, selectTask, chartFrom, chartTo } = useGanttStore()
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const qc = useQueryClient()

  const scrollRef   = useRef<HTMLDivElement>(null)
  const headerRef   = useRef<HTMLDivElement>(null)
  const dragRef     = useRef<DragState | null>(null)
  const [dragOffsets, setDragOffsets] = useState<Record<string, { dx: number; dw: number; side: 'left' | 'right' | 'move' }>>({})

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; startDate?: string; endDate?: string; progress?: number }) =>
      fetch(`/api/tasks/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueriesData({ queryKey: ['tasks'] }, (old: { tasks?: GanttTask[] } | undefined) => {
        if (!old?.tasks || !data?.task) return old
        return { ...old, tasks: old.tasks.map(t => t.id === data.task.id ? { ...t, ...data.task } : t) }
      })
    },
  })

  // derive col mode
  const colMode: ColMode = viewMode === 'Month' ? 'month' : viewMode === 'Year' ? 'year' : 'day'
  const colW = colMode === 'day' ? COL_W_DAY : colMode === 'month' ? COL_W_MONTH : COL_W_YEAR

  // build columns
  const { cols, totalW } = useMemo(() => {
    const starts = tasks.map(t => t.start).filter(Boolean).sort()
    const ends   = tasks.map(t => t.end).filter(Boolean).sort()
    const from   = chartFrom || starts[0] || ymd(new Date())
    const rawTo  = chartTo && chartTo >= from ? chartTo : (ends.at(-1) || from)
    // pad right by one week so the last bar has breathing room
    const to     = colMode === 'day' ? addDays(rawTo, 7) : rawTo
    return buildCols(from, to, colMode, chartFrom || null)
  }, [tasks, chartFrom, chartTo, colMode])

  // scroll to today / sprint start on mount and when sprint changes
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || cols.length === 0) return
    const target = chartFrom || ymd(new Date())
    const col = cols.find(c => c.iso >= target) ?? cols[0]
    // scroll so target is ~10% from left edge
    const offset = Math.max(0, col.x + SIDEBAR_W - Math.round(el.clientWidth * 0.1))
    el.scrollLeft = offset
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartFrom, cols.length > 0 ? cols[0].iso : ''])

  // sync sticky header scroll with body
  useEffect(() => {
    const body = scrollRef.current
    if (!body) return
    const onScroll = () => {
      // The header is inside the same scroll container — nothing to sync.
      // This ref is kept for potential future use.
    }
    body.addEventListener('scroll', onScroll, { passive: true })
    return () => body.removeEventListener('scroll', onScroll)
  }, [])

  // ── drag handlers ──────────────────────────────────────────────────────────
  const onBarMouseDown = useCallback((
    e: React.MouseEvent,
    task: GanttTask,
    type: 'move' | 'left' | 'right',
  ) => {
    if (e.button !== 0) return
    e.stopPropagation()
    dragRef.current = {
      taskId: task.id, type,
      startX: e.clientX,
      origStart: task.start,
      origEnd: task.end,
    }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const deltaPx = e.clientX - drag.startX
      const deltaDays = Math.round(deltaPx / colW)

      setDragOffsets(prev => ({
        ...prev,
        [drag.taskId]: { dx: deltaDays, dw: deltaDays, side: drag.type },
      }))
    }

    const onUp = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null

      const deltaDays = Math.round((e.clientX - drag.startX) / colW)
      let newStart = drag.origStart
      let newEnd   = drag.origEnd

      if (drag.type === 'move') {
        newStart = addDays(drag.origStart, deltaDays)
        newEnd   = addDays(drag.origEnd, deltaDays)
      } else if (drag.type === 'right') {
        newEnd = addDays(drag.origEnd, deltaDays)
        if (newEnd < newStart) newEnd = newStart
      } else {
        newStart = addDays(drag.origStart, deltaDays)
        if (newStart > newEnd) newStart = newEnd
      }

      setDragOffsets(prev => { const n = { ...prev }; delete n[drag.taskId]; return n })

      if (newStart !== drag.origStart || newEnd !== drag.origEnd) {
        updateMutation.mutate({ id: drag.taskId, startDate: newStart, endDate: newEnd })
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colW])

  // ── today marker ──────────────────────────────────────────────────────────
  const todayCol = cols.find(c => c.isToday)
  // weekends have no column in day view → put the line in the Fri/Mon gap so "today" is never missing
  const todayIso = ymd(new Date())
  const nextCol  = !todayCol && colMode === 'day' && cols.length && todayIso > cols[0].iso
    ? cols.find(c => c.iso > todayIso)
    : undefined
  const todayX   = todayCol ? todayCol.x + todayCol.w / 2 : nextCol ? nextCol.x : null

  return (
    <div className="relative flex h-full min-h-0 flex-col select-none">
      {/* ── scroll container ─────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-auto min-h-0">
        {/* min-width forces horizontal scroll when cols overflow */}
        <div style={{ minWidth: SIDEBAR_W + totalW, position: 'relative' }}>

          {/* ── sticky header row ────────────────────────────────────────── */}
          <div
            ref={headerRef}
            className="sticky top-0 z-30 flex bg-panel border-b border-line"
            style={{ height: HEADER_H }}
          >
            {/* task column header */}
            <div
              className="sticky left-0 z-40 flex shrink-0 items-end justify-between border-r border-line bg-panel px-3 pb-2"
              style={{ width: SIDEBAR_W }}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-soft">Task</span>
              <span className="text-xs font-bold tabular-nums text-ink">{tasks.length}</span>
            </div>

            {/* date columns header */}
            <div className="relative flex-1 overflow-hidden">
              {/* upper row — week / month / decade labels */}
              <div className="absolute inset-x-0 top-0 flex" style={{ height: HEADER_H / 2 }}>
                {cols.map(col =>
                  col.groupLabel ? (
                    <div
                      key={`g-${col.iso}`}
                      className="absolute flex items-center px-2 text-[11px] font-semibold text-muted"
                      style={{ left: col.x, height: HEADER_H / 2, maxWidth: COL_W_DAY * 7 }}
                    >
                      <span className="truncate">{col.groupLabel}</span>
                    </div>
                  ) : null
                )}
              </div>
              {/* lower row — day / month / year labels */}
              <div
                className="absolute inset-x-0 bottom-0 flex"
                style={{ height: HEADER_H / 2 }}
              >
                {cols.map(col => (
                  <div
                    key={col.iso}
                    className={cn(
                      'flex shrink-0 items-center justify-center border-r text-[11px] font-semibold',
                      col.isToday
                        ? 'bg-blue-600 text-white'
                        : col.isWeekend
                          ? 'text-soft bg-hover/60'
                          : 'text-muted border-line',
                    )}
                    style={{ width: col.w, height: HEADER_H / 2 }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── rows ─────────────────────────────────────────────────────── */}
          {tasks.length === 0 ? (
            <div
              className="sticky left-0 flex items-center justify-center text-sm text-soft"
              style={{ width: SIDEBAR_W, height: ROW_H * 3 }}
            >
              No tasks
            </div>
          ) : (
            tasks.map((task, idx) => {
              const overdue = isOverdueTask(task)
              const almost  = isAlmostOverdue(task)
              const color   = taskColor(task, colors)
              const light   = isLightColor(color)
              const erpStatus = task.erpStatus?.trim()

              // apply drag offsets
              const drag   = dragOffsets[task.id]
              let dispStart = task.start
              let dispEnd   = task.end
              if (drag) {
                if (drag.side === 'move')  { dispStart = addDays(task.start, drag.dx); dispEnd = addDays(task.end, drag.dx) }
                if (drag.side === 'right') { dispEnd   = addDays(task.end,   drag.dw) }
                if (drag.side === 'left')  { dispStart = addDays(task.start, drag.dx) }
              }

              const geo = barGeometry(dispStart, dispEnd, cols, totalW)

              return (
                <div
                  key={task.id}
                  className={cn(
                    'group flex border-b',
                    overdue
                      ? 'border-orange-200 bg-orange-50/60 dark:border-orange-500/20 dark:bg-orange-500/10'
                      : 'border-line bg-panel hover:bg-hover/40',
                  )}
                  style={{ height: ROW_H }}
                >
                  {/* ── task name cell (sticky) ── */}
                  <button
                    type="button"
                    onClick={() => selectTask(task)}
                    className={cn(
                      'sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r px-2 text-left',
                      overdue
                        ? 'border-orange-200 bg-orange-50/80 hover:bg-orange-100/80 dark:border-orange-500/20 dark:bg-orange-500/10 dark:hover:bg-orange-500/20'
                        : 'border-line bg-panel group-hover:bg-hover/40',
                    )}
                    style={{ width: SIDEBAR_W }}
                    title={`${task.name} · ${task.priority ?? 'No priority'} · ${shortLabel(task.start)} → ${shortLabel(task.end)}`}
                  >
                    {/* row number */}
                    <span className={cn(
                      'w-4 shrink-0 text-[10px] font-bold tabular-nums',
                      overdue ? 'text-orange-600 dark:text-orange-400' : 'text-soft',
                    )}>
                      {idx + 1}
                    </span>

                    {/* priority badge */}
                    {task.priority && PRIORITY_STYLES[task.priority] ? (
                      <span
                        className="shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide"
                        style={{
                          color: PRIORITY_STYLES[task.priority].color,
                          background: PRIORITY_STYLES[task.priority].bg,
                        }}
                      >
                        {PRIORITY_STYLES[task.priority].label[0]}
                      </span>
                    ) : (
                      <span className="w-[18px] shrink-0" />
                    )}

                    {/* name + subtext */}
                    <span className="min-w-0 flex-1">
                      <span className={cn(
                        'block truncate text-xs font-semibold leading-[1.3]',
                        overdue ? 'text-orange-800 dark:text-orange-200' : 'text-ink',
                      )}>
                        {task.name}
                      </span>
                      <span className={cn(
                        'block truncate text-[10px] leading-[1.3] tabular-nums',
                        overdue ? 'text-orange-600 dark:text-orange-400' : 'text-soft',
                      )}>
                        {erpStatus
                          ? `${erpStatus}${task.start ? ` · ${shortLabel(task.start)}` : ''}`
                          : `${shortLabel(task.start)} → ${shortLabel(task.end)}`}
                      </span>
                    </span>

                    {/* status dot */}
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: color }}
                      title={overdue ? 'Overdue' : almost ? 'Almost overdue' : (erpStatus || task.status)}
                    />
                  </button>

                  {/* ── bar canvas ── */}
                  <div
                    className="relative flex-1 overflow-hidden"
                    style={{ height: ROW_H }}
                  >
                    {/* column grid lines */}
                    {cols.map(col => (
                      <div
                        key={col.iso}
                        className={cn(
                          'absolute top-0 bottom-0 border-r',
                          col.isToday   ? 'bg-blue-50/40 border-blue-300 dark:bg-blue-900/20 dark:border-blue-600' :
                          col.isWeekend ? 'bg-hover/40 border-line/50' :
                                          'border-line/40',
                        )}
                        style={{ left: col.x, width: col.w }}
                      />
                    ))}

                    {/* today marker line */}
                    {todayX != null && (
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-blue-500/80 z-10 pointer-events-none"
                        style={{ left: todayX }}
                      />
                    )}

                    {/* bar */}
                    {geo && (
                      <div
                        className="absolute z-20 flex cursor-grab items-center overflow-hidden active:cursor-grabbing"
                        style={{
                          left: geo.x,
                          width: geo.w,
                          top: (ROW_H - BAR_H) / 2,
                          height: BAR_H,
                          borderRadius: BAR_RADIUS,
                          background: color,
                          opacity: drag ? 0.85 : 1,
                          transition: drag ? 'none' : 'opacity 0.15s',
                        }}
                        onMouseDown={e => onBarMouseDown(e, task, 'move')}
                        onClick={e => { e.stopPropagation(); selectTask(task) }}
                      >
                        {/* progress fill */}
                        {task.progress > 0 && task.status !== 'Completed' && (
                          <div
                            className="absolute left-0 top-0 bottom-0 rounded-l"
                            style={{
                              width: `${task.progress}%`,
                              background: 'rgba(0,0,0,0.2)',
                              borderRadius: BAR_RADIUS,
                            }}
                          />
                        )}

                        {/* label */}
                        {geo.w >= 40 && (
                          <span
                            className="relative z-10 truncate px-2 text-[11px] font-semibold leading-none pointer-events-none"
                            style={{ color: light ? '#1e293b' : '#ffffff' }}
                          >
                            {task.name}
                          </span>
                        )}

                        {/* left resize handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 z-30"
                          style={{ borderRadius: `${BAR_RADIUS}px 0 0 ${BAR_RADIUS}px` }}
                          onMouseDown={e => { e.stopPropagation(); onBarMouseDown(e, task, 'left') }}
                        />
                        {/* right resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 z-30"
                          style={{ borderRadius: `0 ${BAR_RADIUS}px ${BAR_RADIUS}px 0` }}
                          onMouseDown={e => { e.stopPropagation(); onBarMouseDown(e, task, 'right') }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
