import { describe, it, expect } from 'vitest'
import { transformErpTask, transformSprintBacklog, ganttRowsFromBacklogs } from '@/lib/erpnext/transformers'
import { transformSKTask } from '@/lib/sprint-kickoff/transformers'
import { mapFrappeSprint, frappeSprintPayload, frappeSprintListFilters, isFocusedSprint, sprintAssignKeys, sprintsFromBacklogs, toSprintDocId } from '@/lib/frappe/sprint'
import { barStatusLabel, chartMonthStart, sprintAnalytics } from '@/lib/types'

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

describe('mapFrappeSprint', () => {
  it('maps Frappe Sprint doctype fields', () => {
    const result = mapFrappeSprint({
      name: 'Sprint_5_-_Accounting',
      sprint_name: 'Sprint 5 - Accounting',
      date_from: '2026-09-07',
      date_to: '2026-09-11',
      enable: 1,
    })
    expect(result.id).toBe('Sprint_5_-_Accounting')
    expect(result.name).toBe('Sprint 5 - Accounting')
    expect(result.start_date).toBe('2026-09-07')
    expect(result.end_date).toBe('2026-09-11')
    expect(result.status).toBe('Active')
  })

  it('matches CORE DEVELOPMENT and CORE ENHANCEMENT only', () => {
    expect(isFocusedSprint('CORE DEVELOPMENT')).toBe(true)
    expect(isFocusedSprint('CORE_DEVELOPMENT_-_1')).toBe(true)
    expect(isFocusedSprint('CORE DEVELOPMENT - 1')).toBe(true)
    expect(isFocusedSprint('CORE ENHANCEMENT')).toBe(true)
    expect(isFocusedSprint('CORE_ENHANCEMENT_-_1')).toBe(true)
    expect(isFocusedSprint('Core Development')).toBe(false)
    expect(isFocusedSprint('SPRNT-0323: Core Development')).toBe(false)
    expect(isFocusedSprint('SPRNT-0007: Core Enhancement')).toBe(false)
    expect(isFocusedSprint('Sprint 5 - Accounting')).toBe(false)
    expect(isFocusedSprint('Sprint 10 - Core/Migration Grading')).toBe(false)
  })

  it('builds sprint kickoff from Sprint Backlogs dates', () => {
    const sprints = sprintsFromBacklogs([{
      sprint_assign: 'CORE_DEVELOPMENT_-_1',
      exp_start_date: '2026-09-07',
      exp_end_date: '2026-09-18',
    }])
    expect(sprints).toHaveLength(1)
    expect(sprints[0].id).toBe('CORE_DEVELOPMENT_-_1')
    expect(sprints[0].name).toBe('CORE DEVELOPMENT')
    expect(sprints[0].startDate).toBe('2026-09-07')
    expect(sprints[0].endDate).toBe('2026-09-18')
  })

  it('builds sprint_assign keys for the selected sprint', () => {
    const keys = sprintAssignKeys('CORE_DEVELOPMENT_-_1', 'CORE DEVELOPMENT - 1')
    expect(keys).toContain('CORE_DEVELOPMENT_-_1')
    expect(keys).toContain('CORE DEVELOPMENT - 1')
  })

  it('converts a display name to the Frappe Sprint document ID', () => {
    expect(toSprintDocId('CORE DEVELOPMENT - 1')).toBe('CORE_DEVELOPMENT_-_1')
    expect(toSprintDocId('CORE_DEVELOPMENT_-_1')).toBe('CORE_DEVELOPMENT_-_1')
  })

  it('lists enabled ERP sprints without a name lock', () => {
    expect(frappeSprintListFilters()).toEqual([['enable', '=', 1]])
    expect(frappeSprintListFilters(true)[1]).toEqual(['sprint_name', 'like', '%CORE DEVELOPMENT%'])
  })

  it('builds create payload for ERP', () => {
    expect(frappeSprintPayload({
      name: 'Sprint 5 - Accounting',
      startDate: '2026-09-07',
      endDate: '2026-09-11',
    })).toEqual({
      sprint_name: 'Sprint 5 - Accounting',
      date_from: '2026-09-07',
      date_to: '2026-09-11',
      enable: 1,
    })
  })
})

