'use client'
import { useEffect, useRef } from 'react'
import { useGanttStore } from '@/store/ganttStore'
import { STATUS_COLORS, type GanttTask } from '@/lib/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'

declare global {
  interface Window { Gantt: typeof import('frappe-gantt') }
}

interface Props { tasks: GanttTask[] }

export function GanttChart({ tasks }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<unknown>(null)
  const { viewMode, selectTask } = useGanttStore()
  const qc = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: ({ id, startDate, endDate }: { id: string; startDate: string; endDate: string }) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  useEffect(() => {
    if (!containerRef.current || tasks.length === 0) return

    // Dynamically load frappe-gantt CSS
    if (!document.querySelector('#frappe-gantt-css')) {
      const link = document.createElement('link')
      link.id = 'frappe-gantt-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.css'
      document.head.appendChild(link)
    }

    import('frappe-gantt').then(({ default: Gantt }) => {
      containerRef.current!.innerHTML = '<svg class="gantt"></svg>'
      const svg = containerRef.current!.querySelector('svg')!

      const frappeTasks = tasks.map(t => ({
        id: t.id,
        name: t.name,
        start: t.start || new Date().toISOString().slice(0, 10),
        end: t.end || new Date().toISOString().slice(0, 10),
        progress: t.progress,
        custom_class: `status-${t.status.replace(/\s+/g, '-').toLowerCase()}`,
      }))

      ganttRef.current = new Gantt(svg, frappeTasks, {
        view_mode: viewMode,
        on_click: (task: { id: string }) => {
          const found = tasks.find(t => t.id === task.id)
          if (found) selectTask(found)
        },
        on_date_change: (task: { id: string }, start: Date, end: Date) => {
          updateMutation.mutate({
            id: task.id,
            startDate: start.toISOString().slice(0, 10),
            endDate:   end.toISOString().slice(0, 10),
          })
        },
        on_progress_change: () => {},
        custom_popup_html: (task: { id: string; name: string; _start: Date; _end: Date; progress: number }) => {
          const t = tasks.find(g => g.id === task.id)
          const color = STATUS_COLORS[t?.status ?? 'Not Started']
          return `<div class="gantt-popup" style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px;min-width:200px;color:#f8fafc;font-size:13px">
            <strong style="display:block;margin-bottom:6px">${task.name}</strong>
            <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;background:${color}22;color:${color};margin-bottom:8px">${t?.status ?? ''}</span>
            <div style="color:#94a3b8;font-size:11px">${task._start?.toDateString()} → ${task._end?.toDateString()}</div>
            <div style="color:#94a3b8;font-size:11px;margin-top:4px">Progress: ${task.progress}%</div>
            ${t?.assigneeEmail ? `<div style="color:#94a3b8;font-size:11px;margin-top:4px">👤 ${t.assigneeEmail}</div>` : ''}
          </div>`
        },
      })

      // Inject custom CSS for status colors
      if (!document.querySelector('#gantt-status-styles')) {
        const style = document.createElement('style')
        style.id = 'gantt-status-styles'
        style.textContent = `
          .gantt .bar { fill: #3b82f6; }
          .gantt .bar-wrapper.status-not-started .bar { fill: #94a3b8; }
          .gantt .bar-wrapper.status-in-progress .bar { fill: #3b82f6; }
          .gantt .bar-wrapper.status-completed .bar   { fill: #22c55e; }
          .gantt .bar-wrapper.status-overdue .bar     { fill: #ef4444; }
          .gantt .bar-wrapper.status-blocked .bar     { fill: #f97316; }
          .gantt .grid-header { fill: #0f172a; }
          .gantt .grid-row    { fill: #1e293b; }
          .gantt .grid-row:nth-child(even) { fill: #0f172a; }
          .gantt .row-line    { stroke: #334155; }
          .gantt .tick        { stroke: #334155; }
          .gantt .today-highlight { fill: #3b82f620; }
          .gantt .lower-text, .gantt .upper-text { fill: #94a3b8; font-size: 12px; }
        `
        document.head.appendChild(style)
      }
    })

    return () => { if (containerRef.current) containerRef.current.innerHTML = '' }
  }, [tasks, viewMode])

  return (
    <div
      ref={containerRef}
      data-testid="gantt-chart"
      className="min-h-[400px] w-full overflow-x-auto p-4"
    />
  )
}
