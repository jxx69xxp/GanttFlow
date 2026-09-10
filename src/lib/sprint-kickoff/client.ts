import { FRAPPE_SPRINT_FIELDS, frappeSprintListFilters, frappeSprintPayload, isFocusedSprint, mapFrappeSprint, type MappedSprint } from '../frappe/sprint'

export interface SprintKickoffConfig {
  baseUrl: string
  apiKey: string
  apiSecret: string
}

export interface SKSprint {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  tasks: SKTask[]
}

export interface SKTask {
  id: string
  title: string
  description?: string
  assignee_email?: string
  status: string
  progress?: number
  start_date?: string
  due_date?: string
  sprint_id: string
  sprint_name: string
  project_name?: string
}

const MFA_HINT =
  'Use API Access keys (User → API Access → Generate Keys), not username/password.'

export class SprintKickoffClient {
  constructor(private config: SprintKickoffConfig) {}

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

  private async readJson(res: Response) {
    return res.json().catch(() => ({}))
  }

  async fetchSprints(): Promise<SKSprint[]> {
    const fields = JSON.stringify([...FRAPPE_SPRINT_FIELDS])
    const filters = JSON.stringify(frappeSprintListFilters(true))
    const frappe = await fetch(
      `${this.baseUrl}/api/resource/Sprint?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&limit_page_length=200`,
      { headers: this.headers }
    )
    if (frappe.ok) {
      const data = await this.readJson(frappe)
      return (data.data ?? [])
        .map((row: Parameters<typeof mapFrappeSprint>[0]) => ({
          ...mapFrappeSprint(row),
          tasks: [],
        }))
        .filter((s: MappedSprint) => isFocusedSprint(s.id, s.name))
    }

    const rest = await fetch(`${this.baseUrl}/api/sprints?status=active`, {
      headers: this.headers,
    })
    if (!rest.ok) {
      throw new Error(`Sprint fetch failed (${frappe.status}). ${MFA_HINT}`)
    }
    const data = await this.readJson(rest)
    return data.sprints ?? data.data ?? data ?? []
  }

  async createSprint(input: { name: string; startDate: string; endDate: string }): Promise<MappedSprint> {
    const res = await fetch(`${this.baseUrl}/api/resource/Sprint`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(frappeSprintPayload(input)),
    })
    if (!res.ok) {
      throw new Error(`Sprint create failed (${res.status}). ${MFA_HINT}`)
    }
    const data = await this.readJson(res)
    const row = data.data ?? data
    return mapFrappeSprint({
      name: row.name,
      sprint_name: row.sprint_name ?? input.name,
      date_from: row.date_from ?? input.startDate,
      date_to: row.date_to ?? input.endDate,
      enable: row.enable ?? 1,
    })
  }

  async fetchTasks(sprintId: string): Promise<SKTask[]> {
    const rest = await fetch(`${this.baseUrl}/api/sprints/${sprintId}/tasks`, {
      headers: this.headers,
    })
    if (rest.ok) {
      const data = await this.readJson(rest)
      return data.tasks ?? data.data ?? data ?? []
    }

    const filters = JSON.stringify([['custom_sprint', '=', sprintId]])
    const fields = JSON.stringify([
      'name', 'subject', 'description', 'status', 'progress',
      'exp_start_date', 'exp_end_date', 'project', 'custom_sprint',
    ])
    const frappe = await fetch(
      `${this.baseUrl}/api/resource/Task?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}&limit_page_length=500`,
      { headers: this.headers }
    )
    if (!frappe.ok) {
      throw new Error(`Sprint Kickoff tasks fetch failed (${rest.status}). ${MFA_HINT}`)
    }
    const data = await this.readJson(frappe)
    return (data.data ?? []).map((row: Record<string, string | number>) => ({
      id: String(row.name),
      title: String(row.subject ?? row.name),
      description: row.description ? String(row.description) : undefined,
      status: String(row.status ?? 'todo'),
      progress: Number(row.progress ?? 0),
      start_date: row.exp_start_date ? String(row.exp_start_date) : undefined,
      due_date: row.exp_end_date ? String(row.exp_end_date) : undefined,
      sprint_id: sprintId,
      sprint_name: sprintId,
      project_name: row.project ? String(row.project) : undefined,
    }))
  }

  async createTask(input: {
    title: string
    start_date: string
    due_date: string
    status?: string
    description?: string
    sprint_id?: string
  }): Promise<{ id: string }> {
    const frappe = await fetch(`${this.baseUrl}/api/resource/Task`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        subject: input.title,
        exp_start_date: input.start_date,
        exp_end_date: input.due_date,
        status: input.status ?? 'Open',
        description: input.description,
        custom_sprint: input.sprint_id,
      }),
    })
    if (frappe.ok) {
      const data = await this.readJson(frappe)
      return { id: data.data?.name ?? data.name }
    }

    const rest = await fetch(`${this.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(input),
    })
    if (!rest.ok) {
      throw new Error(`Sprint Kickoff create failed (${frappe.status}). ${MFA_HINT}`)
    }
    const data = await this.readJson(rest)
    return { id: data.id ?? data.name ?? data.data?.id }
  }

  async patchTask(taskId: string, updates: {
    start_date?: string
    due_date?: string
    progress?: number
    status?: string
  }) {
    const body = {
      exp_start_date: updates.start_date,
      exp_end_date: updates.due_date,
      progress: updates.progress,
      status: updates.status,
    }
    const frappe = await fetch(`${this.baseUrl}/api/resource/Task/${taskId}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    })
    if (frappe.ok) return this.readJson(frappe)

    const rest = await fetch(`${this.baseUrl}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(updates),
    })
    if (!rest.ok) throw new Error(`Sprint Kickoff patch failed (${frappe.status})`)
    return this.readJson(rest)
  }

  async testConnection(): Promise<{ ok: boolean; user?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/method/frappe.auth.get_logged_user`, {
        headers: this.headers,
      })
      const body = await this.readJson(res)
      if (res.ok) return { ok: true, user: body.message ?? body.user }

      const health = await fetch(`${this.baseUrl}/api/health`, { headers: this.headers })
      if (health.ok) return { ok: true }
      return { ok: false, error: `Sprint Kickoff returned ${res.status}. ${MFA_HINT}` }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Connection failed' }
    }
  }
}
