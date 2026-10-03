'use client'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, KeyRound, Loader2, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Me { email: string | null; name: string | null; isAdmin: boolean }

const FIELD = 'h-10 w-full rounded-lg border border-line bg-input px-3 text-sm text-ink focus:border-blue-600 focus:bg-panel focus:outline-none focus:ring-4 focus:ring-blue-600/15'

async function patchMe(body: object) {
  const r = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json.error ?? 'Couldn’t save')
  return json
}

function Saved({ show, label }: { show: boolean; label: string }) {
  return show ? <span role="status" className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400"><Check className="h-4 w-4" />{label}</span> : null
}

export default function ProfilePage() {
  const qc = useQueryClient()
  const { data: me } = useQuery<Me>({ queryKey: ['me'], queryFn: () => fetch('/api/me').then(r => r.json()), staleTime: Infinity })

  const [name, setName] = useState('')
  useEffect(() => { if (me) setName(me.name ?? '') }, [me])  // eslint-disable-line react-hooks/set-state-in-effect -- seed the form once data arrives

  const nameMutation = useMutation({
    mutationFn: () => patchMe({ name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const mismatch = pw.confirm !== '' && pw.next !== pw.confirm
  const pwMutation = useMutation({
    mutationFn: () => patchMe({ currentPassword: pw.current, newPassword: pw.next }),
    onSuccess: () => setPw({ current: '', next: '', confirm: '' }),
  })

  const initials = (me?.name || me?.email || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {/* identity */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white" aria-hidden="true">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-ink">{me?.name || 'Your profile'}</h1>
            <p className="truncate text-sm text-muted">
              {me?.email}
              {me?.isAdmin && <span className="ml-2 rounded-full bg-blue-600/10 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">Admin</span>}
            </p>
          </div>
        </div>

        {/* name */}
        <form
          onSubmit={e => { e.preventDefault(); nameMutation.mutate() }}
          className="rounded-xl border border-line bg-panel p-5"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><UserRound className="h-4 w-4 text-blue-600" /> Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="p-name" className="text-sm font-medium text-ink">Display name</label>
              <input id="p-name" autoComplete="name" value={name} onChange={e => { setName(e.target.value); nameMutation.reset() }} className={FIELD} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="p-email" className="text-sm font-medium text-ink">Email</label>
              <input id="p-email" value={me?.email ?? ''} readOnly aria-describedby="p-email-hint" className={cn(FIELD, 'cursor-not-allowed text-muted')} />
              <p id="p-email-hint" className="text-xs text-soft">Ask an admin to change your email.</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit" disabled={nameMutation.isPending || name === (me?.name ?? '')}
              className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {nameMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save name
            </button>
            <Saved show={nameMutation.isSuccess} label="Name saved" />
            {nameMutation.isError && <span role="alert" className="text-sm text-red-600">{(nameMutation.error as Error).message}</span>}
          </div>
        </form>

        {/* password */}
        <form
          onSubmit={e => { e.preventDefault(); if (!mismatch) pwMutation.mutate() }}
          className="rounded-xl border border-line bg-panel p-5"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><KeyRound className="h-4 w-4 text-blue-600" /> Change password</h2>
          {/* hidden username helps password managers update the right entry */}
          <input type="email" autoComplete="username" value={me?.email ?? ''} readOnly hidden />
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="p-current" className="text-sm font-medium text-ink">Current password</label>
              <input id="p-current" type="password" autoComplete="current-password" required value={pw.current}
                onChange={e => { setPw(s => ({ ...s, current: e.target.value })); pwMutation.reset() }} className={FIELD} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="p-new" className="text-sm font-medium text-ink">New password</label>
                <input id="p-new" type="password" autoComplete="new-password" required minLength={8} value={pw.next}
                  onChange={e => { setPw(s => ({ ...s, next: e.target.value })); pwMutation.reset() }} className={FIELD} />
                <p className="text-xs text-soft">At least 8 characters.</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="p-confirm" className="text-sm font-medium text-ink">Confirm new password</label>
                <input id="p-confirm" type="password" autoComplete="new-password" required value={pw.confirm}
                  aria-invalid={mismatch || undefined} aria-describedby={mismatch ? 'p-mismatch' : undefined}
                  onChange={e => { setPw(s => ({ ...s, confirm: e.target.value })); pwMutation.reset() }} className={FIELD} />
                {mismatch && <p id="p-mismatch" className="text-xs text-red-600">Passwords don’t match.</p>}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit" disabled={pwMutation.isPending || mismatch || !pw.current || pw.next.length < 8}
              className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pwMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Change password
            </button>
            <Saved show={pwMutation.isSuccess} label="Password changed" />
            {pwMutation.isError && <span role="alert" className="text-sm text-red-600">{(pwMutation.error as Error).message}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
