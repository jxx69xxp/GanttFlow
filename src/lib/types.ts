export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Overdue' | 'Blocked'
export type ViewMode = 'Day' | 'Week' | 'Month' | 'Year'

export interface GanttTask {
  id: string
  name: string
  start: string
  end: string
  progress: number
  dependencies?: string
  custom_class?: string
  // extended
  status: TaskStatus
  erpStatus?: string | null
  devopsStatus?: string | null
  assigneeEmail?: string | null
  projectName?: string | null
  sprintName?: string | null
  sprintId?: string | null
  description?: string | null
  priority?: string | null
  workType?: string | null
  sprintPoints?: string | null
  module?: string | null
  assigneeName?: string | null
  qaAssignee?: string | null
  dateAssigned?: string | null
  parentBacklogId?: string | null
  parentBacklogName?: string | null
  source: string
  externalId: string
}

export interface GanttBoard {
  id: string
  name: string
  startDate: string
  endDate: string
  viewMode: ViewMode
  taskCount: number
}

export interface GanttSprint {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  tasks: GanttTask[]
  externalId?: string
  chartId?: string | null
}

export interface TeamMember {
  id: string
  email: string
  name?: string | null
  role?: string | null
  isActive: boolean
}

export interface NotificationItem {
  id: string
  event: string
  recipient: string
  taskId?: string | null
  status: string
  errorMsg?: string | null
  sentAt: string
}

export interface SyncResult {
  tasksAdded: number
  tasksUpdated: number
  durationMs: number
  errors?: number
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  'Not Started': '#94A3B8',
  'In Progress': '#3B82F6',
  'Completed':   '#22C55E',
  'Overdue':     '#F97316',
  'Blocked':     '#C2410C',
}

export const TASK_STATUSES: TaskStatus[] = [
  'Not Started', 'In Progress', 'Completed', 'Overdue', 'Blocked',
]

// Priority order — lower index = higher priority
export const PRIORITY_ORDER: Record<string, number> = {
  'Urgent': 0,
  'High':   1,
  'Medium': 2,
  'Low':    3,
}

// Visual styles per priority
export const PRIORITY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  'Urgent': { label: 'Urgent', color: '#ef4444', bg: '#fef2f2' },
  'High':   { label: 'High',   color: '#f97316', bg: '#fff7ed' },
  'Medium': { label: 'Medium', color: '#eab308', bg: '#fefce8' },
  'Low':    { label: 'Low',    color: '#94a3b8', bg: '#f8fafc' },
}

export function priorityRank(priority?: string | null): number {
  if (!priority) return 99
  return PRIORITY_ORDER[priority] ?? 50
}

/** How often the open sprint re-imports from ERP while the Gantt is visible. */
export const LIVE_SYNC_MS = 8_000

export const ALMOST_OVERDUE_DAYS = 3
export const ALMOST_OVERDUE_COLOR = '#EAB308'
export const ALMOST_OVERDUE_LABEL = 'Almost Overdue'

export function isOverdueTask(task: { end?: string; status?: string }) {
  if (task.status === 'Completed') return false
  if (task.status === 'Overdue') return true
  if (!task.end) return false
  const end = new Date(`${task.end}T00:00:00`)
  if (Number.isNaN(end.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return end < today
}

export function isAlmostOverdue(task: { end?: string; status?: string }) {
  if (!task.end || task.status === 'Completed' || isOverdueTask(task)) return false
  const end = new Date(`${task.end}T00:00:00`)
  if (Number.isNaN(end.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.ceil((end.getTime() - today.getTime()) / 86400000)
  return days >= 0 && days <= ALMOST_OVERDUE_DAYS
}

export function barStatusLabel(task: {
  name?: string
  status?: string
  erpStatus?: string | null
  devopsStatus?: string | null
}) {
  // Show task name as the primary bar label — status is visible via color
  if (task.name) return task.name
  const parts = [task.erpStatus || task.status, task.devopsStatus]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value))
  return [...new Set(parts)].join(' · ')
}

export function chartMonthStart(iso?: string | null) {
  if (!iso) return ''
  return `${iso.slice(0, 7)}-01`
}

function localDay(value: string | Date) {
  if (typeof value === 'string') {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function formatSprintWeek(weekStart: Date) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 4)
  const startMonth = weekStart.toLocaleString('en', { month: 'short' })
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${startMonth} ${weekStart.getDate()}–${weekEnd.getDate()}`
  }
  return `${startMonth} ${weekStart.getDate()}–${weekEnd.toLocaleString('en', { month: 'short' })} ${weekEnd.getDate()}`
}

/** Week header from sprint start, e.g. Sept 7 → "September 7-11". */
export function sprintWeekHeader(d: Date, last: Date | undefined, sprintStart?: string | null) {
  const anchor = localDay(sprintStart || toLocalYmd(d))
  const day = localDay(d)
  const diff = Math.round((day.getTime() - anchor.getTime()) / 86400000)
  const weekIndex = Math.floor(diff / 7)
  if (last) {
    const lastDiff = Math.round((localDay(last).getTime() - anchor.getTime()) / 86400000)
    if (Math.floor(lastDiff / 7) === weekIndex) return ''
  }
  const weekStart = new Date(anchor)
  weekStart.setDate(anchor.getDate() + weekIndex * 7)
  return formatSprintWeek(weekStart)
}

export function sprintAnalytics(tasks: Array<{ end?: string; status?: string }>) {
  let ongoing = 0
  let completed = 0
  let overdue = 0
  for (const task of tasks) {
    if (task.status === 'Completed') completed += 1
    else if (isOverdueTask(task)) overdue += 1
    else ongoing += 1
  }
  return { total: tasks.length, ongoing, completed, overdue }
}

export function toLocalYmd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function mergeStatusColors(raw?: string | null): Record<TaskStatus, string> {
  if (!raw) return { ...STATUS_COLORS }
  try {
    const parsed = JSON.parse(raw) as Partial<Record<TaskStatus, string>>
    return { ...STATUS_COLORS, ...parsed }
  } catch {
    return { ...STATUS_COLORS }
  }
}
