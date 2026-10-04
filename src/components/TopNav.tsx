'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, BarChart2, Moon, Sun, PanelLeft, Bell, LogOut, UserRound } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useTheme } from './ThemeProvider'
import { useGanttStore } from '@/store/ganttStore'
import { useInbox, unreadCount } from '@/lib/hooks/useInbox'

const ITEM = 'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-hover'

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

          {me?.email && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-1 hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 sm:pr-3"
                aria-label="Account menu"
                title={me.email}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold uppercase text-white">
                  {(me.name || me.email)[0]}
                </span>
                <span className="hidden max-w-[160px] truncate text-sm font-medium text-ink sm:inline">{me.name || me.email}</span>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[200px] rounded-lg border border-line bg-panel p-1 shadow-xl">
                  <div className="px-2.5 py-2">
                    {me.name && <p className="truncate text-sm font-semibold text-ink">{me.name}</p>}
                    <p className="truncate text-xs text-muted">{me.email}</p>
                  </div>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Item asChild>
                    <Link href="/profile" className={cn(ITEM, pathname === '/profile' && 'font-semibold')}>
                      <UserRound className="h-4 w-4" /> Profile
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link href="/settings" className={cn(ITEM, pathname === '/settings' && 'font-semibold')}>
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Item onSelect={signOut} className={ITEM}>
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </nav>

    </>
  )
}
