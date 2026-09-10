'use client'
import { Search, X, CalendarRange, Columns3, Flag } from 'lucide-react'
import { useGanttStore } from '@/store/ganttStore'
import { cn, formatDate } from '@/lib/utils'
import {
  ALMOST_OVERDUE_COLOR,
  ALMOST_OVERDUE_LABEL,
  TASK_STATUSES,
  type TaskStatus,
  type ViewMode,
} from '@/lib/types'
import { CreateTaskDialog } from './CreateTaskDialog'
import { CreateSprintDialog } from './CreateSprintDialog'
import { useQueryClient } from '@tanstack/react-query'

const VIEWS: ViewMode[] = ['Day', 'Week', 'Month', 'Year']

export interface SprintOption {
  id: string
  name: string
  externalId?: string
  startDate?: string
  endDate?: string
  chartId?: string | null
}

interface Props {
  sprints: SprintOption[]
  selectedSprintId: string
  assignees: string[]
  colors: Record<TaskStatus, string>
  onSelectSprint: (sprint: SprintOption) => void
  onCreatedSprint: (sprint: SprintOption) => void
}

export function GanttToolbar({
  sprints, selectedSprintId, assignees, colors, onSelectSprint, onCreatedSprint,
}: Props) {
  const qc = useQueryClient()
  const { viewMode, filters, chartFrom, chartTo, chartId, chartReady, setViewMode, setFilter, resetFilters, generateChart, extendChart } = useGanttStore()
  const selectedSprint = sprints.find(s =>
    s.externalId === selectedSprintId
    || s.id === selectedSprintId
    || s.chartId === selectedSprintId
    || s.name === selectedSprintId
  ) || sprints.find(s => s.name === filters.sprint)
  const hasExtraFilters = Boolean(filters.assignee || filters.status || filters.search)

  async function persist(partial: { startDate?: string; endDate?: string; viewMode?: ViewMode }) {
    if (!chartId) return
    await fetch(`/api/charts/${chartId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
    qc.invalidateQueries({ queryKey: ['charts'] })
    qc.invalidateQueries({ queryKey: ['sprints'] })
  }

  return (
    <div className="space-y-2 border-b border-line bg-panel px-4 py-3">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <select
              value={selectedSprint?.externalId || selectedSprint?.id || ''}
              onChange={e => {
                const next = sprints.find(s => s.externalId === e.target.value || s.id === e.target.value)
                if (next) onSelectSprint(next)
              }}
              className="h-9 min-w-[260px] rounded-md border border-blue-500 bg-input px-2 text-sm font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {sprints.length === 0 && <option value="">No sprints yet</option>}
              {sprints.map(s => (
                <option key={s.externalId || s.id} value={s.externalId || s.id}>
                  {s.name} ({s.externalId || s.id})
                </option>
              ))}
            </select>
            <CreateSprintDialog variant="icon" onCreated={onCreatedSprint} />
          </div>
          {selectedSprint && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Flag className="h-3 w-3 text-blue-600" />
              <span className="font-medium text-ink">Sprint kickoff</span>
              <span>{selectedSprint.name}</span>
              <span className="font-mono text-soft">{selectedSprint.externalId || selectedSprint.id}</span>
              <span className="text-soft">
                {formatDate(selectedSprint.startDate)} → {formatDate(selectedSprint.endDate)}
              </span>
            </p>
          )}
        </div>

        <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-soft">
          <Columns3 className="h-3.5 w-3.5" />
          Columns
        </span>
        <div className="mt-0.5 flex rounded-lg border border-line bg-input p-1">
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => {
                setViewMode(v)
                persist({ viewMode: v })
              }}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                viewMode === v ? 'bg-blue-600 text-white' : 'text-muted hover:text-ink'
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <CreateTaskDialog
          sprintId={selectedSprint?.externalId || selectedSprint?.id}
          sprintName={selectedSprint?.name}
          label="Add row"
          defaultStart={chartFrom || filters.from || selectedSprint?.startDate}
          defaultEnd={chartTo || filters.to || selectedSprint?.endDate}
          chartId={chartId || selectedSprint?.chartId || ''}
        />
        {chartReady && (
          <button
            type="button"
            onClick={() => {
              extendChart()
              const next = useGanttStore.getState()
              persist({ endDate: next.chartTo })
            }}
            className="mt-0.5 rounded-md border border-line bg-input px-3 py-1 text-xs font-semibold text-ink hover:bg-hover"
          >
            Extend columns
          </button>
        )}

        <div className="relative mt-0.5">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-soft" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="h-8 w-44 rounded-md border border-line bg-input pl-8 pr-3 text-xs text-ink placeholder:text-soft focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={filters.assignee}
          onChange={e => setFilter('assignee', e.target.value)}
          className="mt-0.5 h-8 rounded-md border border-line bg-input px-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Assignees</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select
          value={filters.status}
          onChange={e => setFilter('status', e.target.value)}
          className="mt-0.5 h-8 rounded-md border border-line bg-input px-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          <option value={ALMOST_OVERDUE_LABEL}>{ALMOST_OVERDUE_LABEL}</option>
        </select>

        {hasExtraFilters && (
          <button onClick={resetFilters} className="mt-1 flex items-center gap-1 text-xs text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <CalendarRange className="h-3.5 w-3.5" />
          From
          <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)}
            className="h-7 rounded-md border border-line bg-input px-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          To
          <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)}
            className="h-7 rounded-md border border-line bg-input px-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </label>
        {filters.from && filters.to && chartId && (
          <button
            type="button"
            onClick={() => {
              generateChart(filters.from, filters.to)
              persist({ startDate: filters.from, endDate: filters.to })
            }}
            className="h-7 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Update dates
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-1">
        {TASK_STATUSES.map(status => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: colors[status] }} />
            {status}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: ALMOST_OVERDUE_COLOR }} />
          {ALMOST_OVERDUE_LABEL}
        </span>
      </div>
    </div>
  )
}
