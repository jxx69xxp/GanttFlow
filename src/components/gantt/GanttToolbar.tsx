'use client'
import { useState } from 'react'
import { Search, X, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { useGanttStore } from '@/store/ganttStore'
import { cn, formatDate } from '@/lib/utils'
import {
  ALMOST_OVERDUE_COLOR,
  ALMOST_OVERDUE_LABEL,
  TASK_STATUSES,
  type GanttTask,
  type TaskStatus,
  type ViewMode,
} from '@/lib/types'
import { CreateTaskDialog } from './CreateTaskDialog'
import { CreateSprintDialog } from './CreateSprintDialog'
import { useQueryClient } from '@tanstack/react-query'

const VIEWS: ViewMode[] = ['Day', 'Week', 'Month', 'Year']
const fmtShort = (iso?: string) => iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''

export interface SprintOption {
  id: string
  name: string
  externalId?: string
  startDate?: string
  endDate?: string
  chartId?: string | null
  status?: string
}

interface Props {
  sprints: SprintOption[]
  selectedSprintId: string
  assignees: string[]
  colors: Record<TaskStatus, string>
  onSelectSprint: (sprint: SprintOption) => void
  onCreatedSprint: (sprint: SprintOption) => void
  tasks?: GanttTask[]
  onManualSync?: () => void
  isSyncing?: boolean
}

export function GanttToolbar({
  sprints, selectedSprintId, assignees, colors, onSelectSprint, onCreatedSprint, tasks = [],
  onManualSync, isSyncing = false,
}: Props) {
  const qc = useQueryClient()
  const [exporting, setExporting] = useState(false)
  const {
    viewMode, filters, chartFrom, chartTo, chartId, chartReady,
    setViewMode, setFilter, resetFilters, generateChart, extendChart,
  } = useGanttStore()

  const selectedSprint = sprints.find(s =>
    s.externalId === selectedSprintId || s.id === selectedSprintId
  ) ?? sprints.find(s => s.name === filters.sprint)

  const activeFilters = [filters.assignee, filters.status, filters.search].filter(Boolean).length

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
    <div className="border-b border-line bg-panel">
      {/* ── Row 0: sprint tabs ───────────────────────────────────────────── */}
      <div className="flex items-end gap-1 overflow-x-auto border-b border-line/60 px-3 pt-1.5" role="tablist" aria-label="Sprints">
        {sprints.length === 0 && <span className="pb-2 text-xs text-soft">No sprints</span>}
        {sprints.map(s => {
          const key = s.externalId || s.id
          const active = key === (selectedSprint?.externalId || selectedSprint?.id)
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectSprint(s)}
              title={key}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3.5 pb-1.5 pt-1 text-left transition-colors',
                active ? 'border-blue-600 bg-blue-500/[.07]' : 'border-transparent hover:bg-hover',
              )}
            >
              <span className={cn('flex items-center gap-1.5 text-xs font-semibold', active ? 'text-blue-700 dark:text-blue-300' : 'text-ink')}>
                {s.status === 'Active' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-label="Active sprint" />}
                {s.name}
              </span>
              {/* dates tell same-named sprints apart */}
              {s.startDate && (
                <span className="block text-[10px] tabular-nums text-soft">
                  {fmtShort(s.startDate)} – {fmtShort(s.endDate)}
                </span>
              )}
            </button>
          )
        })}
        <div className="shrink-0 pb-1"><CreateSprintDialog variant="icon" onCreated={onCreatedSprint} /></div>
      </div>

      {/* ── Row 1: view + actions ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        {/* View mode pills */}
        <div className="flex rounded-md border border-line bg-input p-0.5">
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => { setViewMode(v); persist({ viewMode: v }) }}
              className={cn(
                'rounded px-2.5 py-1 text-[11px] font-semibold transition-colors',
                viewMode === v ? 'bg-blue-600 text-white' : 'text-muted hover:text-ink'
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-line" />

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={filters.from}
            onChange={e => setFilter('from', e.target.value)}
            className="h-8 rounded-md border border-line bg-input px-2 text-xs text-ink focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-soft">→</span>
          <input
            type="date"
            value={filters.to}
            onChange={e => setFilter('to', e.target.value)}
            className="h-8 rounded-md border border-line bg-input px-2 text-xs text-ink focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {filters.from && filters.to && chartId && (
            <button
              onClick={() => { generateChart(filters.from, filters.to); persist({ startDate: filters.from, endDate: filters.to }) }}
              className="h-8 rounded-md bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Apply
            </button>
          )}
          {chartReady && (
            <button
              onClick={() => { extendChart(); const n = useGanttStore.getState(); persist({ endDate: n.chartTo }) }}
              className="h-8 rounded-md border border-line bg-input px-2.5 text-xs font-semibold text-ink hover:bg-hover"
            >
              +1 week
            </button>
          )}
        </div>

        {/* push right */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-soft" />
          <input
            type="text"
            placeholder="Search…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="h-8 w-36 rounded-md border border-line bg-input pl-7 pr-2.5 text-xs text-ink placeholder:text-soft focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {filters.search && (
            <button onClick={() => setFilter('search', '')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-soft hover:text-ink">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Sync */}
        <button
          type="button"
          onClick={onManualSync}
          disabled={isSyncing}
          title="Sync from ERP"
          className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-input px-2.5 text-xs font-semibold text-ink hover:bg-hover disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing…' : 'Sync'}
        </button>

        {/* Add task */}
        <CreateTaskDialog
          sprintId={selectedSprint?.externalId || selectedSprint?.id}
          sprintName={selectedSprint?.name}
          label="+ Add task"
          defaultStart={chartFrom || filters.from || selectedSprint?.startDate}
          defaultEnd={chartTo || filters.to || selectedSprint?.endDate}
          chartId={chartId || selectedSprint?.chartId || ''}
        />

        {/* Export */}
        <button
          type="button"
          disabled={exporting || tasks.length === 0}
          onClick={async () => {
            setExporting(true)
            try {
              const { exportSprintExcel } = await import('@/lib/export/excel')
              await exportSprintExcel({
                sprintName: selectedSprint?.name || 'Sprint',
                sprintId: selectedSprint?.externalId || selectedSprint?.id,
                startDate: selectedSprint?.startDate,
                endDate: selectedSprint?.endDate,
                tasks,
              })
            } finally { setExporting(false) }
          }}
          className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-input px-2.5 text-xs font-semibold text-ink hover:bg-hover disabled:opacity-40"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
          {exporting ? 'Exporting…' : 'Excel'}
        </button>
      </div>

      {/* ── Row 2: filters + legend ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line/60 px-3 py-1.5">
        {/* Assignee filter */}
        {assignees.length > 0 && (
          <select
            value={filters.assignee}
            onChange={e => setFilter('assignee', e.target.value)}
            className="h-6 rounded border border-line bg-input px-1.5 text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All assignees</option>
            {assignees.map(a => <option key={a} value={a}>{a.split('@')[0]}</option>)}
          </select>
        )}

        {/* Status filter — chips */}
        <div className="flex items-center gap-1">
          {[...TASK_STATUSES, ALMOST_OVERDUE_LABEL as TaskStatus | string].map(s => {
            const c = s === ALMOST_OVERDUE_LABEL ? ALMOST_OVERDUE_COLOR : colors[s as TaskStatus]
            const active = filters.status === s
            return (
              <button
                key={s}
                onClick={() => setFilter('status', active ? '' : s)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'text-white'
                    : 'bg-hover text-muted hover:text-ink',
                )}
                style={active ? { background: c } : {}}
              >
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c }} />
                {s}
              </button>
            )
          })}
        </div>

        {/* clear filters */}
        {activeFilters > 0 && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-400"
          >
            <X className="h-3 w-3" />
            Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
          </button>
        )}

        {/* sprint dates (right side) */}
        {selectedSprint?.startDate && (
          <span className="ml-auto text-[11px] text-soft">
            {formatDate(selectedSprint.startDate)} – {formatDate(selectedSprint.endDate)}
          </span>
        )}
      </div>
    </div>
  )
}
