'use client'
import { Search, X } from 'lucide-react'
import { useGanttStore } from '@/store/ganttStore'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/lib/types'

const VIEWS: ViewMode[] = ['Day', 'Week', 'Month', 'Quarter Year']
const STATUSES = ['Not Started', 'In Progress', 'Completed', 'Overdue', 'Blocked']

interface Props {
  sprints: { name: string }[]
  assignees: string[]
}

export function GanttToolbar({ sprints, assignees }: Props) {
  const { viewMode, filters, setViewMode, setFilter, resetFilters } = useGanttStore()
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="border-b border-slate-700 bg-slate-900 px-4 py-2 space-y-2">
      {/* View switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg bg-slate-800 p-1">
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                viewMode === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100'
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="h-7 w-44 rounded-md bg-slate-800 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Sprint filter */}
        <select
          value={filters.sprint}
          onChange={e => setFilter('sprint', e.target.value)}
          className="h-7 rounded-md bg-slate-800 px-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Sprints</option>
          {sprints.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>

        {/* Assignee filter */}
        <select
          value={filters.assignee}
          onChange={e => setFilter('assignee', e.target.value)}
          className="h-7 rounded-md bg-slate-800 px-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Assignees</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={e => setFilter('status', e.target.value)}
          className="h-7 rounded-md bg-slate-800 px-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Date range */}
        <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)}
          className="h-7 rounded-md bg-slate-800 px-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <span className="text-slate-600 text-xs">→</span>
        <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)}
          className="h-7 rounded-md bg-slate-800 px-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500" />

        {hasFilters && (
          <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
    </div>
  )
}
