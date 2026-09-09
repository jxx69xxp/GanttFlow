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
