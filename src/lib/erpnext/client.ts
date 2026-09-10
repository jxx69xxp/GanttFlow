import { decrypt } from '../encryption'
import { ERPNEXT_SPRINT_URL, FRAPPE_SPRINT_FIELDS, frappeSprintListFilters, frappeSprintPayload, isFocusedSprint, mapFrappeSprint, type MappedSprint } from '../frappe/sprint'

export function getErpNextClient(settings?: {
  erpnextBaseUrl?: string | null
  erpnextApiKey?: string | null
  erpnextApiSecret?: string | null
} | null) {
  if (!settings?.erpnextApiKey || !settings?.erpnextApiSecret) return null
  return new ErpNextClient({
    baseUrl: settings.erpnextBaseUrl || ERPNEXT_SPRINT_URL,
    apiKey: decrypt(settings.erpnextApiKey),
    apiSecret: decrypt(settings.erpnextApiSecret),
  })
}

export interface ErpNextConfig {
  baseUrl: string
  apiKey: string
  apiSecret: string
}

export interface ErpTask {
  name: string
  subject: string
  exp_start_date?: string
  exp_end_date?: string
  progress?: number
  status?: string
  assigned_to?: { email: string }[]
  project?: string
  custom_sprint?: string
  description?: string
}

export interface ErpSprintDepend {
  task?: string
  task_name?: string
  sprint_backlog?: string
  name?: string
  subject?: string
  dev_assignee?: string
}

export interface ErpSprintBacklog {
  name: string
  subject?: string
  exp_start_date?: string
  exp_end_date?: string
  progress?: number
  status?: string
  devops_status?: string
  current_assignee?: string
  dev_assignee?: string
  dev_assignee_name?: string
  qa_assignee?: string
  project?: string
  project_name?: string
  project_manager?: string
  sprint_assign?: string
  description?: string
  priority?: string
  type?: string
  sprint_points?: string | number
  module?: string
  date_assigned?: string
  owner?: string
  task_depends?: ErpSprintDepend[]
}

const MFA_HINT =
  'Use API Access keys (User → API Access → Generate Keys), not username/password. MFA blocks password login.'

export class ErpNextClient {
  constructor(private config: ErpNextConfig) {}

  private get baseUrl() {
    return this.config.baseUrl.replace(/\/+$/, '')
  }

