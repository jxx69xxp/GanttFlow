'use client'
import { useQuery } from '@tanstack/react-query'
import { Bell, UserPlus, CircleCheck, TriangleAlert, Flag, CircleAlert } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const EVENT_META: Record<string, { label: string; icon: LucideIcon }> = {
  task_assigned:   { label: 'Assigned', icon: UserPlus },
  task_completed:  { label: 'Completed', icon: CircleCheck },
  task_overdue:    { label: 'Overdue', icon: TriangleAlert },
  sprint_reminder: { label: 'Sprint Reminder', icon: Flag },
  sync_error:      { label: 'Sync Error', icon: CircleAlert },
}

export default function NotificationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications').then(r => r.json()),
    refetchInterval: 30_000,
  })

  const notifications: {
    id: string; event: string; recipient: string;
    status: string; errorMsg?: string; sentAt: string
  }[] = data?.notifications ?? []

  return (
    <div className="h-full min-h-0 overflow-y-auto">
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-xl font-bold text-ink">Notification Log</h1>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-soft">Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-soft">
          <Bell className="h-8 w-8 text-soft" />
          <p>No notifications sent yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-input">
              <tr>
                {['Event', 'Recipient', 'Status', 'Sent At'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-soft">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-panel">
              {notifications.map(n => {
                const meta = EVENT_META[n.event]
                const Icon = meta?.icon ?? Bell
                return (
                  <tr key={n.id} className="hover:bg-input/50 transition-colors">
                    <td className="px-4 py-3 text-muted">
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-soft" />
                        {meta?.label ?? n.event}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{n.recipient}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                        n.status === 'sent'
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'bg-red-500/10 text-red-700 dark:text-red-400'
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', n.status === 'sent' ? 'bg-green-400' : 'bg-red-400')} />
                        {n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-soft text-xs">{formatDate(n.sentAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  )
}
