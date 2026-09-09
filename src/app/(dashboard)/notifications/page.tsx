'use client'
import { useQuery } from '@tanstack/react-query'
import { cn, formatDate } from '@/lib/utils'

const EVENT_LABELS: Record<string, string> = {
  task_assigned:  '📋 Assigned',
  task_completed: '✅ Completed',
  task_overdue:   '⚠️ Overdue',
  sprint_reminder:'🏃 Sprint Reminder',
  sync_error:     '🔴 Sync Error',
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
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-xl font-bold text-slate-100">Notification Log</h1>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-500">Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-500">
          <span className="text-3xl">🔔</span>
          <p>No notifications sent yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                {['Event', 'Recipient', 'Status', 'Sent At'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 bg-slate-900">
              {notifications.map(n => (
                <tr key={n.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-slate-300">{EVENT_LABELS[n.event] ?? n.event}</td>
                  <td className="px-4 py-3 text-slate-400">{n.recipient}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                      n.status === 'sent'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', n.status === 'sent' ? 'bg-green-400' : 'bg-red-400')} />
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(n.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