  private get headers() {
    return {
      Authorization: `token ${this.config.apiKey}:${this.config.apiSecret}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  private async readError(res: Response, action: string): Promise<never> {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.exception ?? body?.message ?? body?._error_message ?? ''
    } catch {
      detail = await res.text().catch(() => '')
    }
    throw new Error(
      `${action} failed (${res.status})${detail ? `: ${detail}` : ''}. ${MFA_HINT}`
    )
  }

  async fetchSprints(): Promise<MappedSprint[]> {
    const fields = JSON.stringify([...FRAPPE_SPRINT_FIELDS])
    const likes: Array<[string, string, string]> = [
      ['sprint_name', 'like', '%CORE DEVELOPMENT%'],
      ['sprint_name', 'like', '%CORE ENHANCEMENT%'],
      ['name', 'like', '%CORE_DEVELOPMENT%'],
      ['name', 'like', '%CORE_ENHANCEMENT%'],
    ]
    const seen = new Map<string, MappedSprint>()
    for (const like of likes) {
      const query = new URLSearchParams({
        fields,
        filters: JSON.stringify([like]),
        order_by: 'date_from desc',
        limit_page_length: '50',
      })
      const res = await fetch(`${this.baseUrl}/api/resource/Sprint?${query}`, { headers: this.headers })
      if (!res.ok) continue
      const data = await res.json()
      for (const sprint of (data.data ?? []).map(mapFrappeSprint)) {
        if (isFocusedSprint(sprint.id, sprint.name)) seen.set(sprint.id, sprint)
      }
    }
    return [...seen.values()].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
  }

  async createSprint(input: { name: string; startDate: string; endDate: string }): Promise<MappedSprint> {
    const res = await fetch(`${this.baseUrl}/api/resource/Sprint`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(frappeSprintPayload(input)),
    })
    if (!res.ok) await this.readError(res, 'ERPNext Sprint create')
    const data = await res.json()
    const row = data.data ?? data
    return mapFrappeSprint({
      name: row.name,
      sprint_name: row.sprint_name ?? input.name,
      date_from: row.date_from ?? input.startDate,
      date_to: row.date_to ?? input.endDate,
      enable: row.enable ?? 1,
    })
  }

  private async fetchSprintBacklogDoc(doctype: string, name: string): Promise<ErpSprintBacklog | null> {
    const doctypes = doctype ? [doctype, 'Sprint Backlogs', 'Sprint Backlog'] : ['Sprint Backlogs', 'Sprint Backlog']
    const seen = new Set<string>()
    for (const type of doctypes) {
      if (seen.has(type)) continue
      seen.add(type)
      const res = await fetch(
        `${this.baseUrl}/api/resource/${encodeURIComponent(type)}/${encodeURIComponent(name)}`,
        { headers: this.headers }
      )
      if (res.status === 404) continue
      if (!res.ok) return null
      const data = await res.json()
      return (data.data ?? data) as ErpSprintBacklog
    }
    return null
  }

  async fetchSprintBacklogDocs(names: string[]): Promise<Map<string, ErpSprintBacklog>> {
    const out = new Map<string, ErpSprintBacklog>()
    const unique = [...new Set(names.filter(Boolean))]
    const size = 6
    for (let i = 0; i < unique.length; i += size) {
      const chunk = unique.slice(i, i + size)
      const docs = await Promise.all(chunk.map(name => this.fetchSprintBacklogDoc('Sprint Backlogs', name)))
      docs.forEach((doc, index) => {
        if (doc) out.set(doc.name || chunk[index], doc)
      })
    }
    return out
  }

  async resolveBacklogTree(roots: ErpSprintBacklog[]): Promise<Map<string, ErpSprintBacklog>> {
    const byId = new Map(roots.map(row => [row.name, row]))
    const queue = roots.flatMap(row =>
      (row.task_depends ?? []).map(item => item.task_name || item.task || item.sprint_backlog || '').filter(Boolean)
    )
    const queued = new Set(byId.keys())
    while (queue.length) {
      const batch: string[] = []
      while (queue.length && batch.length < 18) {
        const id = queue.shift()!
        if (queued.has(id)) continue
        queued.add(id)
        batch.push(id)
      }
      if (batch.length === 0) continue
      const docs = await this.fetchSprintBacklogDocs(batch)
      for (const [id, doc] of docs) {
        byId.set(id, doc)
        for (const item of doc.task_depends ?? []) {
          const child = item.task_name || item.task || item.sprint_backlog || ''
          if (child && !queued.has(child)) queue.push(child)
        }
      }
    }
    return byId
  }

  private async enrichBacklogs(rows: ErpSprintBacklog[], doctype: string): Promise<ErpSprintBacklog[]> {
    const out: ErpSprintBacklog[] = []
    const size = 6
    for (let i = 0; i < rows.length; i += size) {
      const chunk = rows.slice(i, i + size)
      const filled = await Promise.all(chunk.map(async row => {
        const full = await this.fetchSprintBacklogDoc(doctype, row.name)
        return full ? { ...row, ...full } : row
      }))
      out.push(...filled)
    }
    return out
  }

  async fetchSprintBacklogs(sprintIds: string[] = []): Promise<ErpSprintBacklog[]> {
    // List API rejects several DocType fields (progress, description, type).
    const fieldSets = [
      [
        'name', 'subject', 'exp_start_date', 'exp_end_date', 'status', 'devops_status',
        'current_assignee', 'dev_assignee', 'dev_assignee_name', 'qa_assignee',
        'project', 'project_name', 'sprint_assign', 'priority',
        'sprint_points', 'module', 'date_assigned',
      ],
      ['name', 'subject', 'sprint_assign', 'status', 'exp_start_date', 'exp_end_date'],
      ['name', 'subject', 'sprint_assign'],
    ]
    const sprintFilter = sprintIds.length === 1
      ? [['sprint_assign', '=', sprintIds[0]]]
      : sprintIds.length > 1
        ? [['sprint_assign', 'in', sprintIds]]
        : null
    const doctypes = ['Sprint Backlogs', 'Sprint Backlog']
    for (const doctype of doctypes) {
      let rows: ErpSprintBacklog[] | null = null
      let rejected: Response | null = null
      for (const fields of fieldSets) {
        const query = new URLSearchParams({
          fields: JSON.stringify(fields),
          limit_page_length: '500',
        })
        if (sprintFilter) query.set('filters', JSON.stringify(sprintFilter))
        const res = await fetch(
          `${this.baseUrl}/api/resource/${encodeURIComponent(doctype)}?${query}`,
          { headers: this.headers }
        )
        if (res.status === 404) {
          rows = null
          rejected = null
          break
        }
        if (res.status === 417) {
          rejected = res
          continue
        }
        if (!res.ok) await this.readError(res, 'Sprint Backlogs fetch')
        const data = await res.json()
        rows = data.data ?? []
        break
      }
      if (!rows) {
        if (rejected) await this.readError(rejected, 'Sprint Backlogs fetch')
        continue
      }
      const matched = rows.filter((row: ErpSprintBacklog) =>
        Boolean(row.sprint_assign) && (sprintIds.length > 0 || isFocusedSprint(row.sprint_assign))
      )
      return matched.length <= 50 ? this.enrichBacklogs(matched, doctype) : matched
    }
    return []
  }

  async fetchTasks(sprintIds: string[] = []): Promise<ErpTask[]> {
    const fields = JSON.stringify([
      'name','subject','exp_start_date','exp_end_date',
      'progress','status','assigned_to','project','custom_sprint','description',
    ])
    const sprintFilter = sprintIds.length === 1
      ? [['custom_sprint', '=', sprintIds[0]]]
      : sprintIds.length > 1
        ? [['custom_sprint', 'in', sprintIds]]
        : [['custom_sprint', 'like', '%CORE_DEVELOPMENT%']]
    const res = await fetch(
      `${this.baseUrl}/api/resource/Task?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(JSON.stringify(sprintFilter))}&limit_page_length=500`,
      { headers: this.headers }
    )
    if (!res.ok) await this.readError(res, 'ERPNext fetch')
    const data = await res.json()
    return (data.data ?? []).filter((t: ErpTask) => isFocusedSprint(t.custom_sprint, t.project))
  }

  async patchTask(taskName: string, updates: Partial<{
    exp_start_date: string
    exp_end_date: string
    progress: number
    status: string
  }>) {
    const path = taskName.startsWith('SPB-')
      ? `Sprint Backlogs/${encodeURIComponent(taskName)}`
      : `Task/${encodeURIComponent(taskName)}`
    const res = await fetch(
      `${this.baseUrl}/api/resource/${path}`,
      { method: 'PUT', headers: this.headers, body: JSON.stringify(updates) }
    )
    if (!res.ok) await this.readError(res, 'ERPNext patch')
    return res.json()
  }

  async testConnection(): Promise<{ ok: boolean; user?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/method/frappe.auth.get_logged_user`, {
        headers: this.headers,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: `ERPNext returned ${res.status}. ${MFA_HINT}` }
      }
      return { ok: true, user: body.message ?? body.user }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Connection failed' }
    }
  }
}
