import { decrypt } from '../encryption'
import { ERPNEXT_SPRINT_URL, FRAPPE_SPRINT_FIELDS, SPRINT_DEPARTMENT, frappeSprintPayload, isFocusedSprint, mapFrappeSprint, type MappedSprint } from '../frappe/sprint'

export function getErpNextClient(settings?: {
  erpnextBaseUrl?: string | null
  erpnextApiKey?: string | null
  erpnextApiSecret?: string | null
  erpnextAuthMode?: string | null
  erpnextUsername?: string | null
  erpnextPassword?: string | null
} | null) {
  const baseUrl = settings?.erpnextBaseUrl || ERPNEXT_SPRINT_URL
  if (settings?.erpnextAuthMode === 'login') {
    if (!settings?.erpnextUsername || !settings?.erpnextPassword) return null
    return new ErpNextClient({
      baseUrl,
      authMode: 'login',
      username: decrypt(settings.erpnextUsername),
      password: decrypt(settings.erpnextPassword),
    })
  }
  if (!settings?.erpnextApiKey || !settings?.erpnextApiSecret) return null
  return new ErpNextClient({
    baseUrl,
    authMode: 'api',
    apiKey: decrypt(settings.erpnextApiKey),
    apiSecret: decrypt(settings.erpnextApiSecret),
  })
}

export type ErpNextConfig =
  | { baseUrl: string; authMode: 'api'; apiKey: string; apiSecret: string }
  | { baseUrl: string; authMode: 'login'; username: string; password: string }

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
  'Use API Access keys (User → API Access → Generate Keys), or switch to username/password in Settings.'

export class ErpNextClient {
  private sessionCookie: string | null = null

  constructor(private config: ErpNextConfig) {}

  private get baseUrl() {
    return this.config.baseUrl.replace(/\/+$/, '')
  }

