'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, Plus, Trash2, Eye, EyeOff, KeyRound, Flag, Users, Clock, Palette, Plug,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, TASK_STATUSES, type TaskStatus } from '@/lib/types'

function Section({ title, icon: Icon, children }: { title: string; icon: typeof KeyRound; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
        <Icon className="h-4 w-4 text-muted" />
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  )
}

function Input({ type = 'text', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      {...props}
      className={cn(
        'w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink',
        'placeholder:text-soft focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50',
        props.className
      )}
    />
  )
}

function SecretInput({ label, name, value, onChange }: {
  label: string; name: string; value: string; onChange: (v: string) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••••••••••"
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-soft hover:text-muted"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
  })

  const [erp, setErp] = useState({ baseUrl: '', apiKey: '', apiSecret: '' })
  const [sk, setSk] = useState({ url: '', apiKey: '', apiSecret: '' })
  const [colors, setColors] = useState<Record<TaskStatus, string>>(STATUS_COLORS)
  const [newMember, setNewMember] = useState({ email: '', name: '', role: '' })
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!data) return
    setErp({
      baseUrl: data.erpnextBaseUrl || 'https://erp.livro.systems',
      apiKey: data.erpnextApiKey ?? '',
      apiSecret: data.erpnextApiSecret ?? '',
    })
    setSk({
      url: data.sprintKickoffUrl ?? '',
      apiKey: data.sprintKickoffApiKey ?? '',
      apiSecret: data.sprintKickoffApiSecret ?? '',
    })
    setColors({ ...STATUS_COLORS, ...(data.statusColors ?? {}) })
  }, [data])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); showToast('Settings saved') },
  })

  const testConnection = (source: 'erpnext' | 'sprint_kickoff') =>
    fetch('/api/settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source === 'erpnext'
        ? { source, erpnextBaseUrl: erp.baseUrl, erpnextApiKey: erp.apiKey, erpnextApiSecret: erp.apiSecret }
        : { source, sprintKickoffUrl: sk.url, sprintKickoffApiKey: sk.apiKey, sprintKickoffApiSecret: sk.apiSecret }),
    }).then(async r => {
      const json = await r.json()
      if (!r.ok || !json.ok) throw new Error(json.error ?? 'Connection failed')
      return json
    })

  const testErpMutation = useMutation({
    mutationFn: () => testConnection('erpnext'),
    onSuccess: (res) => showToast(res.user ? `Connected as ${res.user}` : 'API access works'),
    onError: (err: Error) => showToast(err.message),
  })

  const testSkMutation = useMutation({
    mutationFn: () => testConnection('sprint_kickoff'),
    onSuccess: (res) => showToast(res.user ? `Connected as ${res.user}` : 'API access works'),
    onError: (err: Error) => showToast(err.message),
  })

  const addMemberMutation = useMutation({
    mutationFn: (body: { email: string; name: string; role: string }) =>
      fetch('/api/settings/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setNewMember({ email: '', name: '', role: '' }); showToast('Team member added') },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (email: string) =>
      fetch(`/api/settings/team/${encodeURIComponent(email)}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); showToast('Member removed') },
  })

  const teamMembers: { id: string; email: string; name?: string; role?: string; isActive: boolean }[] = data?.teamMembers ?? []

  return (
    <div className="h-full min-h-0 overflow-y-auto">
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-ink">Settings</h1>

      <Section title="ERPNext API Access" icon={KeyRound}>
        <div className="space-y-3">
          <p className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs leading-5 text-muted">
            Use API Key and API Secret from User → API Access → Generate Keys. Username and password will fail when MFA is on.
          </p>
          <Field label="Base URL">
            <Input placeholder="https://erp.livro.systems"
              value={erp.baseUrl} onChange={e => setErp(s => ({ ...s, baseUrl: e.target.value }))} />
          </Field>
          <SecretInput label="API Key" name="erpApiKey" value={erp.apiKey} onChange={v => setErp(s => ({ ...s, apiKey: v }))} />
          <SecretInput label="API Secret" name="erpApiSecret" value={erp.apiSecret} onChange={v => setErp(s => ({ ...s, apiSecret: v }))} />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => saveMutation.mutate({ erpnextBaseUrl: erp.baseUrl, erpnextApiKey: erp.apiKey, erpnextApiSecret: erp.apiSecret })}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              <Save className="h-4 w-4" /> Save
            </button>
            <button
              type="button"
              onClick={() => testErpMutation.mutate()}
              disabled={testErpMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-hover disabled:opacity-50 transition-colors"
            >
              <Plug className="h-4 w-4" />
              {testErpMutation.isPending ? 'Testing…' : 'Test API'}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Sprint Kickoff API Access" icon={Flag}>
        <div className="space-y-3">
          <p className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs leading-5 text-muted">
            Same as ERPNext: paste the site API Key and API Secret. Do not use your login password.
          </p>
          <Field label="Base URL">
            <Input placeholder="https://your-sprint-kickoff.com"
              value={sk.url} onChange={e => setSk(s => ({ ...s, url: e.target.value }))} />
          </Field>
          <SecretInput label="API Key" name="skApiKey" value={sk.apiKey} onChange={v => setSk(s => ({ ...s, apiKey: v }))} />
          <SecretInput label="API Secret" name="skApiSecret" value={sk.apiSecret} onChange={v => setSk(s => ({ ...s, apiSecret: v }))} />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => saveMutation.mutate({
                sprintKickoffUrl: sk.url,
                sprintKickoffApiKey: sk.apiKey,
                sprintKickoffApiSecret: sk.apiSecret,
              })}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              <Save className="h-4 w-4" /> Save
            </button>
            <button
              type="button"
              onClick={() => testSkMutation.mutate()}
              disabled={testSkMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-hover disabled:opacity-50 transition-colors"
            >
              <Plug className="h-4 w-4" />
              {testSkMutation.isPending ? 'Testing…' : 'Test API'}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Gantt Colors" icon={Palette}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TASK_STATUSES.map(status => (
            <label key={status} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2">
              <input
                type="color"
                value={colors[status]}
                onChange={e => setColors(s => ({ ...s, [status]: e.target.value }))}
                className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
              />
              <span className="text-xs text-muted">{status}</span>
            </label>
          ))}
        </div>
        <button
          onClick={() => saveMutation.mutate({ statusColors: colors })}
          className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          <Save className="h-4 w-4" /> Save colors
        </button>
      </Section>

      <Section title="Team Members" icon={Users}>
        <div className="space-y-3">
          {teamMembers.length > 0 && (
            <div className="rounded-lg border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-panel">
                  <tr>
                    {['Email', 'Name', 'Role', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-soft">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {teamMembers.map(m => (
                    <tr key={m.id} className="hover:bg-hover/30">
                      <td className="px-3 py-2 text-ink">{m.email}</td>
                      <td className="px-3 py-2 text-muted">{m.name ?? '—'}</td>
                      <td className="px-3 py-2 text-muted">{m.role ?? '—'}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => removeMemberMutation.mutate(m.email)}
                          className="text-soft hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2">
            <Input placeholder="email@company.com" value={newMember.email}
              onChange={e => setNewMember(s => ({ ...s, email: e.target.value }))} />
            <Input placeholder="Name" value={newMember.name} className="w-28"
              onChange={e => setNewMember(s => ({ ...s, name: e.target.value }))} />
            <select value={newMember.role} onChange={e => setNewMember(s => ({ ...s, role: e.target.value }))}
              className="rounded-lg border border-line bg-panel px-2 text-sm text-ink focus:outline-none">
              <option value="">Role</option>
              {['Dev', 'Lead', 'QA', 'Design', 'PM'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={() => newMember.email && addMemberMutation.mutate(newMember)}
              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500 transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
      </Section>

      <Section title="Auto Sync" icon={Clock}>
        <p className="text-sm text-muted">Realtime</p>
        <p className="mt-1 text-xs leading-5 text-muted">
          The open sprint pulls Sprint Backlogs and task timelines from ERP while the Gantt is visible.
          Status, names, and expected dates update as they change — not on a 5-minute timer.
        </p>
      </Section>

      {toast && (
        <div className="fixed bottom-6 right-6 rounded-lg border border-line bg-input px-4 py-3 text-sm shadow-xl">
          {toast}
        </div>
      )}
    </div>
    </div>
  )
}
