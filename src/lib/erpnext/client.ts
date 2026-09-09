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

export class ErpNextClient {
  constructor(private config: ErpNextConfig) {}

  private get headers() {
    return {
      Authorization: `token ${this.config.apiKey}:${this.config.apiSecret}`,
      'Content-Type': 'application/json',
    }
  }

  async fetchTasks(): Promise<ErpTask[]> {
    const fields = JSON.stringify([
      'name','subject','exp_start_date','exp_end_date',
      'progress','status','assigned_to','project','custom_sprint','description',
    ])
    const res = await fetch(
      `${this.config.baseUrl}/api/resource/Task?fields=${encodeURIComponent(fields)}&limit_page_length=500`,
      { headers: this.headers }
    )
    if (!res.ok) throw new Error(`ERPNext fetch failed: ${res.status}`)
    const data = await res.json()
    return data.data ?? []
  }

  async patchTask(taskName: string, updates: Partial<{
    exp_start_date: string
    exp_end_date: string
    progress: number
    status: string
  }>) {
    const res = await fetch(
      `${this.config.baseUrl}/api/resource/Task/${taskName}`,
      { method: 'PUT', headers: this.headers, body: JSON.stringify(updates) }
    )
    if (!res.ok) throw new Error(`ERPNext patch failed: ${res.status}`)
    return res.json()
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/method/ping`, {
        headers: this.headers,
      })
      return res.ok
    } catch { return false }
  }
}
