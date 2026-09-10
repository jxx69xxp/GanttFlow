'use client'
import { Flag, ListPlus, CalendarRange } from 'lucide-react'
import { CreateSprintDialog } from './CreateSprintDialog'
import { CreateTaskDialog } from './CreateTaskDialog'
import { formatDate } from '@/lib/utils'

interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  externalId?: string
}

export function SetupBoard({ sprints }: { sprints: Sprint[] }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8" data-testid="setup-board">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">First-time setup</p>
        <h2 className="mt-1 text-xl font-semibold text-ink">Set up your board, then the Gantt appears</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Gantt rows come from the Frappe <span className="text-ink">Sprint Backlogs</span> doctype
          (for example SPB-05459), not the Sprint doctype. Sync pulls backlogs assigned to
          <span className="text-ink"> CORE_DEVELOPMENT_-_1</span>.
        </p>
      </div>

      <ol className="space-y-4">
        <li className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hover text-xs font-bold text-ink">1</span>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Flag className="h-4 w-4 text-muted" />
                  Create a sprint
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Maps to Frappe fields sprint_name, date_from, and date_to. Sync also imports enabled sprints from ERP.
                </p>
              </div>
            </div>
            <CreateSprintDialog variant="setup" />
          </div>
          {sprints.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-line pt-4">
              {sprints.map(s => (
                <li key={s.id} className="flex items-center justify-between rounded-lg bg-panel px-3 py-2 text-sm">
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className="flex items-center gap-1 text-xs text-soft">
                    <CalendarRange className="h-3.5 w-3.5" />
                    {formatDate(s.startDate)} – {formatDate(s.endDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>

        <li className={`rounded-xl border p-5 ${sprints.length === 0 ? 'border-line bg-app opacity-60' : 'border-line bg-panel'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hover text-xs font-bold text-ink">2</span>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <ListPlus className="h-4 w-4 text-muted" />
                  Add issues
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {sprints.length === 0
                    ? 'Create a sprint first, then add issues to it.'
                    : 'Add a task with from / to dates. It will show as a bar on the Gantt.'}
                </p>
              </div>
            </div>
            {sprints.length > 0 && (
              <CreateTaskDialog
                sprintId={sprints[0].externalId || sprints[0].id}
                sprintName={sprints[0].name}
                sprints={sprints}
              />
            )}
          </div>
        </li>

        <li className="rounded-xl border border-line bg-app p-5">
          <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-input text-xs font-bold text-muted">3</span>
            <div>
              <h3 className="text-sm font-semibold text-muted">Timeline fills in automatically</h3>
              <p className="mt-1 text-xs text-soft">
                After you add an issue, this page switches to the Gantt chart. Use Day, Week, Month, or Year for the columns.
              </p>
            </div>
          </div>
        </li>
      </ol>
    </div>
  )
}
