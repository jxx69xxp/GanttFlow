import { create } from 'zustand'
import type { GanttTask, ViewMode } from '@/lib/types'

interface GanttFilters {
  sprint: string
  assignee: string
  status: string
  search: string
  from: string
  to: string
}

interface GanttStore {
  viewMode: ViewMode
  filters: GanttFilters
  selectedTask: GanttTask | null
  drawerOpen: boolean
  chartId: string
  chartFrom: string
  chartTo: string
  chartReady: boolean
  setViewMode: (m: ViewMode) => void
  setFilter: (key: keyof GanttFilters, value: string) => void
  resetFilters: () => void
  selectTask: (t: GanttTask | null) => void
  closeDrawer: () => void
  openChart: (chart: { id: string; startDate: string; endDate: string; viewMode?: ViewMode }) => void
  selectSprint: (sprint: { name: string; startDate: string; endDate: string; chartId?: string | null }) => void
  generateChart: (from: string, to: string) => void
  extendChart: () => void
}

const DEFAULT_FILTERS: GanttFilters = {
  sprint: '', assignee: '', status: '', search: '', from: '', to: '',
}

function addPeriod(iso: string, mode: ViewMode): string {
  const d = new Date(`${iso}T00:00:00`)
  if (mode === 'Day' || mode === 'Week') d.setDate(d.getDate() + 7)
  else if (mode === 'Month') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export const useGanttStore = create<GanttStore>(set => ({
  viewMode: 'Week',
  filters: DEFAULT_FILTERS,
  selectedTask: null,
  drawerOpen: false,
  chartId: '',
  chartFrom: '',
  chartTo: '',
  chartReady: false,
  setViewMode: m => set({ viewMode: m }),
  setFilter: (key, value) =>
    set(s => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set(s => ({
    filters: {
      ...DEFAULT_FILTERS,
      sprint: s.filters.sprint,
      from: s.chartFrom,
      to: s.chartTo,
    },
  })),
  selectTask: t => set({ selectedTask: t, drawerOpen: !!t }),
  closeDrawer: () => set({ drawerOpen: false, selectedTask: null }),
  openChart: chart => set({
    chartId: chart.id,
    chartFrom: chart.startDate,
    chartTo: chart.endDate,
    chartReady: true,
    viewMode: chart.viewMode ?? 'Week',
    filters: { ...DEFAULT_FILTERS, from: chart.startDate, to: chart.endDate },
  }),
  selectSprint: sprint => set({
    chartId: sprint.chartId ?? '',
    chartFrom: sprint.startDate,
    chartTo: sprint.endDate,
    chartReady: true,
    filters: {
      ...DEFAULT_FILTERS,
      sprint: sprint.name,
      from: sprint.startDate,
      to: sprint.endDate,
    },
  }),
  generateChart: (from, to) => set(s => ({
    chartFrom: from,
    chartTo: to,
    chartReady: true,
    filters: { ...s.filters, from, to },
  })),
  extendChart: () => set(s => {
    if (!s.chartTo) return s
    const chartTo = addPeriod(s.chartTo, s.viewMode)
    return {
      chartTo,
      filters: { ...s.filters, to: chartTo },
    }
  }),
}))
