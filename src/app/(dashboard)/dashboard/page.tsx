'use client'
import { useQuery } from '@tanstack/react-query'
import { SprintAnalytics } from '@/components/gantt/SprintAnalytics'
import { LIVE_SYNC_MS, isOverdueTask, type GanttTask } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface SprintOption {
  id: string
  name: string
  externalId?: string
}

export default function DashboardPage() {
  const { data: sprintsData } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => fetch('/api/sprints').then(r => r.json()),
  })
  const sprints: SprintOption[] = sprintsData?.sprints ?? []
  const sprintId = sprints[0]?.externalId || sprints[0]?.id || ''

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', sprintId, 'dashboard'],
    queryFn: () => fetch(`/api/tasks?sprintId=${encodeURIComponent(sprintId)}`).then(r => r.json()),
    enabled: Boolean(sprintId),
    staleTime: 0,
    refetchInterval: LIVE_SYNC_MS,
    refetchOnWindowFocus: true,
  })

  const tasks: GanttTask[] = data?.tasks ?? []

  return (
    <div className="h-full min-h-0 overflow-y-auto">
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-bold text-ink">Dashboard analytics</h1>
      <p className="mt-1 text-sm text-muted">
        Ongoing, completed, and overdue work for{' '}
        <span className="font-medium text-ink">{sprints[0]?.name || 'the open sprint'}</span>
        {sprints[0]?.externalId ? <span className="ml-1 font-mono text-soft">{sprints[0].externalId}</span> : null}
      </p>

      {isLoading ? (
        <div className="mt-8 text-sm text-soft">Loading analytics…</div>
      ) : (
        <div className="mt-6">
          <SprintAnalytics tasks={tasks} />
        </div>
      )}

      {tasks.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-input text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2">Task</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Expected</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id} className={isOverdueTask(task) ? 'border-t border-orange-500/30 bg-orange-500/10' : 'border-t border-line'}>
                  <td className="px-4 py-2 text-ink">
                    <p className={isOverdueTask(task) ? 'text-orange-700 dark:text-orange-200' : undefined}>{task.name}</p>
                    <p className="text-[11px] text-soft">{task.externalId}</p>
                  </td>
                  <td className={isOverdueTask(task) ? 'px-4 py-2 font-semibold text-orange-700 dark:text-orange-300' : 'px-4 py-2 text-muted'}>{task.status}</td>
                  <td className="px-4 py-2 text-muted">
                    {formatDate(task.start)} → {formatDate(task.end)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  )
}
