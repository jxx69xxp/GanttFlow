'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, BarChart2, Moon, Sun, PanelLeft, Bell, LogOut } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useTheme } from './ThemeProvider'
import { useGanttStore } from '@/store/ganttStore'
import { useInbox, unreadCount } from '@/lib/hooks/useInbox'

export function TopNav() {
  const pathname = usePathname()
  const qc = useQueryClient()
  const { theme, toggle } = useTheme()
  const toggleSidebar = useGanttStore(s => s.toggleSidebar)
  const sidebarOpen = useGanttStore(s => s.sidebarOpen)
  const unread = unreadCount(useInbox().data)
  const router = useRouter()
  const { data: me } = useQuery<{ email: string | null; name?: string | null; isAdmin?: boolean }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me').then(r => r.json()),
    staleTime: Infinity,
  })
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    qc.clear()
    router.replace('/login')
  }


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
          <span className="hidden text-lg font-bold tracking-tight text-ink sm:inline">GanttFlow</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line bg-input text-ink hover:bg-hover"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-input text-ink hover:bg-hover"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
            <span className="hidden sm:inline">Settings</span>
          </Link>

          {me?.email && (
            <div className="ml-1 flex items-center gap-2 border-l border-line pl-3">
              <Link href="/profile" className="hidden max-w-[180px] truncate text-xs text-muted hover:text-ink hover:underline sm:inline" title={me.email}>
                {me.name || me.email}
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-input text-ink hover:bg-hover"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </nav>

    </>
  )
}
