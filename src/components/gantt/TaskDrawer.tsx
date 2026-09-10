'use client'
import { X, ExternalLink, CheckCircle, Link2, Flag } from 'lucide-react'
import { useGanttStore } from '@/store/ganttStore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { STATUS_COLORS, type TaskStatus } from '@/lib/types'
import { formatDate } from '@/lib/utils'

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-soft mb-1">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  )
}

export function TaskDrawer({ colors = STATUS_COLORS }: { colors?: Record<TaskStatus, string> }) {
  const { selectedTask, drawerOpen, closeDrawer } = useGanttStore()
  const qc = useQueryClient()

  const completeMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/tasks/${selectedTask?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed', progress: 100 }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); closeDrawer() },
  })

  if (!drawerOpen || !selectedTask) return null

  const color = colors[selectedTask.status] ?? STATUS_COLORS[selectedTask.status]
  const duration = selectedTask.start && selectedTask.end
    ? Math.ceil((new Date(selectedTask.end).getTime() - new Date(selectedTask.start).getTime()) / 86400000)
    : null
  const isBacklog = selectedTask.externalId?.startsWith('SPB-')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={closeDrawer} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-line bg-panel shadow-2xl">
        <div className="flex items-start justify-between border-b border-line p-4">
          <div>
            <p className="text-xs text-soft mb-1">
              {isBacklog ? 'Sprint Backlog' : 'Task Detail'}
            </p>
            <h2 className="font-semibold text-ink leading-snug">{selectedTask.name}</h2>
            {isBacklog && (
              <p className="mt-1 text-xs font-mono text-muted">{selectedTask.externalId}</p>
            )}
          </div>
          <button onClick={closeDrawer} className="rounded-md p-1 text-soft hover:bg-input">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div>
            <p className="text-xs text-soft mb-1">Status</p>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: `${color}22`, color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {selectedTask.erpStatus || selectedTask.status}
            </span>
            {selectedTask.devopsStatus ? (
              <p className="mt-2 text-sm text-ink">
                <span className="text-xs text-soft">DevOps </span>
                {selectedTask.devopsStatus}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority" value={selectedTask.priority} />
            <Field label="Points" value={selectedTask.sprintPoints} />
            <Field label="Type" value={selectedTask.workType} />
            <Field label="Module" value={selectedTask.module} />
          </div>

          <Field label="Sprint" value={selectedTask.sprintId || selectedTask.sprintName} />
          <Field
            label="Parent backlog"
            value={selectedTask.parentBacklogId
              ? `${selectedTask.parentBacklogName || selectedTask.parentBacklogId} (${selectedTask.parentBacklogId})`
              : null}
          />
          <Field label="Project" value={selectedTask.projectName} />

          {selectedTask.assigneeEmail && (
            <div>
              <p className="text-xs text-soft mb-1">Current assignee</p>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {(selectedTask.assigneeName || selectedTask.assigneeEmail)[0].toUpperCase()}
                </div>
                <div>
                  {selectedTask.assigneeName && (
                    <p className="text-sm text-ink">{selectedTask.assigneeName}</p>
                  )}
                  <p className="text-xs text-muted">{selectedTask.assigneeEmail}</p>
                </div>
              </div>
            </div>
          )}
          <Field label="QA assignee" value={selectedTask.qaAssignee} />
          <Field label="Date assigned" value={selectedTask.dateAssigned ? formatDate(selectedTask.dateAssigned) : null} />

          <div>
            <p className="text-xs text-soft mb-2">Timeline</p>
            <div className="rounded-lg bg-input p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-soft">Start</span>
                <span className="text-ink">{formatDate(selectedTask.start)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-soft">End</span>
                <span className="text-ink">{formatDate(selectedTask.end)}</span>
              </div>
              {duration != null && (
                <div className="flex justify-between">
                  <span className="text-soft">Duration</span>
                  <span className="text-ink">{duration} days</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <p className="text-xs text-soft">Progress</p>
              <p className="text-xs font-semibold text-muted">{selectedTask.progress}%</p>
            </div>
            <div className="h-2 rounded-full bg-hover">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${selectedTask.progress}%` }}
              />
            </div>
          </div>

          {selectedTask.dependencies && (
            <Field label="Depends on" value={selectedTask.dependencies} />
          )}

          {selectedTask.description && (
            <div>
              <p className="text-xs text-soft mb-1">Description</p>
              <p className="whitespace-pre-wrap text-sm text-muted leading-relaxed">{selectedTask.description}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-soft mb-1">Source</p>
            <p className="flex items-center gap-1.5 text-xs text-muted uppercase tracking-wide">
              {isBacklog || selectedTask.source === 'erpnext' ? (
                <><Link2 className="h-3.5 w-3.5" /> {isBacklog ? 'Sprint Backlogs' : 'ERPNext'}</>
              ) : selectedTask.source === 'sprint_kickoff' ? (
                <><Flag className="h-3.5 w-3.5" /> Sprint Kickoff</>
              ) : (
                'Manual'
              )}
            </p>
          </div>
        </div>

        <div className="border-t border-line p-4 space-y-2">
          {selectedTask.status !== 'Completed' && (
            <button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              {completeMutation.isPending ? 'Marking…' : 'Mark Complete'}
            </button>
          )}
          {selectedTask.source === 'erpnext' && (
            <a
              href={`#`}
              target="_blank"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-sm text-muted hover:bg-input transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in ERPNext
            </a>
          )}
        </div>
      </aside>
    </>
  )
}
