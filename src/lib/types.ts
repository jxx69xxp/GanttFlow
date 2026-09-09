export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Overdue' | 'Blocked'
export type ViewMode = 'Day' | 'Week' | 'Month' | 'Quarter Year'

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
  assigneeEmail?: string | null
  projectName?: string | null
  sprintName?: string | null
  sprintId?: string | null
  description?: string | null
  source: string
  externalId: string
}

export interface GanttSprint {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  tasks: GanttTask[]
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
  'Overdue':     '#EF4444',
  'Blocked':     '#F97316',
}
