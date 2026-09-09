export interface SprintKickoffConfig {
  baseUrl: string
  apiToken: string
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

export class SprintKickoffClient {
  constructor(private config: SprintKickoffConfig) {}

  private get headers() {
    return {
      Authorization: `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json',
    }
  }

  async fetchSprints(): Promise<SKSprint[]> {
    const res = await fetch(`${this.config.baseUrl}/api/sprints?status=active`, {
      headers: this.headers,
    })
    if (!res.ok) throw new Error(`Sprint Kickoff fetch failed: ${res.status}`)
    const data = await res.json()
    return data.sprints ?? data ?? []
  }

  async fetchTasks(sprintId: string): Promise<SKTask[]> {
    const res = await fetch(`${this.config.baseUrl}/api/sprints/${sprintId}/tasks`, {
      headers: this.headers,
    })
    if (!res.ok) throw new Error(`Sprint Kickoff tasks fetch failed: ${res.status}`)
    const data = await res.json()
    return data.tasks ?? data ?? []
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/health`, {
        headers: this.headers,
      })
      return res.ok
    } catch { return false }
  }
}
