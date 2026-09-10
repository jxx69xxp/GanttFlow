'use client'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGanttStore } from '@/store/ganttStore'
import { GanttToolbar, type SprintOption } from './GanttToolbar'
import { GanttChart } from './GanttChart'
import { GanttSetup } from './GanttSetup'
import { TaskDrawer } from './TaskDrawer'
import { SprintAnalytics } from './SprintAnalytics'
import { formatDate } from '@/lib/utils'
import { ALMOST_OVERDUE_LABEL, LIVE_SYNC_MS, STATUS_COLORS, isAlmostOverdue, type GanttBoard, type GanttTask, type TaskStatus } from '@/lib/types'

export function GanttView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { filters, selectSprint, chartId: storeChartId } = useGanttStore()
  const sprintKey = searchParams.get('sprint') ?? ''
  const chartId = searchParams.get('chart') ?? ''
  const creating = searchParams.get('new') === '1'

  const { data: sprintsData, isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => fetch('/api/sprints').then(r => r.json()),
  })
  const sprints: SprintOption[] = sprintsData?.sprints ?? []

  const activeSprint = sprints.find(s =>
    s.externalId === sprintKey
    || s.id === sprintKey
    || s.name === sprintKey
    || (chartId && s.chartId === chartId)
  ) || sprints[0]

  useEffect(() => {
    if (creating || sprints.length === 0 || !activeSprint) return
    const key = activeSprint.externalId || activeSprint.id
    if (sprintKey === key && chartId === (activeSprint.chartId ?? '')) return
    router.replace(`/?sprint=${encodeURIComponent(key)}${activeSprint.chartId ? `&chart=${activeSprint.chartId}` : ''}`)
  }, [activeSprint?.chartId, activeSprint?.externalId, activeSprint?.id, chartId, creating, router, sprintKey, sprints.length])

  useEffect(() => {
    if (!activeSprint) return
    if (filters.sprint === activeSprint.name && storeChartId === (activeSprint.chartId ?? '')) return
    selectSprint({
      name: activeSprint.name,
      startDate: activeSprint.startDate ?? '',
      endDate: activeSprint.endDate ?? '',
      chartId: activeSprint.chartId,
    })
  }, [activeSprint?.chartId, activeSprint?.endDate, activeSprint?.name, activeSprint?.startDate, filters.sprint, selectSprint, storeChartId])

  const params = new URLSearchParams()
  const sprintDocId = activeSprint?.externalId || activeSprint?.id || ''
  if (sprintDocId) params.set('sprintId', sprintDocId)
  if (activeSprint?.chartId) params.set('chart', activeSprint.chartId)
  if (filters.assignee) params.set('assignee', filters.assignee)
  if (filters.status && filters.status !== ALMOST_OVERDUE_LABEL) params.set('status', filters.status)

  const { data, isLoading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['tasks', activeSprint?.externalId || activeSprint?.id, filters.assignee, filters.status],
    queryFn: () => fetch(`/api/tasks?${params}`).then(r => r.json()),
    enabled: Boolean(activeSprint) && !creating,
    staleTime: 0,
    refetchInterval: LIVE_SYNC_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
  })

  const colors: Record<TaskStatus, string> = settings?.statusColors ?? STATUS_COLORS
  const tasks: GanttTask[] = (data?.tasks ?? []).filter((t: GanttTask) => {
    if (filters.search && !t.name.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.status === ALMOST_OVERDUE_LABEL && !isAlmostOverdue(t)) return false
    return true
  })
  const showSetup = creating || (sprints.length === 0 && !sprintsLoading)

  function goToSprint(sprint: SprintOption) {
    selectSprint({
      name: sprint.name,
      startDate: sprint.startDate ?? '',
      endDate: sprint.endDate ?? '',
      chartId: sprint.chartId,
    })
    const key = sprint.externalId || sprint.id
    router.push(`/?sprint=${encodeURIComponent(key)}${sprint.chartId ? `&chart=${sprint.chartId}` : ''}`)
  }

  function goToChart(chart: GanttBoard) {
    const match = sprints.find(s => s.chartId === chart.id || s.name === chart.name)
    if (match) {
      goToSprint(match)
      return
    }
    goToSprint({
      id: chart.id,
      name: chart.name,
      externalId: chart.id,
      startDate: chart.startDate,
      endDate: chart.endDate,
      chartId: chart.id,
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <GanttToolbar
        sprints={sprints}
        selectedSprintId={activeSprint?.externalId || activeSprint?.id || ''}
        assignees={[...new Set(tasks.map(t => t.assigneeEmail).filter(Boolean))] as string[]}
        colors={colors}
        onSelectSprint={goToSprint}
        onCreatedSprint={goToSprint}
        tasks={tasks}
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        {showSetup ? (
          <GanttSetup onCreated={goToChart} />
        ) : !activeSprint || isLoading ? (
          <div className="flex h-64 items-center justify-center text-soft">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Loading tasks…
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-line bg-panel">
              <SprintAnalytics tasks={tasks} compact />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <GanttChart tasks={tasks} colors={colors} />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 border-t border-line bg-panel px-4 py-2 text-xs text-soft">
        {activeSprint && (
          <span className="text-ink">
            {activeSprint.name}
            {(activeSprint.externalId || activeSprint.id) && (
              <span className="ml-1 font-mono text-soft">{activeSprint.externalId || activeSprint.id}</span>
            )}
          </span>
        )}
        <span>{tasks.length} tasks</span>
        <span>{sprints.length} sprints</span>
        <span className="flex items-center gap-1.5">
          <span className={isFetching ? 'h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500' : 'h-1.5 w-1.5 rounded-full bg-emerald-500'} />
          Live
          {dataUpdatedAt ? <span className="text-soft">{formatDate(new Date(dataUpdatedAt).toISOString())}</span> : null}
        </span>
      </div>

      <TaskDrawer colors={colors} />
    </div>
  )
}
