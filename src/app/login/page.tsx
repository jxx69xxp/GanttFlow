'use client'
import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Archivo } from 'next/font/google'
import { AlertCircle, BarChart2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Wide, heavy grotesk for the two headlines only; body stays in the app's Inter.
const display = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap' })
const DISPLAY = { fontStretch: '118%' } as const

type StepState = 'pending' | 'active' | 'done' | 'failed'
const STEPS = [
  { id: 'sprints', label: 'Sprints' },
  { id: 'tasks', label: 'Tasks from ERP' },
  { id: 'inbox', label: 'Your notifications' },
  { id: 'team', label: 'Team & settings' },
] as const
type StepId = typeof STEPS[number]['id']

const json = async (url: string) => {
  const r = await fetch(url)
  const body = await r.json()
  if (!r.ok) throw new Error(body.error ?? r.statusText)
  return body
}

/* ── the hero: this week as a Gantt, on drafting-blue grid paper ─────────── */
// [start day 0–5, length in days, kind, progress 0–1] — abstract bars, no invented task names
const BARS: Array<[number, number, 'done' | 'active' | 'todo' | 'late', number]> = [
  [0, 1.5, 'done', 1], [0.5, 2.5, 'active', 0.6], [1, 1, 'late', 0.4], [1.5, 3, 'active', 0.3],
  [2, 2, 'todo', 0], [2.5, 1.5, 'active', 0.8], [3, 2, 'todo', 0], [3.5, 1.5, 'todo', 0],
]
const BAR_COLOR = { done: '#4ADE80', active: '#93C5FD', todo: 'rgba(255,255,255,.38)', late: '#FB923C' }

function WeekTimeline() {
  const { days, todayPos } = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const days = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      return { name: d.toLocaleDateString('en', { weekday: 'short' }), date: d.getDate() }
    })
    const dow = (now.getDay() + 6) % 7  // Mon=0
    const todayPos = dow > 4 ? 1 : (dow + now.getHours() / 24) / 5  // weekend → end of week
    return { days, todayPos }
  }, [])

  return (
    <div
      className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14"
      style={{
        backgroundColor: '#0E2A6E',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <div className="flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-blue-200" />
        <span className="text-sm font-semibold tracking-tight">GanttFlow</span>
      </div>

      <div className="max-w-xl">
        <h2 className={cn(display.className, 'text-4xl font-extrabold leading-[1.05] xl:text-5xl')} style={DISPLAY}>
          Your sprint, on one timeline.
        </h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-blue-100/80">
          Backlogs, assignees and comments from ERP, laid out day by day for the whole team.
        </p>
      </div>

      {/* the week */}
      <div aria-hidden="true" className="rounded-xl border border-white/10 bg-white/[.04] p-5 backdrop-blur-[1px]">
        <div className="grid grid-cols-5 border-b border-white/10 pb-2 text-xs">
          {days.map(d => (
            <div key={d.name} className="text-blue-100/70">
              {d.name} <span className="font-semibold text-white">{d.date}</span>
            </div>
          ))}
        </div>
        <div className="relative mt-3 space-y-2.5">
          {BARS.map(([start, len, kind, progress], i) => (
            <div key={i} className="relative h-3.5">
              <div
                className="gf-draw absolute inset-y-0 overflow-hidden rounded-full"
                style={{
                  left: `${(start / 5) * 100}%`,
                  width: `${(len / 5) * 100}%`,
                  background: kind === 'todo' ? 'transparent' : `${BAR_COLOR[kind]}55`,
                  border: kind === 'todo' ? `1.5px dashed ${BAR_COLOR.todo}` : undefined,
                  animationDelay: `${150 + i * 70}ms`,
                }}
              >
                <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: BAR_COLOR[kind] }} />
              </div>
            </div>
          ))}
          {/* today */}
          <div className="pointer-events-none absolute -bottom-1 -top-3 w-px bg-white" style={{ left: `${todayPos * 100}%` }}>
            <span className="absolute -top-5 -translate-x-1/2 rounded bg-white px-1.5 py-px text-[10px] font-semibold text-[#0E2A6E]">
              Today
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── loading: each preload step is a Gantt row that fills as it finishes ─── */
function LoadingRows({ steps }: { steps: Record<StepId, StepState> }) {
  const finished = Object.values(steps).filter(s => s === 'done' || s === 'failed').length
  return (
    <div aria-live="polite" aria-busy={finished < STEPS.length}>
      <h1 className={cn(display.className, 'text-2xl font-extrabold text-ink')} style={DISPLAY}>
        Setting up your workspace
      </h1>
      <p className="mt-2 text-sm text-muted">Pulling the latest from ERP so everything is ready when you land.</p>
      <ul className="mt-8 space-y-4">
        {STEPS.map(s => {
          const state = steps[s.id]
          return (
            <li key={s.id} className="grid grid-cols-[9.5rem_1fr] items-center gap-4">
              <span className={cn('text-sm', state === 'pending' ? 'text-soft' : 'font-medium text-ink')}>{s.label}</span>
              <span className="relative h-3 overflow-hidden rounded-full bg-hover">
                {state === 'active' && <span className="gf-sweep absolute inset-y-0 w-2/5 rounded-full bg-blue-500" />}
                {state === 'done' && <span className="gf-draw absolute inset-0 rounded-full bg-emerald-500" />}
                {state === 'failed' && <span className="gf-draw absolute inset-y-0 left-0 w-1/3 rounded-full bg-orange-500" />}
              </span>
              <span className="sr-only">
                {state === 'active' ? 'loading' : state === 'done' ? 'done' : state === 'failed' ? 'will retry in the app' : 'waiting'}
              </span>
            </li>
          )
        })}
      </ul>
      {Object.values(steps).includes('failed') && (
        <p className="mt-5 text-xs text-soft">Orange rows didn’t load yet — the app will retry them.</p>
      )}
    </div>
  )
}

function LoginForm() {
  const router = useRouter()
  const qc = useQueryClient()
  const params = useSearchParams()
  const nextRaw = params.get('next') ?? '/'
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/'  // no open redirects

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [steps, setSteps] = useState<Record<StepId, StepState> | null>(null)
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState('')
  // first run: no account has a password yet → create the admin instead of signing in
  const { data: setup } = useQuery<{ needed: boolean }>({
    queryKey: ['auth-setup'],
    queryFn: () => fetch('/api/auth/setup').then(r => r.json()),
    staleTime: Infinity,
  })
  const creating = setup?.needed === true

  const mark = (id: StepId, state: StepState) => setSteps(s => s && { ...s, [id]: state })
  async function step(id: StepId, run: () => Promise<unknown>) {
    mark(id, 'active')
    try { await run(); mark(id, 'done') } catch { mark(id, 'failed') }  // never block entry on a slow/failed preload
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (creating && password !== confirm) { setError('Passwords don’t match'); return }
    setSubmitting(true)
    try {
      const r = await fetch(creating ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creating ? { email, name, password } : { email, password, remember }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) { setError(body.error ?? 'Sign-in failed. Try again.'); setSubmitting(false); return }
    } catch {
      setError('Can’t reach the server. Check your connection and try again.'); setSubmitting(false); return
    }

    qc.clear()  // nothing cached from a previous user
    setSteps({ sprints: 'pending', tasks: 'pending', inbox: 'pending', team: 'pending' })
    let firstSprint = ''
    await Promise.all([
      step('sprints', async () => {
        const data = await qc.fetchQuery({ queryKey: ['sprints'], queryFn: () => json('/api/sprints') })
        const s = data?.sprints?.[0]
        firstSprint = s?.externalId || s?.id || ''
      }).then(() => step('tasks', async () => {
        // imports the open sprint's backlogs from ERP into the DB — the slow part of a cold start
        if (firstSprint) await json(`/api/tasks?sprintId=${encodeURIComponent(firstSprint)}`)
      })),
      step('inbox', () => qc.prefetchQuery({ queryKey: ['inbox', 'all', 1], queryFn: () => json('/api/notifications/inbox?filter=all&page=1') })),
      step('team', () => Promise.all([
        qc.prefetchQuery({ queryKey: ['settings'], queryFn: () => json('/api/settings') }),
        qc.prefetchQuery({ queryKey: ['me'], queryFn: () => json('/api/me') }),
      ])),
    ])
    router.replace(next)
  }

  const field = 'h-11 w-full rounded-lg border border-line bg-input px-3.5 text-sm text-ink placeholder:text-soft transition-colors focus:border-blue-600 focus:bg-panel focus:outline-none focus:ring-4 focus:ring-blue-600/15'

  return (
    <main className="grid min-h-screen bg-panel lg:grid-cols-[1.15fr_1fr]">
      <WeekTimeline />

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {/* brand for small screens (the timeline panel is hidden there) */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <BarChart2 className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold tracking-tight text-ink">GanttFlow</span>
          </div>

          {steps ? <LoadingRows steps={steps} /> : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <h1 className={cn(display.className, 'text-3xl font-extrabold text-ink')} style={DISPLAY}>
                  {creating ? 'Create the admin account' : 'Sign in'}
                </h1>
                <p className="mt-2 text-sm text-muted">
                  {creating
                    ? 'No accounts exist yet. This first account can add the rest of the team in Settings.'
                    : 'Use the email and password your admin set up for you.'}
                </p>
              </div>

              {creating && (
                <div className="space-y-1.5">
                  <label htmlFor="login-name" className="text-sm font-medium text-ink">Your name</label>
                  <input id="login-name" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={field} />
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-sm font-medium text-ink">Email</label>
                <input
                  id="login-email" type="email" autoComplete="username" inputMode="email" required autoFocus
                  value={email} onChange={e => setEmail(e.target.value)}
                  aria-invalid={Boolean(error) || undefined}
                  className={field} placeholder="name@company.com"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-sm font-medium text-ink">Password</label>
                <div className="relative">
                  <input
                    id="login-password" type={showPassword ? 'text' : 'password'} required
                    autoComplete={creating ? 'new-password' : 'current-password'} minLength={creating ? 8 : undefined}
                    value={password} onChange={e => setPassword(e.target.value)}
                    onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))}
                    onBlur={() => setCapsLock(false)}
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby={capsLock ? 'caps-hint' : undefined}
                    className={cn(field, 'pr-11')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {capsLock && <p id="caps-hint" className="text-xs text-orange-600">Caps Lock is on.</p>}
              </div>

              {creating && (
                <div className="space-y-1.5">
                  <label htmlFor="login-confirm" className="text-sm font-medium text-ink">Confirm password</label>
                  <input
                    id="login-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required
                    value={confirm} onChange={e => setConfirm(e.target.value)} className={field}
                  />
                  <p className="text-xs text-soft">At least 8 characters.</p>
                </div>
              )}

              {!creating && <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-muted">
                <input
                  type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-line accent-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
                />
                Keep me signed in for 30 days
              </label>}

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit" disabled={submitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/30 disabled:opacity-70"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? (creating ? 'Creating account…' : 'Signing in…') : (creating ? 'Create account' : 'Sign in')}
              </button>

              {!creating && (
                <p className="text-xs leading-relaxed text-soft">
                  No account or forgot your password? Ask an admin to set one in Settings → Team.
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
