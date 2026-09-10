import type { GanttBoard, ViewMode } from '@/lib/types'

function toYmd(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toISOString().slice(0, 10)
}

export function toGanttBoard(chart: {
  id: string
  name: string
  startDate: Date
  endDate: Date
  viewMode: string
  _count?: { tasks: number }
}): GanttBoard {
  return {
    id: chart.id,
    name: chart.name,
    startDate: toYmd(chart.startDate),
    endDate: toYmd(chart.endDate),
    viewMode: (chart.viewMode as ViewMode) || 'Week',
    taskCount: chart._count?.tasks ?? 0,
  }
}
