'use client'
import type { ReactNode } from 'react'
import { AlertTriangle, CircleCheck, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isOverdueTask, sprintAnalytics, type GanttTask } from '@/lib/types'

export function SprintAnalytics({
  tasks,
  compact = false,
}: {
  tasks: GanttTask[]
  compact?: boolean
}) {
  const stats = sprintAnalytics(tasks)
  const overdueTasks = tasks.filter(isOverdueTask)

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 text-xs">
        <span className="font-semibold text-ink">Ongoing {stats.ongoing}</span>
        <span className="text-emerald-700 dark:text-emerald-400">Completed {stats.completed}</span>
        <span className={stats.overdue > 0 ? 'font-semibold text-orange-600' : 'text-soft'}>
          Overdue {stats.overdue}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Ongoing"
          value={stats.ongoing}
          hint="Not finished yet"
          icon={<Loader className="h-4 w-4 text-blue-600" />}
          tone="border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10"
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          hint="Done this sprint"
          icon={<CircleCheck className="h-4 w-4 text-emerald-600" />}
          tone="border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          hint="Past expected end"
          icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
          tone="border-orange-300 bg-orange-50 dark:border-orange-500/40 dark:bg-orange-500/15"
          warn={stats.overdue > 0}
        />
      </div>

      {stats.overdue > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:border-orange-500/50 dark:bg-orange-500/15 dark:text-orange-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
          <div>
            <p className="font-semibold text-orange-900 dark:text-orange-100">
              Warning: {stats.overdue} overdue {stats.overdue === 1 ? 'task' : 'tasks'}
            </p>
            {!compact && (
              <ul className="mt-1 space-y-0.5 text-orange-800 dark:text-orange-200/90">
                {overdueTasks.slice(0, 6).map(task => (
                  <li key={task.id} className="truncate">
                    {task.name}
                    {task.externalId ? ` · ${task.externalId}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label, value, hint, icon, tone, warn,
}: {
  label: string
  value: number
  hint: string
  icon: ReactNode
  tone: string
  warn?: boolean
}) {
  return (
    <div className={cn('rounded-xl border px-4 py-3', tone, warn && 'ring-1 ring-orange-400/70')}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-soft">{label}</p>
        {icon}
      </div>
      <p className={cn('mt-1 text-2xl font-bold', warn ? 'text-orange-600 dark:text-orange-300' : 'text-ink')}>{value}</p>
      <p className="text-xs text-soft">{hint}</p>
    </div>
  )
}
