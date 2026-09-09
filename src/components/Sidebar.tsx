'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Bell, Settings, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'

const NAV = [
  { href: '/', label: 'Gantt Chart', icon: BarChart2 },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  const { data } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetch('/api/tasks').then(r => r.json()),
  })

  const sprints: { name: string }[] = data?.sprints ?? []

  return (
    <aside className="hidden w-56 flex-col border-r border-slate-700 bg-slate-900 md:flex">
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      {sprints.length > 0 && (
        <div className="border-t border-slate-700 p-3">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sprints
          </p>
          {sprints.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-400"
            >
              <ChevronRight className="h-3 w-3" />
              {s.name}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-700 p-3">
        <p className="px-3 text-xs text-slate-600">GanttFlow v1.0</p>
      </div>
    </aside>
  )
}
