import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>
const KEY_LEN = 64
export const MIN_PASSWORD = 8

/** "scrypt$<salt b64>$<hash b64>" — Node's built-in scrypt, per-password random salt. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LEN)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored?: string | null) {
  const [algo, salt, hash] = stored?.split('$') ?? []
  if (algo !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
