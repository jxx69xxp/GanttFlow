'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RefreshCw, Settings, BarChart2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function TopNav() {
  const pathname = usePathname()
  const qc = useQueryClient()
  const [toast, setToast] = useState('')

  const syncMutation = useMutation({
    mutationFn: () => fetch('/api/sync', { method: 'POST' }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setToast(`✓ Sync complete — ${data.tasksAdded ?? 0} added, ${data.tasksUpdated ?? 0} updated`)
      setTimeout(() => setToast(''), 4000)
    },
    onError: () => {
      setToast('✗ Sync failed. Check your credentials in Settings.')
      setTimeout(() => setToast(''), 4000)
    },
  })

  return (
    <>
      <nav className="flex h-14 items-center justify-between border-b border-slate-700 bg-slate-900 px-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-5 w-5 text-blue-400" />
          <span className="text-lg font-bold tracking-tight">GanttFlow</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', syncMutation.isPending && 'animate-spin')} />
            {syncMutation.isPending ? 'Syncing…' : 'Sync'}
          </button>

          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              pathname === '/settings'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </nav>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-sm shadow-xl">
          {toast}
        </div>
      )}
    </>
  )
}
