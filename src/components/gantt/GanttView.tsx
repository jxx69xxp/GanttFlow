'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useGanttStore } from '@/store/ganttStore'
import { GanttToolbar } from './GanttToolbar'
import { GanttChart } from './GanttChart'
import { TaskDrawer } from './TaskDrawer'
import { formatDate } from '@/lib/utils'

export function GanttView() {
  const { filters } = useGanttStore()
  const qc = useQueryClient()

  const params = new URLSearchParams()
  if (filters.sprint)   params.set('sprint',   filters.sprint)
  if (filters.assignee) params.set('assignee', filters.assignee)
  if (filters.status)   params.set('status',   filters.status)
  if (filters.from)     params.set('from',     filters.from)
  if (filters.to)       params.set('to',       filters.to)

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => fetch(`/api/tasks?${params}`).then(r => r.json()),
  })

  const tasks = (data?.tasks ?? []).filter((t: { title: string }) =>
    !filters.search || t.title.toLowerCase().includes(filters.search.toLowerCase())
  )
  const sprints = data?.sprints ?? []
  const lastSynced = data?.lastSyncedAt

  return (
    <div className="flex h-full flex-col">
      <GanttToolbar sprints={sprints} assignees={[...new Set(tasks.map((t: { assigneeEmail?: string }) => t.assigneeEmail).filter(Boolean))]} />

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-slate-500">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Loading tasks…
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
            <span className="text-4xl">📋</span>
            <p>No tasks found. Sync your ERPNext or Sprint Kickoff data.</p>
          </div>
        ) : (
          <GanttChart tasks={tasks} />
        )}
      </div>

      {/* Status bar */}
      <div className="border-t border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-500 flex gap-4">
        <span>{tasks.length} tasks</span>
        <span>{sprints.length} sprints</span>
        {lastSynced && <span>Last synced {formatDate(lastSynced)}</span>}
      </div>

      <TaskDrawer />
    </div>
  )
}
