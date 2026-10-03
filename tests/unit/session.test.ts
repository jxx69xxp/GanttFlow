import { describe, expect, it, beforeAll, vi } from 'vitest'
import { openSession, sealSession } from '../../src/lib/session'

beforeAll(() => { process.env.AUTH_SECRET = 'test-secret' })

describe('session cookie', () => {
  it('round-trips the email', () => {
    const { value } = sealSession('a@b.co', false)
    expect(openSession(value)?.email).toBe('a@b.co')
  })

  it('rejects tampering and a different secret', () => {
    const { value } = sealSession('a@b.co', true)
    const flipped = value.slice(0, -2) + (value.at(-2) === 'A' ? 'B' : 'A') + value.at(-1)
    expect(openSession(flipped)).toBeNull()
    expect(openSession('garbage')).toBeNull()
    process.env.AUTH_SECRET = 'other'
    expect(openSession(value)).toBeNull()
    process.env.AUTH_SECRET = 'test-secret'
  })

  it('remember → persistent cookie; otherwise browser-session cookie that still expires', () => {
    expect(sealSession('a@b.co', true).options.maxAge).toBe(30 * 86400)
    const short = sealSession('a@b.co', false)
    expect('maxAge' in short.options).toBe(false)
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 13 * 3600 * 1000)
    expect(openSession(short.value)).toBeNull()
    vi.useRealTimers()
  })
})
