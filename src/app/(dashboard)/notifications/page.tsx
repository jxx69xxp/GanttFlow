'use client'
import { Fragment, useState } from 'react'
import { AtSign, BellOff, CheckCheck, ChevronLeft, ChevronRight, Circle, CircleDot, Loader2, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { TaskDrawer } from '@/components/gantt/TaskDrawer'
import { useGanttStore } from '@/store/ganttStore'
import { useInbox, useMarkAllRead, useMarkRead, unreadCount, type FeedItem, type InboxFilter } from '@/lib/hooks/useInbox'
import { PRIORITY_STYLES, isOverdueTask, priorityRank } from '@/lib/types'
import { safeHtml } from '@/lib/safeHtml'
import { cn, dayDiff, formatDate, initials, relativeTime } from '@/lib/utils'

const FILTERS: Array<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'unread', label: 'Unread' }, { id: 'read', label: 'Read' },
]

function dayLabel(iso: string) {
  const d = dayDiff(iso, new Date())
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : formatDate(iso)
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [page, setPage] = useState(1)
  const { data, isLoading, error, isFetching } = useInbox(filter, page)
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)))
  // items can leave the Unread/Read view when toggled; don't strand the user past the last page
  if (data && !isFetching && page > pages) setPage(pages)
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const unread = unreadCount(data)
  const selectTask = useGanttStore(s => s.selectTask)  // same drawer as clicking a task in the Gantt

  const [opening, setOpening] = useState('')
  const [openError, setOpenError] = useState<{ name: string; msg: string } | null>(null)

  async function openItem(item: FeedItem) {
    if (!item.read) markRead.mutate({ name: item.name, read: true })
    setOpenError(null)
    if (item.task) { selectTask(item.task); return }
    if (!item.document_name || opening) return
    // backlog from a sprint not loaded yet → import it from ERP, then open the same drawer
    setOpening(item.name)
    try {
      const r = await fetch(`/api/tasks/resolve?externalId=${encodeURIComponent(item.document_name)}`)
      const json = await r.json()
      if (!r.ok) throw new Error(json.error ?? 'Could not open task')
      selectTask(json.task)
    } catch (e) {
      setOpenError({ name: item.name, msg: e instanceof Error ? e.message : 'Could not open task' })
    } finally {
      setOpening('')
    }
  }

  const feed = data?.feed ?? []
  const assigned = [...(data?.assigned ?? [])].sort((a, b) =>
    Number(isOverdueTask(b)) - Number(isOverdueTask(a)) || priorityRank(a.priority) - priorityRank(b.priority))

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Notifications"
          description={data ? (unread ? `${unread.toLocaleString()} unread mentions and assignments` : 'You’re all caught up.') : 'Mentions and work assigned to you.'}
          actions={unread > 0 && (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="flex h-10 items-center gap-2 rounded-lg border border-line bg-panel px-4 text-sm font-medium text-ink shadow-sm hover:bg-hover disabled:opacity-60"
            >
              {markAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Mark all as read
            </button>
          )}
        />
        {markAll.isError && <p role="alert" className="text-sm text-red-600">{(markAll.error as Error).message}</p>}

        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="h-96 animate-pulse rounded-2xl border border-line bg-panel" />
            <div className="h-72 animate-pulse rounded-2xl border border-line bg-panel" />
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {(error as Error).message}
          </p>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* ── mentions & assignments ─────────────────────────────────── */}
            <section aria-labelledby="feed-h" className="min-w-0 overflow-hidden rounded-2xl border border-line bg-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                <h2 id="feed-h" className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <AtSign className="h-4 w-4 text-blue-600" /> Mentions &amp; assignments
                </h2>
                <div role="tablist" aria-label="Filter notifications" className="flex rounded-lg bg-hover p-0.5">
                  {FILTERS.map(f => (
                    <button
                      key={f.id} type="button" role="tab" aria-selected={filter === f.id}
                      onClick={() => { setFilter(f.id); setPage(1) }}
                      className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors',
                        filter === f.id ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink')}
                    >
                      {f.label}
                      {f.id === 'unread' && unread > 0 && <span className="ml-1.5 tabular-nums text-blue-600">{unread > 999 ? '999+' : unread}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {feed.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <BellOff className="h-6 w-6 text-soft" />
                  <p className="text-sm text-muted">
                    {filter === 'unread' ? 'No unread notifications.' : filter === 'read' ? 'Nothing read yet.' : 'When someone mentions you or assigns you work, it shows up here.'}
                  </p>
                </div>
              ) : (
                <ol className={cn(isFetching && 'opacity-70 transition-opacity')}>
                  {feed.map((item, i) => {
                    const newDay = i === 0 || dayLabel(feed[i - 1].creation) !== dayLabel(item.creation)
                    const isUnread = !item.read
                    return (
                      <Fragment key={item.name}>
                        {newDay && (
                          <li aria-hidden="true" className="sticky top-0 z-[1] border-b border-line bg-input/90 px-5 py-1.5 text-xs font-medium text-soft backdrop-blur">
                            {dayLabel(item.creation)}
                          </li>
                        )}
                        <li className="group relative flex gap-3 border-b border-line px-5 py-3.5 last:border-b-0 hover:bg-hover/50">
                          {isUnread && <span className="absolute inset-y-0 left-0 w-0.5 bg-blue-600" aria-hidden="true" />}
                          {/* div+role: the subject HTML may contain links, which can't nest inside a <button> */}
                          <div
                            role="button" tabIndex={0}
                            onClick={() => openItem(item)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(item) } }}
                            className="flex min-w-0 flex-1 cursor-pointer gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                          >
                            <span aria-hidden="true" className={cn(
                              'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              isUnread ? 'bg-blue-600 text-white' : 'bg-hover text-muted',
                            )}>
                              {initials(item.from_user)}
                              <span className={cn('absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-panel',
                                item.type === 'Mention' ? 'bg-violet-500' : 'bg-emerald-500')}>
                                {item.type === 'Mention' ? <AtSign className="h-2.5 w-2.5 text-white" /> : <UserPlus className="h-2.5 w-2.5 text-white" />}
                              </span>
                            </span>
                            <div className="min-w-0 flex-1">
                              <div
                                className={cn('text-sm leading-snug [&_a]:pointer-events-none [&_b]:font-semibold', isUnread ? 'text-ink' : 'text-muted')}
                                dangerouslySetInnerHTML={{ __html: safeHtml(item.subject) }}
                              />
                              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-soft">
                                <time dateTime={item.creation} title={new Date(item.creation).toLocaleString()}>{relativeTime(item.creation)}</time>
                                {item.document_name && <span>{item.document_name}</span>}
                                {opening === item.name && <span className="flex items-center gap-1 text-blue-600"><Loader2 className="h-3 w-3 animate-spin" />Opening…</span>}
                                {openError?.name === item.name && <span className="text-red-600">{openError.msg}</span>}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => markRead.mutate({ name: item.name, read: !item.read })}
                            aria-label={isUnread ? 'Mark as read' : 'Mark as unread'}
                            title={isUnread ? 'Mark as read' : 'Mark as unread'}
                            className="self-start rounded-md p-1.5 text-soft opacity-60 hover:bg-hover hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            {isUnread ? <CircleDot className="h-4 w-4 text-blue-600" /> : <Circle className="h-4 w-4" />}
                          </button>
                        </li>
                      </Fragment>
                    )
                  })}
                </ol>
              )}

              {data && data.total > data.pageSize && (
                <nav aria-label="Notification pages" className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted">
                  <span className="tabular-nums">
                    {((page - 1) * data.pageSize + 1).toLocaleString()}–{Math.min(page * data.pageSize, data.total).toLocaleString()} of {data.total.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPage(p => p - 1)} disabled={page <= 1} aria-label="Previous page"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line hover:bg-hover disabled:opacity-40">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 tabular-nums">Page {page} of {pages}</span>
                    <button type="button" onClick={() => setPage(p => p + 1)} disabled={page >= pages} aria-label="Next page"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line hover:bg-hover disabled:opacity-40">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </nav>
              )}
            </section>

            {/* ── assigned to you ─────────────────────────────────────────── */}
            <section aria-labelledby="assigned-h" className="min-w-0 overflow-hidden rounded-2xl border border-line bg-panel lg:sticky lg:top-0">
              <h2 id="assigned-h" className="flex items-center gap-2 border-b border-line px-5 py-3 text-sm font-semibold text-ink">
                <UserPlus className="h-4 w-4 text-blue-600" /> Assigned to you
                <span className="ml-auto text-xs font-normal text-soft">{assigned.length} open</span>
              </h2>
              {assigned.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted">Nothing open is assigned to you.</p>
              ) : (
                <ul className="max-h-[70vh] overflow-y-auto">
                  {assigned.map(t => {
                    const overdue = isOverdueTask(t)
                    const pr = t.priority ? PRIORITY_STYLES[t.priority] : undefined
                    const due = t.end ? dayDiff(new Date(), t.end) : null
                    return (
                      <li key={t.id} className="border-b border-line last:border-b-0">
                        <button type="button" onClick={() => selectTask(t)} className="block w-full px-5 py-3 text-left hover:bg-hover/50 focus-visible:bg-hover/50 focus-visible:outline-none">
                          <p className="line-clamp-2 text-sm font-medium text-ink">{t.name}</p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-soft">
                            {t.priority && (
                              <span className="rounded-full px-1.5 py-px font-semibold" style={pr ? { color: pr.color, background: `${pr.color}1a` } : undefined}>{t.priority}</span>
                            )}
                            <span>{t.erpStatus || t.status}</span>
                            {due !== null && (
                              <span className={cn(overdue && 'font-semibold text-orange-600')}>
                                {overdue ? `${Math.abs(due)}d late` : due === 0 ? 'due today' : `due in ${due}d`}
                              </span>
                            )}
                            <span className="truncate">{t.sprintName}</span>
                          </p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
      <TaskDrawer />
    </div>
  )
}
