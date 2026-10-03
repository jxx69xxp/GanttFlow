/** Frappe DocType "Sprint" as used on the ERP site. */
export interface FrappeSprint {
  name: string
  sprint_name?: string
  date_from?: string
  date_to?: string
  enable?: number | string
}

export interface MappedSprint {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
}

/** Only these Frappe sprint families are imported and shown. */
export const FOCUSED_SPRINT_NAME = 'CORE DEVELOPMENT'
export const FOCUSED_SPRINT_NAMES = ['CORE DEVELOPMENT', 'CORE ENHANCEMENT'] as const

export function humanizeSprintAssign(value?: string | null) {
  return (value ?? '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function focusedSprintFamily(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = humanizeSprintAssign(value).toUpperCase()
    if (normalized.includes('CORE ENHANCEMENT')) return 'CORE ENHANCEMENT'
    if (normalized.includes('CORE DEVELOPMENT')) return 'CORE DEVELOPMENT'
  }
  return null
}

const UPPER_CORE_NAME = /^(CORE DEVELOPMENT|CORE ENHANCEMENT)(\b|[_\s-]|$)/
const UPPER_CORE_ID = /^(CORE_DEVELOPMENT|CORE_ENHANCEMENT)(_|$)/

/** Dropdown / import lock: uppercase CORE DEVELOPMENT / CORE ENHANCEMENT only, not "Core Development". */
export function isFocusedSprint(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue
    const raw = value.trim()
    if (UPPER_CORE_ID.test(raw) || UPPER_CORE_NAME.test(raw)) return true
  }
  return false
}

export function displaySprintName(sprintAssign?: string | null, fallback?: string | null) {
  return focusedSprintFamily(sprintAssign, fallback)
    || humanizeSprintAssign(sprintAssign)
    || fallback
    || FOCUSED_SPRINT_NAME
}

/** Frappe Sprint `name` used on Sprint Backlogs.sprint_assign, e.g. CORE_DEVELOPMENT_-_1. */
export function toSprintDocId(value?: string | null) {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!/\s/.test(trimmed)) return trimmed
  return trimmed.replace(/\s+/g, '_')
}

export function sprintAssignKeys(...values: Array<string | null | undefined>) {
  const keys = new Set<string>()
  for (const value of values) {
    if (!value) continue
    keys.add(value)
    keys.add(toSprintDocId(value))
    keys.add(value.replace(/\s+/g, '_'))
    keys.add(value.replace(/[\s/]+/g, '_'))
    const human = humanizeSprintAssign(value)
    if (human) keys.add(human)
  }
  return [...keys]
}

function toYmd(value?: Date | string | null) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  if (Number.isNaN(value.getTime())) return ''
  return value.toISOString().slice(0, 10)
}

/** Build sprint options from Sprint Backlogs rows, not the Sprint doctype. */
export function sprintsFromBacklogs(rows: Array<{
  sprintId?: string | null
  sprintName?: string | null
  sprint_assign?: string | null
  start?: string | null
  end?: string | null
  startDate?: Date | string | null
  endDate?: Date | string | null
  exp_start_date?: string | null
  exp_end_date?: string | null
}>) {
  const groups = new Map<string, { name: string; starts: string[]; ends: string[] }>()
  for (const row of rows) {
    const id = row.sprintId || row.sprint_assign || row.sprintName
    if (!id) continue
    const name = displaySprintName(row.sprint_assign || row.sprintId, row.sprintName)
    const start = toYmd(row.start ?? row.startDate ?? row.exp_start_date)
    const end = toYmd(row.end ?? row.endDate ?? row.exp_end_date)
    const group = groups.get(id) ?? { name, starts: [], ends: [] }
    if (start) group.starts.push(start)
    if (end) group.ends.push(end)
    groups.set(id, group)
  }
  return [...groups.entries()].map(([id, group]) => {
    const starts = group.starts.slice().sort()
    const ends = group.ends.slice().sort()
    return {
      id,
      externalId: id,
      name: group.name,
      startDate: starts[0] || new Date().toISOString().slice(0, 10),
      endDate: ends[ends.length - 1] || starts[0] || new Date().toISOString().slice(0, 10),
      status: 'Active',
    }
  })
}

export const ERPNEXT_SPRINT_URL = 'https://erp.livro.systems'

/** Sprint.department_profile whose sprints are imported and shown. */
export const SPRINT_DEPARTMENT = 'CORE TEAM'

export function frappeSprintListFilters(focused = false) {
  const filters: Array<[string, string, string | number]> = [['enable', '=', 1]]
  if (focused) filters.push(['sprint_name', 'like', `%${FOCUSED_SPRINT_NAME}%`])
  return filters
}

export const FRAPPE_SPRINT_FIELDS = [
  'name',
  'sprint_name',
  'date_from',
  'date_to',
  'enable',
] as const

export function mapFrappeSprint(row: FrappeSprint): MappedSprint {
  const enabled = row.enable === 1 || row.enable === '1'
  return {
    id: row.name,
    name: row.sprint_name || row.name,
    start_date: row.date_from || new Date().toISOString().slice(0, 10),
    end_date: row.date_to || row.date_from || new Date().toISOString().slice(0, 10),
    status: enabled ? 'Active' : 'Inactive',
  }
}

export function frappeSprintPayload(input: {
  name: string
  startDate: string
  endDate: string
}) {
  return {
    sprint_name: input.name,
    date_from: input.startDate,
    date_to: input.endDate,
    enable: 1,
  }
}
