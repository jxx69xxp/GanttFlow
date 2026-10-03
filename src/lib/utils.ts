import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function daysBetween(start: string | Date, end: string | Date): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return ''
  return '•'.repeat(Math.min(value.length, 16))
}

/** Masked placeholders (••••) must not be written back as the real secret. */
export function isMaskedSecret(value: string | null | undefined): boolean {
  if (!value) return true
  return /^[•]+$/.test(value.trim())
}

/** "JD" from "Jane Doe" or "jane.doe@x.com" */
export function initials(nameOrEmail?: string | null): string {
  const parts = (nameOrEmail ?? '').split('@')[0].split(/[\s._-]+/).filter(Boolean)
  return (parts.slice(0, 2).map(p => p[0]).join('') || '?').toUpperCase()
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
/** "2 hours ago", "yesterday", "in 3 days" */
export function relativeTime(date: string | Date): string {
  const diff = (new Date(date).getTime() - Date.now()) / 1000
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [unit, secs] of units) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit)
  return 'just now'
}

/** Whole calendar days from a to b (local midnight to midnight). */
export function dayDiff(a: string | Date, b: string | Date): number {
  const d = (v: string | Date) => { const x = typeof v === 'string' ? new Date(`${v.slice(0, 10)}T00:00:00`) : new Date(v); x.setHours(0, 0, 0, 0); return x }
  return Math.round((d(b).getTime() - d(a).getTime()) / 86400000)
}
