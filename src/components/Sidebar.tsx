'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { BarChart2, Bell, LayoutDashboard, Settings, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useGanttStore } from '@/store/ganttStore'

const NAV = [
  { href: '/', label: 'Gantt Chart', icon: BarChart2 },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SprintLink {
  id: string
  name: string
  externalId?: string
  chartId?: string | null
}

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const sidebarOpen = useGanttStore(s => s.sidebarOpen)
  useEffect(() => {
    setMounted(true)
    if (localStorage.getItem('ganttflow-sidebar') === 'hidden') {
      useGanttStore.setState({ sidebarOpen: false })
    }
  }, [])
  const activeSprint = mounted ? searchParams.get('sprint') : null

  const { data } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => fetch('/api/sprints').then(r => r.json()),
  })
  const sprints: SprintLink[] = data?.sprints ?? []

  return (
    <aside suppressHydrationWarning className={cn(
      'flex-col border-r border-line bg-panel',
      !mounted ? 'hidden w-52 md:flex' : sidebarOpen ? 'flex w-52' : 'hidden',
    )}>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              (href === '/' ? pathname === '/' : pathname === href)
                ? 'bg-blue-600 text-white'
                : 'text-muted hover:bg-hover hover:text-ink'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-soft">
            Sprints
          </p>
          <Link
            href="/?new=1"
            className="rounded-md p-1 text-soft hover:bg-hover hover:text-ink"
            title="New sprint"
          >
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>
        {sprints.length === 0 && (
          <p className="px-1 text-xs text-soft">No sprints yet</p>
        )}
        {sprints.map(s => {
          const key = s.externalId || s.id
          return (
            <Link
              key={key}
              href={`/?sprint=${encodeURIComponent(key)}${s.chartId ? `&chart=${s.chartId}` : ''}`}
              className={cn(
                'block truncate rounded-lg px-3 py-1.5 text-xs',
                activeSprint === key
                  ? 'bg-hover font-semibold text-ink'
                  : 'text-muted hover:bg-hover hover:text-ink'
              )}
            >
              {s.name}
            </Link>
          )
        })}
      </div>

      <div className="border-t border-line p-3">
        <p className="px-3 text-xs text-soft">GanttFlow v1.0</p>
      </div>
    </aside>
  )
}
