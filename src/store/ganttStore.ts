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
  setViewMode: (m: ViewMode) => void
  setFilter: (key: keyof GanttFilters, value: string) => void
  resetFilters: () => void
  selectTask: (t: GanttTask | null) => void
  closeDrawer: () => void
}

const DEFAULT_FILTERS: GanttFilters = {
  sprint: '', assignee: '', status: '', search: '', from: '', to: '',
}

export const useGanttStore = create<GanttStore>(set => ({
  viewMode: 'Week',
  filters: DEFAULT_FILTERS,
  selectedTask: null,
  drawerOpen: false,
  setViewMode: m => set({ viewMode: m }),
  setFilter: (key, value) =>
    set(s => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  selectTask: t => set({ selectedTask: t, drawerOpen: !!t }),
  closeDrawer: () => set({ drawerOpen: false, selectedTask: null }),
}))
