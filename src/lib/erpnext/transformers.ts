import type { ErpSprintBacklog, ErpSprintDepend, ErpTask } from './client'
import { displaySprintName } from '../frappe/sprint'
import type { GanttTask, TaskStatus } from '../types'

const STATUS_MAP: Record<string, TaskStatus> = {
  'Open':       'Not Started',
  'Working':    'In Progress',
  'Pending Review': 'In Progress',
  'Completed':  'Completed',
  'Cancelled':  'Blocked',
  'On Hold':    'Blocked',
  'Hold':       'Blocked',
  'Closed':     'Completed',
  'Done':       'Completed',
  'Released':   'Completed',
}

function stripHtml(value?: string | null) {
  if (!value) return null
  const text = value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return text || null
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

export function dependTaskId(item: ErpSprintDepend) {
  return item.task_name || item.task || item.sprint_backlog || ''
}

function dependIds(row: ErpSprintBacklog) {
  return (row.task_depends ?? [])
    .map(dependTaskId)
    .filter((id): id is string => Boolean(id && id !== row.name))
}

function stubFromDepend(id: string, depend?: ErpSprintDepend, sprintId?: string | null): ErpSprintBacklog {
  return {
    name: id,
    subject: depend?.subject || id,
    sprint_assign: sprintId || undefined,
    current_assignee: depend?.dev_assignee,
    task_depends: [],
  }
}

function expandLeaves(
  node: ErpSprintBacklog,
  byId: Map<string, ErpSprintBacklog>,
  path: Set<string>,
  emitted: Set<string>,
): ErpSprintBacklog[] {
  if (path.has(node.name)) return []
  const ids = dependIds(node)
  if (ids.length === 0) {
    if (emitted.has(node.name)) return []
    emitted.add(node.name)
    return [node]
  }
  path.add(node.name)
  const leaves: ErpSprintBacklog[] = []
  for (const id of ids) {
    const depend = (node.task_depends ?? []).find(item => dependTaskId(item) === id)
    const child = byId.get(id) ?? stubFromDepend(id, depend, node.sprint_assign)
    leaves.push(...expandLeaves(child, byId, path, emitted))
  }
  path.delete(node.name)
  return leaves
}

/** Gantt rows are task_depends leaves; dates come from each task's expected start/end. */
export function ganttRowsFromBacklogs(
  roots: ErpSprintBacklog[],
  byId: Map<string, ErpSprintBacklog> = new Map(roots.map(row => [row.name, row])),
  sprintId?: string | null,
): GanttTask[] {
  const emitted = new Set<string>()
  const rows: GanttTask[] = []
  for (const root of roots) {
    const leaves = expandLeaves(root, byId, new Set(), emitted)
    for (const leaf of leaves) {
      const task = transformSprintBacklog(leaf)
      task.sprintId = sprintId || root.sprint_assign || task.sprintId
      if (leaf.name !== root.name) {
        task.parentBacklogId = root.name
        task.parentBacklogName = root.subject ?? root.name
      }
      rows.push(task)
    }
  }
  return rows
}

export function transformSprintBacklog(row: ErpSprintBacklog): GanttTask {
  const status: TaskStatus = STATUS_MAP[row.status ?? ''] ?? 'Not Started'
  const now = new Date().toISOString().slice(0, 10)
  const isOverdue = row.exp_end_date ? row.exp_end_date < now && status !== 'Completed' : false
  const sprint = row.sprint_assign ?? ''
  const depends = dependIds(row)

  return {
    id:            row.name,
    externalId:    row.name,
    name:          row.subject ?? row.name,
    start:         row.exp_start_date ?? now,
    end:           row.exp_end_date ?? now,
    progress:      row.progress ?? 0,
    status:        isOverdue ? 'Overdue' : status,
    erpStatus:     row.status || null,
    devopsStatus:  row.devops_status || null,
    assigneeEmail: row.current_assignee || row.dev_assignee || null,
    assigneeName:  row.dev_assignee_name || null,
    qaAssignee:    row.qa_assignee || null,
    projectName:   row.project_name || row.project || null,
    sprintName:    displaySprintName(sprint) || null,
    sprintId:      sprint || null,
    description:   stripHtml(row.description),
    priority:      row.priority || null,
    workType:      row.type || null,
    sprintPoints:  row.sprint_points != null && row.sprint_points !== '' ? String(row.sprint_points) : null,
    module:        row.module || null,
    dateAssigned:  row.date_assigned || null,
    dependencies:  depends.length ? depends.join(', ') : undefined,
    source:        'erpnext',
  }
}
