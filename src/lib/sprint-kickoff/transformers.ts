import type { SKTask } from './client'
import type { GanttTask, TaskStatus } from '../types'

const STATUS_MAP: Record<string, TaskStatus> = {
  'todo':        'Not Started',
  'in_progress': 'In Progress',
  'done':        'Completed',
  'blocked':     'Blocked',
}

export function transformSKTask(task: SKTask): GanttTask {
  const status: TaskStatus = STATUS_MAP[task.status?.toLowerCase() ?? ''] ?? 'Not Started'
  const now = new Date().toISOString().slice(0, 10)
  const end = task.due_date ?? now
  const isOverdue = end < now && status !== 'Completed'

  return {
    id:           `sk-${task.id}`,
    externalId:   task.id,
    name:         task.title,
    start:        task.start_date ?? now,
    end,
    progress:     task.progress ?? 0,
    status:       isOverdue ? 'Overdue' : status,
    assigneeEmail: task.assignee_email ?? null,
    projectName:  task.project_name ?? null,
    sprintName:   task.sprint_name,
    sprintId:     task.sprint_id,
    description:  task.description ?? null,
    source:       'sprint_kickoff',
  }
}
