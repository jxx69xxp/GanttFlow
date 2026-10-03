import type { GanttTask, TaskStatus } from '../types'
import { unpackTaskMeta } from './meta'

function toYmd(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') {
    const iso = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (iso) return iso[1]
  }
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function toGanttTask(task: {
  id: string
  title: string
  startDate?: Date | string | null
  endDate?: Date | string | null
  progress: number
  status: string
  assigneeEmail?: string | null
  projectName?: string | null
  sprintName?: string | null
  sprintId?: string | null
  description?: string | null
  source: string
  externalId: string
  sprintStartDate?: string | null
  sprintEndDate?: string | null
}): GanttTask {
  const rawStart = toYmd(task.startDate)
  const rawEnd = toYmd(task.endDate ?? task.startDate)
  // Fall back to sprint bounds for undated tasks so they render as a visible bar
  const sprintStart = toYmd(task.sprintStartDate) || rawStart
  const sprintEnd = toYmd(task.sprintEndDate) || rawEnd || sprintStart
  const start = rawStart || sprintStart
  const end = rawEnd || sprintEnd || start
  const status = (task.status as TaskStatus) || 'Not Started'
  const completed = status === 'Completed'
  const { description, meta } = unpackTaskMeta(task.description)

  return {
    id: task.id,
    name: task.title,
    start,
    end: end < start ? start : end,
    progress: completed ? 100 : task.progress ?? 0,
    status,
    erpStatus: meta.erpStatus ?? null,
    devopsStatus: meta.devopsStatus ?? null,
    assigneeEmail: task.assigneeEmail ?? null,
    assigneeName: meta.assigneeName ?? null,
    currentAssignee: meta.currentAssignee ?? null,
    devAssignee: meta.devAssignee ?? null,
    qaAssignee: meta.qaAssignee ?? null,
    projectName: task.projectName ?? null,
    sprintName: task.sprintName ?? null,
    sprintId: task.sprintId ?? null,
    description,
    priority: meta.priority ?? null,
    workType: meta.workType ?? null,
    sprintPoints: meta.sprintPoints ?? null,
    module: meta.module ?? null,
    dateAssigned: meta.dateAssigned ?? null,
    parentBacklogId: meta.parentBacklogId ?? null,
    parentBacklogName: meta.parentBacklogName ?? null,
    dependencies: meta.dependencies || undefined,
    source: task.source,
    externalId: task.externalId,
  }
}
