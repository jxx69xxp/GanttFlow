'use client'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGanttStore } from '@/store/ganttStore'
import { GanttToolbar, type SprintOption } from './GanttToolbar'
import { GanttChart } from './GanttChart'
import { GanttSetup } from './GanttSetup'
import { TaskDrawer } from './TaskDrawer'
import { SprintAnalytics } from './SprintAnalytics'
import { formatDate } from '@/lib/utils'
import {
  ALMOST_OVERDUE_LABEL,
  STATUS_COLORS,
  isAlmostOverdue,
  priorityRank,
  type GanttBoard,
  type GanttTask,
  type TaskStatus,
} from '@/lib/types'

export function GanttView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const { filters, selectSprint, chartId: storeChartId } = useGanttStore()

  const sprintKey = searchParams.get('sprint') ?? ''
  const chartId   = searchParams.get('chart')  ?? ''
  const creating  = searchParams.get('new')    === '1'

  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)

  // ── sprints ────────────────────────────────────────────────────────────────
  const { data: sprintsData, isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => fetch('/api/sprints').then(r => r.json()),
    staleTime: 60_000,           // sprints list doesn't change often
    refetchOnWindowFocus: false,
  })
  const sprints: SprintOption[] = sprintsData?.sprints ?? []

  const activeSprint = sprints.find(s =>
    s.externalId === sprintKey
    || s.id === sprintKey
    || s.name === sprintKey
    || (chartId && s.chartId === chartId)
  ) ?? sprints[0]

  // keep URL in sync with active sprint
  useEffect(() => {
    if (creating || sprints.length === 0 || !activeSprint) return
    const key = activeSprint.externalId || activeSprint.id
    if (sprintKey === key && chartId === (activeSprint.chartId ?? '')) return
    router.replace(`/?sprint=${encodeURIComponent(key)}${activeSprint.chartId ? `&chart=${activeSprint.chartId}` : ''}`)
  }, [activeSprint?.chartId, activeSprint?.externalId, activeSprint?.id, chartId, creating, router, sprintKey, sprints.length])

  // keep store in sync with active sprint
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

  // ── tasks — served from DB, no polling ────────────────────────────────────
  const sprintDocId = activeSprint?.externalId || activeSprint?.id || ''

  const buildParams = (forceSync = false) => {
    const p = new URLSearchParams()
    if (sprintDocId)           p.set('sprintId', sprintDocId)
    if (activeSprint?.chartId) p.set('chart', activeSprint.chartId)
    if (filters.assignee)      p.set('assignee', filters.assignee)
    if (filters.status && filters.status !== ALMOST_OVERDUE_LABEL) p.set('status', filters.status)
    if (forceSync)             p.set('sync', '1')
    return p
  }

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['tasks', sprintDocId, filters.assignee, filters.status],
    queryFn:  () => fetch(`/api/tasks?${buildParams()}`).then(r => r.json()),
    enabled:  Boolean(activeSprint) && !creating,
    // No automatic refetch — data comes from DB, only refresh on manual sync
    staleTime:              Infinity,
    refetchOnWindowFocus:   false,
    refetchOnMount:         true,   // fetch once when the component mounts / sprint changes
    refetchInterval:        false,
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => fetch('/api/settings').then(r => r.json()),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  // ── manual sync ────────────────────────────────────────────────────────────
  async function handleManualSync() {
    if (isSyncing || !sprintDocId) return
    setIsSyncing(true)
    try {
      // Force-fetch from ERP and repopulate DB, then invalidate local cache
      await fetch(`/api/tasks?${buildParams(true)}`)
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setLastSynced(new Date())
    } catch (e) {
      console.error('Manual sync failed:', e)
    } finally {
      setIsSyncing(false)
    }
  }

  // ── derived data ──────────────────────────────────────────────────────────
  const colors: Record<TaskStatus, string> = settings?.statusColors ?? STATUS_COLORS

  const tasks: GanttTask[] = (data?.tasks ?? []).filter((t: GanttTask) => {
    if (filters.search && !t.name.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.status === ALMOST_OVERDUE_LABEL && !isAlmostOverdue(t)) return false
    return true
  }).sort((a: GanttTask, b: GanttTask) => priorityRank(a.priority) - priorityRank(b.priority))

  const showSetup = creating || (sprints.length === 0 && !sprintsLoading)

  // ── navigation helpers ────────────────────────────────────────────────────
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
    if (match) { goToSprint(match); return }
    goToSprint({
      id: chart.id, name: chart.name, externalId: chart.id,
      startDate: chart.startDate, endDate: chart.endDate, chartId: chart.id,
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
        onManualSync={handleManualSync}
        isSyncing={isSyncing}
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
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-line bg-panel">
              <SprintAnalytics tasks={tasks} compact />
            </div>
            <div className="min-h-0 flex-1">
              <GanttChart tasks={tasks} colors={colors} />
            </div>
          </div>
        )}
      </div>

      {/* ── status bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-t border-line bg-panel px-4 py-1.5 text-[11px] text-soft">
        {activeSprint && (
          <span className="font-medium text-ink">
            {activeSprint.name}
            {(activeSprint.externalId || activeSprint.id) && (
              <span className="ml-1.5 font-mono text-soft">{activeSprint.externalId || activeSprint.id}</span>
            )}
          </span>
        )}
        <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        {lastSynced ? (
          <span>Last synced {formatDate(lastSynced.toISOString())}</span>
        ) : dataUpdatedAt ? (
          <span>Loaded {formatDate(new Date(dataUpdatedAt).toISOString())}</span>
        ) : null}
        {/* no live polling indicator — sync is explicit */}
      </div>

      <TaskDrawer colors={colors} />
    </div>
  )
}