describe('transformSprintBacklog', () => {
  it('maps Sprint Backlogs fields to GanttTask', () => {
    const result = transformSprintBacklog({
      name: 'SPB-05459',
      subject: 'Phase 1: BED Enrollment and Billing Stabilization',
      exp_start_date: '2026-09-07',
      exp_end_date: '2026-09-18',
      status: 'On Hold',
      devops_status: 'For Testing',
      current_assignee: 'almarie.bullo@livro.systems',
      dev_assignee: 'almarie.bullo@livro.systems',
      dev_assignee_name: 'Almarie Bullo',
      qa_assignee: 'faith.kaye@livro.systems',
      project: 'PROJ-0054',
      project_name: 'Core Development - version 15',
      sprint_assign: 'CORE_DEVELOPMENT_-_1',
      description: '<p>Phase 1 of BED core work.</p>',
      priority: 'High',
      type: 'For Stabilization',
      sprint_points: '8',
      module: 'Enrollment',
      date_assigned: '2026-09-09',
      task_depends: [{ task: 'SPB-00001' }, { task: 'SPB-00002' }],
    })
    expect(result.externalId).toBe('SPB-05459')
    expect(result.name).toBe('Phase 1: BED Enrollment and Billing Stabilization')
    expect(result.start).toBe('2026-09-07')
    expect(result.end).toBe('2026-09-18')
    expect(result.status).toBe('Blocked')
    expect(result.erpStatus).toBe('On Hold')
    expect(result.devopsStatus).toBe('For Testing')
    expect(result.assigneeEmail).toBe('almarie.bullo@livro.systems')
    expect(result.assigneeName).toBe('Almarie Bullo')
    expect(result.qaAssignee).toBe('faith.kaye@livro.systems')
    expect(result.sprintId).toBe('CORE_DEVELOPMENT_-_1')
    expect(result.sprintName).toBe('CORE DEVELOPMENT')
    expect(result.priority).toBe('High')
    expect(result.workType).toBe('For Stabilization')
    expect(result.sprintPoints).toBe('8')
    expect(result.module).toBe('Enrollment')
    expect(result.dependencies).toBe('SPB-00001, SPB-00002')
    expect(result.description).toContain('Phase 1 of BED core work')
  })

  it('expands task_depends into Gantt rows using each task timeline', () => {
    const parent = {
      name: 'SPB-05459',
      subject: 'Phase 1: BED Enrollment and Billing Stabilization',
      sprint_assign: 'CORE_DEVELOPMENT_-_1',
      exp_start_date: '2026-09-07',
      exp_end_date: '2026-09-18',
      task_depends: [
        { task_name: 'SPB-05462', subject: 'Registrar Role No Permission for School Tuition Plan' },
        { task_name: 'SPB-05469', subject: 'Inventory Pre-Enrollment' },
      ],
    }
    const child = {
      name: 'SPB-05462',
      subject: 'Registrar Role No Permission for School Tuition Plan',
      exp_start_date: '2026-09-14',
      exp_end_date: '2026-10-14',
      status: 'On Hold',
      sprint_assign: 'CORE-2026',
    }
    const nestedParent = {
      name: 'SPB-05469',
      subject: 'Inventory Pre-Enrollment',
      sprint_assign: 'CORE_DEVELOPMENT_-_1',
      task_depends: [{ task_name: 'SPB-05479', subject: 'QA Automation for Enrollees functions' }],
    }
    const nested = {
      name: 'SPB-05479',
      subject: 'QA Automation for Enrollees functions',
      exp_start_date: '2026-09-10',
      exp_end_date: '2026-09-16',
      status: 'Open',
    }
    const rows = ganttRowsFromBacklogs(
      [parent, nestedParent],
      new Map([
        [parent.name, parent],
        [child.name, child],
        [nestedParent.name, nestedParent],
        [nested.name, nested],
      ]),
      'CORE_DEVELOPMENT_-_1',
    )
    expect(rows.map(row => row.externalId).sort()).toEqual(['SPB-05462', 'SPB-05479'])
    const registrar = rows.find(row => row.externalId === 'SPB-05462')
    expect(registrar?.name).toBe('Registrar Role No Permission for School Tuition Plan')
    expect(registrar?.start).toBe('2026-09-14')
    expect(registrar?.end).toBe('2026-10-14')
    expect(registrar?.sprintId).toBe('CORE_DEVELOPMENT_-_1')
    expect(registrar?.parentBacklogId).toBe('SPB-05459')
  })
})

describe('task meta', () => {
  it('packs and unpacks Sprint Backlog extras', async () => {
    const { packTaskMeta, unpackTaskMeta } = await import('@/lib/tasks/meta')
    const packed = packTaskMeta('Overview text', {
      priority: 'High',
      workType: 'For Stabilization',
      sprintPoints: '8',
    })
    const { description, meta } = unpackTaskMeta(packed)
    expect(description).toBe('Overview text')
    expect(meta.priority).toBe('High')
    expect(meta.workType).toBe('For Stabilization')
    expect(meta.sprintPoints).toBe('8')
  })
})

describe('sprint analytics', () => {
  it('starts the chart on the sprint month, not the previous month', () => {
    expect(chartMonthStart('2026-09-07')).toBe('2026-09-01')
  })

  it('counts ongoing, completed, and overdue tasks', () => {
    const stats = sprintAnalytics([
      { status: 'In Progress', end: '2099-01-01' },
      { status: 'Completed', end: '2020-01-01' },
      { status: 'Overdue', end: '2020-01-01' },
    ])
    expect(stats.ongoing).toBe(1)
    expect(stats.completed).toBe(1)
    expect(stats.overdue).toBe(1)
  })

  it('builds bar labels from Frappe status and devops_status', () => {
    expect(barStatusLabel({ erpStatus: 'On Hold', devopsStatus: 'For Testing' })).toBe('On Hold · For Testing')
    expect(barStatusLabel({ erpStatus: 'Working', devopsStatus: '' })).toBe('Working')
    expect(barStatusLabel({ status: 'Not Started' })).toBe('Not Started')
  })
})
