'use client'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sprintAnalytics, type GanttTask } from '@/lib/types'

/** Slim status strip above the Gantt: counts + completion bar. */
export function SprintAnalytics({ tasks }: { tasks: GanttTask[] }) {
  const s = sprintAnalytics(tasks)
  const done = s.total ? Math.round((s.completed / s.total) * 100) : 0
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 text-xs">
      <div className="flex items-center gap-2">
        <div role="progressbar" aria-label="Sprint completion" aria-valuenow={done} aria-valuemin={0} aria-valuemax={100}
          className="h-1.5 w-28 overflow-hidden rounded-full bg-hover">
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${done}%` }} />
        </div>
        <span className="font-semibold tabular-nums text-ink">{done}% done</span>
      </div>
      <span className="text-muted"><span className="font-semibold tabular-nums text-ink">{s.ongoing}</span> in progress</span>
      <span className="text-muted"><span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{s.completed}</span> completed</span>
      <span className={cn('flex items-center gap-1', s.overdue ? 'font-semibold text-orange-600' : 'text-muted')}>
        {s.overdue > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
        <span className="tabular-nums">{s.overdue}</span> overdue
      </span>
    </div>
  )
}
