'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, TestTube, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-100">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-400">{label}</label>
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
        'w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100',
        'placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50',
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
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
  const [sk, setSk]   = useState({ url: '', token: '' })
  const [syncInterval, setSyncInterval] = useState(15)
  const [newMember, setNewMember] = useState({ email: '', name: '', role: '' })
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); showToast('✓ Settings saved') },
  })

  const addMemberMutation = useMutation({
    mutationFn: (body: { email: string; name: string; role: string }) =>
      fetch('/api/settings/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setNewMember({ email: '', name: '', role: '' }); showToast('✓ Team member added') },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (email: string) =>
      fetch(`/api/settings/team/${encodeURIComponent(email)}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); showToast('Member removed') },
  })

  const teamMembers: { id: string; email: string; name?: string; role?: string; isActive: boolean }[] = data?.teamMembers ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-slate-100">Settings</h1>

      {/* ERPNext */}
      <Section title="🔗 ERPNext Connection">
        <div className="space-y-3">
          <Field label="Base URL">
            <Input placeholder="https://yoursite.erpnext.com"
              value={erp.baseUrl} onChange={e => setErp(s => ({ ...s, baseUrl: e.target.value }))} />
          </Field>
          <SecretInput label="API Key"    name="apiKey"    value={erp.apiKey}    onChange={v => setErp(s => ({ ...s, apiKey: v }))} />
          <SecretInput label="API Secret" name="apiSecret" value={erp.apiSecret} onChange={v => setErp(s => ({ ...s, apiSecret: v }))} />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => saveMutation.mutate({ erpnextBaseUrl: erp.baseUrl, erpnextApiKey: erp.apiKey, erpnextApiSecret: erp.apiSecret })}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        </div>
      </Section>

      {/* Sprint Kickoff */}
      <Section title="🏃 Sprint Kickoff Connection">
        <div className="space-y-3">
          <Field label="URL">
            <Input placeholder="https://your-sprint-kickoff.com"
              value={sk.url} onChange={e => setSk(s => ({ ...s, url: e.target.value }))} />
          </Field>
          <SecretInput label="API Token" name="token" value={sk.token} onChange={v => setSk(s => ({ ...s, token: v }))} />
          <button
            onClick={() => saveMutation.mutate({ sprintKickoffUrl: sk.url, sprintKickoffToken: sk.token })}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <Save className="h-4 w-4" /> Save
          </button>
        </div>
      </Section>

      {/* Team Members */}
      <Section title="👥 Team Members">
        <div className="space-y-3">
          {teamMembers.length > 0 && (
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900">
                  <tr>
                    {['Email', 'Name', 'Role', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {teamMembers.map(m => (
                    <tr key={m.id} className="hover:bg-slate-700/30">
                      <td className="px-3 py-2 text-slate-200">{m.email}</td>
                      <td className="px-3 py-2 text-slate-400">{m.name ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{m.role ?? '—'}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => removeMemberMutation.mutate(m.email)}
                          className="text-slate-600 hover:text-red-400 transition-colors"
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

          {/* Add member form */}
          <div className="flex gap-2">
            <Input placeholder="email@company.com" value={newMember.email}
              onChange={e => setNewMember(s => ({ ...s, email: e.target.value }))} />
            <Input placeholder="Name" value={newMember.name} className="w-28"
              onChange={e => setNewMember(s => ({ ...s, name: e.target.value }))} />
            <select value={newMember.role} onChange={e => setNewMember(s => ({ ...s, role: e.target.value }))}
              className="rounded-lg border border-slate-600 bg-slate-900 px-2 text-sm text-slate-100 focus:outline-none">
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

      {/* Sync interval */}
      <Section title="⏱ Auto Sync">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Sync every</span>
          <select value={syncInterval} onChange={e => setSyncInterval(Number(e.target.value))}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100">
            {[5, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m} min</option>)}
          </select>
          <button
            onClick={() => saveMutation.mutate({ syncIntervalMinutes: syncInterval })}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Save
          </button>
        </div>
      </Section>

      {toast && (
        <div className="fixed bottom-6 right-6 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
