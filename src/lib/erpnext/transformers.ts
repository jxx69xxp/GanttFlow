import type { ErpTask } from './client'
import type { GanttTask, TaskStatus } from '../types'

const STATUS_MAP: Record<string, TaskStatus> = {
  'Open':       'Not Started',
  'Working':    'In Progress',
  'Pending Review': 'In Progress',
  'Completed':  'Completed',
  'Cancelled':  'Blocked',
}

export function transformErpTask(task: ErpTask): GanttTask {
  const status: TaskStatus = STATUS_MAP[task.status ?? ''] ?? 'Not Started'
  const now = new Date().toISOString().slice(0, 10)
  const isOverdue = task.exp_end_date ? task.exp_end_date < now && status !== 'Completed' : false

  return {
    id:           task.name,
    externalId:   task.name,
    name:         task.subject ?? '(Untitled)',
    start:        task.exp_start_date ?? now,
    end:          task.exp_end_date ?? now,
    progress:     task.progress ?? 0,
    status:       isOverdue ? 'Overdue' : status,
    assigneeEmail: task.assigned_to?.[0]?.email ?? null,
    projectName:  task.project ?? null,
    sprintName:   task.custom_sprint ?? null,
    sprintId:     task.custom_sprint ?? null,
    description:  task.description ?? null,
    source:       'erpnext',
  }
}