  private async getHeaders(): Promise<Record<string, string>> {
    if (this.config.authMode === 'api') {
      return {
        Authorization: `token ${this.config.apiKey}:${this.config.apiSecret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }
    }
    // login mode — obtain session cookie once, then reuse for the lifetime of this client instance
    if (!this.sessionCookie) {
      const res = await fetch(`${this.baseUrl}/api/method/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ usr: this.config.username, pwd: this.config.password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(`ERPNext login failed (${res.status}): ${body?.message ?? 'invalid credentials'}`)
      }
      const setCookie = res.headers.get('set-cookie') ?? ''
      const sid = setCookie.split(';').find(p => p.trim().startsWith('sid='))?.trim()
      if (!sid) throw new Error('ERPNext login succeeded but no session cookie returned')
      this.sessionCookie = sid
    }
    return {
      Cookie: this.sessionCookie,
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
    const query = new URLSearchParams({
      fields: JSON.stringify([...FRAPPE_SPRINT_FIELDS]),
      filters: JSON.stringify([['department_profile', '=', SPRINT_DEPARTMENT]]),
      order_by: 'date_from desc',
      limit_page_length: '100',
    })
    const res = await fetch(`${this.baseUrl}/api/resource/Sprint?${query}`, { headers: await this.getHeaders() })
    if (!res.ok) await this.readError(res, 'ERPNext Sprint fetch')
    const data = await res.json()
    return (data.data ?? []).map(mapFrappeSprint)
  }

  async createSprint(input: { name: string; startDate: string; endDate: string }): Promise<MappedSprint> {
    const res = await fetch(`${this.baseUrl}/api/resource/Sprint`, {
      method: 'POST',
      headers: await this.getHeaders(),
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
    const headers = await this.getHeaders()
    const seen = new Set<string>()
    for (const type of doctypes) {
      if (seen.has(type)) continue
      seen.add(type)
      const res = await fetch(
        `${this.baseUrl}/api/resource/${encodeURIComponent(type)}/${encodeURIComponent(name)}`,
        { headers }
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
    const headers = await this.getHeaders()
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
          { headers }
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
      { headers: await this.getHeaders() }
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
    sprint_assign: string
    priority: string
    current_assignee: string
    dev_assignee: string
  }>) {
    const path = taskName.startsWith('SPB-')
      ? `Sprint Backlogs/${encodeURIComponent(taskName)}`
      : `Task/${encodeURIComponent(taskName)}`
    const res = await fetch(
      `${this.baseUrl}/api/resource/${path}`,
      { method: 'PUT', headers: await this.getHeaders(), body: JSON.stringify(updates) }
    )
    if (!res.ok) await this.readError(res, 'ERPNext patch')
    return res.json()
  }

  async fetchComments(doctype: string, docname: string): Promise<Array<{
    name: string; owner: string; comment_by?: string; content: string; creation: string
  }>> {
    const params = new URLSearchParams({
      fields: JSON.stringify(['name', 'owner', 'comment_by', 'content', 'creation']),
      filters: JSON.stringify([
        ['comment_type', '=', 'Comment'],
        ['reference_doctype', '=', doctype],
        ['reference_name', '=', docname],
      ]),
      order_by: 'creation asc',
      limit_page_length: '50',
    })
    const res = await fetch(
      `${this.baseUrl}/api/resource/Comment?${params}`,
      { headers: await this.getHeaders() }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.data ?? []
  }

  async addComment(doctype: string, docname: string, content: string): Promise<{ ok: boolean; name?: string }> {
    const res = await fetch(`${this.baseUrl}/api/resource/Comment`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        comment_type: 'Comment',
        reference_doctype: doctype,
        reference_name: docname,
        content,
      }),
    })
    if (!res.ok) return { ok: false }
    const data = await res.json()
    return { ok: true, name: (data.data ?? data)?.name }
  }

  /** Raw fetch of a Frappe attachment path (/files/... or /private/files/...) with auth. */
  async fetchFile(path: string): Promise<Response> {
    const { Authorization, Cookie } = await this.getHeaders()
    // src may arrive raw ("a b.png") or pre-encoded ("a%20b.png") — normalise before encoding
    let clean = path
    try { clean = decodeURI(path) } catch {}
    return fetch(`${this.baseUrl}${encodeURI(clean)}`, {
      headers: { ...(Authorization && { Authorization }), ...(Cookie && { Cookie }), Accept: '*/*' },
    })
  }

  /** Select-field options straight from the DocType (e.g. Sprint Backlogs.status). */
  async fetchSelectOptions(doctype: string, fieldname: string): Promise<string[]> {
    const res = await fetch(
      `${this.baseUrl}/api/method/frappe.desk.form.load.getdoctype?doctype=${encodeURIComponent(doctype)}`,
      { headers: await this.getHeaders() }
    )
    if (!res.ok) return []
    const body = await res.json()
    const meta = (body.docs ?? []).find((d: { name: string }) => d.name === doctype)
    const field = meta?.fields?.find((f: { fieldname: string }) => f.fieldname === fieldname)
    return String(field?.options ?? '').split('\n').map((o: string) => o.trim()).filter(Boolean)
  }

  async createSprintBacklog(input: {
    subject: string
    exp_start_date?: string
    exp_end_date?: string
    status?: string
    priority?: string
    sprint_assign?: string
    current_assignee?: string
    dev_assignee?: string
    sprint_points?: number
    description?: string
  }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/resource/${encodeURIComponent('Sprint Backlogs')}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== ''))),
    })
    if (!res.ok) await this.readError(res, 'Sprint Backlog create')
    const data = await res.json()
    return (data.data ?? data).name
  }

  private notificationFilters(forUser: string, read?: 0 | 1) {
    const f: Array<[string, string, unknown]> = [['for_user', '=', forUser], ['type', 'in', ['Mention', 'Assignment']]]
    if (read !== undefined) f.push(['read', '=', read])
    return JSON.stringify(f)
  }

  /** Frappe's own per-user feed: @mentions in comments + assignments. Paged server-side. */
  async fetchNotificationLogs(forUser: string, { start = 0, limit = 20, read }: { start?: number; limit?: number; read?: 0 | 1 } = {}): Promise<Array<{
    name: string; subject: string; type: string; document_type?: string; document_name?: string
    from_user?: string; read?: number; creation: string
  }>> {
    const params = new URLSearchParams({
      fields: JSON.stringify(['name', 'subject', 'type', 'document_type', 'document_name', 'from_user', 'read', 'creation']),
      filters: this.notificationFilters(forUser, read),
      order_by: 'creation desc',
      limit_start: String(start),
      limit_page_length: String(limit),
    })
    const res = await fetch(`${this.baseUrl}/api/resource/${encodeURIComponent('Notification Log')}?${params}`, { headers: await this.getHeaders() })
    if (!res.ok) await this.readError(res, 'Notification Log fetch')
    const data = await res.json()
    return data.data ?? []
  }

  async countNotificationLogs(forUser: string, read?: 0 | 1): Promise<number> {
    const params = new URLSearchParams({ doctype: 'Notification Log', filters: this.notificationFilters(forUser, read) })
    const res = await fetch(`${this.baseUrl}/api/method/frappe.client.get_count?${params}`, { headers: await this.getHeaders() })
    if (!res.ok) return 0
    const body = await res.json().catch(() => ({}))
    return Number(body.message) || 0
  }

  /** read: mark_as_read (always allowed for your own logs); unread: plain doc update. */
  async setNotificationRead(name: string, read: boolean): Promise<boolean> {
    const res = read
      ? await fetch(`${this.baseUrl}/api/method/frappe.desk.doctype.notification_log.notification_log.mark_as_read`, {
          method: 'POST', headers: await this.getHeaders(), body: JSON.stringify({ docname: name }),
        })
      : await fetch(`${this.baseUrl}/api/resource/${encodeURIComponent('Notification Log')}/${encodeURIComponent(name)}`, {
          method: 'PUT', headers: await this.getHeaders(), body: JSON.stringify({ read: 0 }),
        })
    return res.ok
  }



  /** Mark every unread Mention/Assignment for a user as read. Returns how many were updated. */
  async markAllNotificationsRead(forUser: string): Promise<number> {
    // Frappe's own mark_all_as_read only covers the API key's user, so update this user's rows directly
    const params = new URLSearchParams({
      fields: JSON.stringify(['name']),
      filters: this.notificationFilters(forUser, 0),
      limit_page_length: '2000',
    })
    const res = await fetch(`${this.baseUrl}/api/resource/${encodeURIComponent('Notification Log')}?${params}`, { headers: await this.getHeaders() })
    if (!res.ok) await this.readError(res, 'Notification Log fetch')
    const names: string[] = ((await res.json()).data ?? []).map((r: { name: string }) => r.name)
    for (let i = 0; i < names.length; i += 200) {  // bulk_update caps batch size
      const docs = names.slice(i, i + 200).map(docname => ({ doctype: 'Notification Log', docname, read: 1 }))
      const r = await fetch(`${this.baseUrl}/api/method/frappe.client.bulk_update`, {
        method: 'POST', headers: await this.getHeaders(), body: JSON.stringify({ docs: JSON.stringify(docs) }),
      })
      if (!r.ok) await this.readError(r, 'Mark all read')
    }
    return names.length
  }

  get siteUrl() { return this.baseUrl }

  async fetchModified(doctype: string, docname: string): Promise<string | null> {
    const res = await fetch(
      `${this.baseUrl}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(docname)}?fields=["modified"]`,
      { headers: await this.getHeaders() }
    )
    if (!res.ok) return null
    const data = await res.json()
    return (data.data ?? data)?.modified ?? null
  }

  async testConnection(): Promise<{ ok: boolean; user?: string; error?: string }> {
    try {
      const headers = await this.getHeaders()
      const res = await fetch(`${this.baseUrl}/api/method/frappe.auth.get_logged_user`, { headers })
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
