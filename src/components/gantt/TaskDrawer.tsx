'use client'
import { X, ExternalLink, CheckCircle } from 'lucide-react'
import { useGanttStore } from '@/store/ganttStore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { STATUS_COLORS } from '@/lib/types'
import { formatDate, cn } from '@/lib/utils'

export function TaskDrawer() {
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

  const color = STATUS_COLORS[selectedTask.status]
  const duration = selectedTask.start && selectedTask.end
    ? Math.ceil((new Date(selectedTask.end).getTime() - new Date(selectedTask.start).getTime()) / 86400000)
    : null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={closeDrawer} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-700 p-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Task Detail</p>
            <h2 className="font-semibold text-slate-100 leading-snug">{selectedTask.name}</h2>
          </div>
          <button onClick={closeDrawer} className="rounded-md p-1 text-slate-500 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Status */}
          <div>
            <p className="text-xs text-slate-500 mb-1">Status</p>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: `${color}22`, color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {selectedTask.status}
            </span>
          </div>

          {/* Sprint / Project */}
          {selectedTask.sprintName && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Sprint</p>
              <p className="text-sm text-slate-200">{selectedTask.sprintName}</p>
            </div>
          )}
          {selectedTask.projectName && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Project</p>
              <p className="text-sm text-slate-200">{selectedTask.projectName}</p>
            </div>
          )}

          {/* Assignee */}
          {selectedTask.assigneeEmail && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Assignee</p>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {selectedTask.assigneeEmail[0].toUpperCase()}
                </div>
                <span className="text-sm text-slate-200">{selectedTask.assigneeEmail}</span>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Timeline</p>
            <div className="rounded-lg bg-slate-800 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Start</span>
                <span className="text-slate-200">{formatDate(selectedTask.start)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">End</span>
                <span className="text-slate-200">{formatDate(selectedTask.end)}</span>
              </div>
              {duration && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration</span>
                  <span className="text-slate-200">{duration} days</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between mb-1.5">
              <p className="text-xs text-slate-500">Progress</p>
              <p className="text-xs font-semibold text-slate-300">{selectedTask.progress}%</p>
            </div>
            <div className="h-2 rounded-full bg-slate-700">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${selectedTask.progress}%` }}
              />
            </div>
          </div>

          {/* Description */}
          {selectedTask.description && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Description</p>
              <p className="text-sm text-slate-300 leading-relaxed">{selectedTask.description}</p>
            </div>
          )}

          {/* Source */}
          <div>
            <p className="text-xs text-slate-500 mb-1">Source</p>
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              {selectedTask.source === 'erpnext' ? '🔗 ERPNext' : '🏃 Sprint Kickoff'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-700 p-4 space-y-2">
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
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
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
