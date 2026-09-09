import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '@/lib/encryption'

describe('encryption', () => {
  it('encrypt → decrypt round-trip returns original value', () => {
    const secret = 'my-api-key-abc123'
    expect(decrypt(encrypt(secret))).toBe(secret)
  })

  it('encrypted value is different from original', () => {
    const secret = 'my-api-key-abc123'
    expect(encrypt(secret)).not.toBe(secret)
  })

  it('handles empty string', () => {
    expect(decrypt(encrypt(''))).toBe('')
  })

  it('handles special characters', () => {
    const secret = 're_abc!@#$%^&*()_+{}|'
    expect(decrypt(encrypt(secret))).toBe(secret)
  })
})
