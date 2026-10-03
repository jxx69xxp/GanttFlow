'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Bell, LayoutDashboard, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGanttStore } from '@/store/ganttStore'
import { useInbox, unreadCount } from '@/lib/hooks/useInbox'

// Settings lives in the top bar; sprints are tabs on the Gantt page.
const NAV = [
  { href: '/', label: 'Gantt Chart', icon: BarChart2 },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: UserRound },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const sidebarOpen = useGanttStore(s => s.sidebarOpen)
  const unread = unreadCount(useInbox().data)
  useEffect(() => {
    setMounted(true)
    // phones start closed (it's an overlay there); desktop remembers the user's choice
    if (window.matchMedia('(max-width: 767px)').matches || localStorage.getItem('ganttflow-sidebar') === 'hidden') {
      useGanttStore.setState({ sidebarOpen: false })
    }
  }, [])
  const closeOnPhone = () => {
    if (window.matchMedia('(max-width: 767px)').matches) useGanttStore.setState({ sidebarOpen: false })
  }

  return (
    <>
    {/* phone: overlay drawer with a backdrop; md+: in-flow column */}
    {mounted && sidebarOpen && (
      <div className="fixed inset-0 top-14 z-30 bg-black/30 md:hidden" onClick={closeOnPhone} aria-hidden="true" />
    )}
    <aside suppressHydrationWarning className={cn(
      'flex-col border-r border-line bg-panel max-md:fixed max-md:bottom-0 max-md:left-0 max-md:top-14 max-md:z-40 max-md:shadow-xl',
      !mounted ? 'hidden w-52 md:flex' : sidebarOpen ? 'flex w-52' : 'hidden',
    )}>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={closeOnPhone}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-muted hover:bg-hover hover:text-ink'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {href === '/notifications' && unread > 0 && (
              <span className={cn(
                'ml-auto min-w-[20px] rounded-full px-1.5 text-center text-[11px] font-bold leading-5',
                pathname === href ? 'bg-white text-blue-700' : 'bg-red-600 text-white',
              )} aria-label={`${unread} unread`}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <p className="px-3 text-xs text-soft">GanttFlow v1.0</p>
      </div>
    </aside>
    </>
  )
}
