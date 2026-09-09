import { describe, it, expect } from 'vitest'
import { transformErpTask } from '@/lib/erpnext/transformers'
import { transformSKTask } from '@/lib/sprint-kickoff/transformers'

describe('transformErpTask', () => {
  it('maps all Task fields to GanttTask', () => {
    const input = {
      name: 'TASK-001', subject: 'Fix login bug',
      exp_start_date: '2026-09-10', exp_end_date: '2026-09-17',
      progress: 60, status: 'Working',
      assigned_to: [{ email: 'juan@co.com' }],
      project: 'Mobile App', custom_sprint: 'Sprint 4',
    }
    const result = transformErpTask(input)
    expect(result.id).toBe('TASK-001')
    expect(result.name).toBe('Fix login bug')
    expect(result.start).toBe('2026-09-10')
    expect(result.end).toBe('2026-09-17')
    expect(result.progress).toBe(60)
    expect(result.status).toBe('In Progress')
    expect(result.assigneeEmail).toBe('juan@co.com')
    expect(result.projectName).toBe('Mobile App')
    expect(result.sprintName).toBe('Sprint 4')
    expect(result.source).toBe('erpnext')
  })

  it('handles missing dates gracefully', () => {
    const result = transformErpTask({ name: 'T-002', subject: 'Empty task' })
    expect(result.start).toBeDefined()
    expect(result.end).toBeDefined()
    expect(result.progress).toBe(0)
    expect(result.assigneeEmail).toBeNull()
  })

  it('maps Completed status correctly', () => {
    const result = transformErpTask({ name: 'T', subject: 'Done', status: 'Completed' })
    expect(result.status).toBe('Completed')
  })

  it('marks overdue tasks (past end date, not completed)', () => {
    const result = transformErpTask({
      name: 'T', subject: 'Old task',
      exp_end_date: '2020-01-01', status: 'Working',
    })
    expect(result.status).toBe('Overdue')
  })

  it('does not mark completed tasks as overdue', () => {
    const result = transformErpTask({
      name: 'T', subject: 'Done',
      exp_end_date: '2020-01-01', status: 'Completed',
    })
    expect(result.status).toBe('Completed')
  })
})

describe('transformSKTask', () => {
  it('maps Sprint Kickoff task fields', () => {
    const input = {
      id: 'sk-001', title: 'Design mockup',
      assignee_email: 'maria@co.com',
      status: 'in_progress', progress: 40,
      start_date: '2026-09-08', due_date: '2026-09-12',
      sprint_id: 'sp-1', sprint_name: 'Sprint 3',
      project_name: 'Website Redesign',
    }
    const result = transformSKTask(input)
    expect(result.id).toBe('sk-sk-001')
    expect(result.name).toBe('Design mockup')
    expect(result.status).toBe('In Progress')
    expect(result.assigneeEmail).toBe('maria@co.com')
    expect(result.source).toBe('sprint_kickoff')
  })
})
