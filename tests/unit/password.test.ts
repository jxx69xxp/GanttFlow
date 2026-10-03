import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../src/lib/password'

describe('password hashing', () => {
  it('verifies the right password only', async () => {
    const h = await hashPassword('correct horse')
    expect(await verifyPassword('correct horse', h)).toBe(true)
    expect(await verifyPassword('correct horsE', h)).toBe(false)
  })
  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'))
  })
  it('rejects missing or foreign hashes', async () => {
    for (const bad of [null, undefined, '', 'plain', 'scrypt$', 'bcrypt$a$b']) {
      expect(await verifyPassword('x', bad)).toBe(false)
    }
  })
})
