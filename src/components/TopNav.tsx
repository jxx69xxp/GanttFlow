'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RefreshCw, Settings, BarChart2, Moon, Sun, PanelLeft } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useTheme } from './ThemeProvider'
import { useGanttStore } from '@/store/ganttStore'

export function TopNav() {
  const pathname = usePathname()
  const qc = useQueryClient()
  const [toast, setToast] = useState('')
  const { theme, toggle } = useTheme()
  const toggleSidebar = useGanttStore(s => s.toggleSidebar)
  const sidebarOpen = useGanttStore(s => s.sidebarOpen)

  const syncMutation = useMutation({
    mutationFn: () => fetch('/api/sync', { method: 'POST' }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setToast(`Sync complete — ${data.tasksAdded ?? 0} added, ${data.tasksUpdated ?? 0} updated`)
      setTimeout(() => setToast(''), 4000)
    },
    onError: () => {
      setToast('Sync failed. Check API keys in Settings (not username/password).')
      setTimeout(() => setToast(''), 4000)
    },
  })

  return (
    <>
      <nav className="flex h-14 items-center justify-between border-b border-line bg-panel px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-input text-ink hover:bg-hover"
            aria-label={sidebarOpen ? 'Hide menu' : 'Show menu'}
            title={sidebarOpen ? 'Hide menu' : 'Show menu'}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <BarChart2 className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-bold tracking-tight text-ink">GanttFlow</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-input text-ink hover:bg-hover"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 rounded-md border border-line bg-input px-3 py-1.5 text-sm font-medium text-ink hover:bg-hover disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', syncMutation.isPending && 'animate-spin')} />
            {syncMutation.isPending ? 'Syncing…' : 'Sync'}
          </button>

          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium',
              pathname === '/settings'
                ? 'bg-blue-600 text-white'
                : 'text-muted hover:bg-hover hover:text-ink'
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </nav>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-ink shadow-xl">
          {toast}
        </div>
      )}
    </>
  )
}
