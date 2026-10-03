'use client'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GanttTask } from '@/lib/types'

export interface FeedItem {
  name: string
  subject: string
  type: 'Mention' | 'Assignment' | string
  document_type?: string
  document_name?: string
  from_user?: string
  read?: number
  creation: string
  task: GanttTask | null
}
export type InboxFilter = 'all' | 'unread' | 'read'
export interface Inbox {
  me: string
  filter: InboxFilter; page: number; pageSize: number; total: number; unread: number
  feed: FeedItem[]; assigned: GanttTask[]
}

// The Notifications page, the top-bar bell and the sidebar badge all read ['inbox', …].
// ponytail: badge polls a full inbox page (ERP feed + counts + local task scan) every 60s; add a count-only endpoint if it gets slow.
export function useInbox(filter: InboxFilter = 'all', page = 1) {
  return useQuery({
    queryKey: ['inbox', filter, page],
    queryFn: async () => {
      const r = await fetch(`/api/notifications/inbox?filter=${filter}&page=${page}`)
      const json = await r.json()
      if (!r.ok) throw new Error(json.error ?? 'Could not load notifications')
      return json as Inbox
    },
    placeholderData: keepPreviousData,  // no flash between pages
    refetchInterval: 60_000,
    retry: false,
  })
}

export const unreadCount = (inbox?: Inbox) => inbox?.unread ?? 0

/** Toggle read in Frappe. Badge + item update immediately everywhere; refetch afterwards for true counts/pages. */
export function useMarkRead() {
  const qc = useQueryClient()
  const patch = (name: string, read: number) =>
    qc.setQueriesData<Inbox>({ queryKey: ['inbox'] }, old => {
      const item = old?.feed.find(f => f.name === name)
      if (!old || !item || Number(item.read ?? 0) === read) return old
      return {
        ...old,
        unread: Math.max(0, old.unread + (read ? -1 : 1)),
        feed: old.feed.map(f => f.name === name ? { ...f, read } : f),
      }
    })
  return useMutation({
    mutationFn: async ({ name, read }: { name: string; read: boolean }) => {
      const r = await fetch('/api/notifications/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, read }),
      })
      if (!r.ok) throw new Error('update failed')
    },
    onMutate: ({ name, read }) => patch(name, read ? 1 : 0),
    onError: (_e, { name, read }) => patch(name, read ? 0 : 1),
    onSettled: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/notifications/inbox', { method: 'PATCH' })
      const json = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(json.error ?? 'Mark all read failed')
      return json as { updated: number }
    },
    onMutate: () => qc.setQueriesData<Inbox>({ queryKey: ['inbox'] }, old => old && {
      ...old, unread: 0, feed: old.feed.map(f => ({ ...f, read: 1 })),
    }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  })
}
