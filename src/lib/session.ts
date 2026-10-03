import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Session = { email } sealed with AES-256-GCM (encrypted + tamper-proof) in an httpOnly cookie.
// Accounts are local (TeamMember.passwordHash) — sign-in never touches ERP.
export const SESSION_COOKIE = 'gf_session'
export const REMEMBER_DAYS = 30
const SHORT_HOURS = 12

export interface Session { email: string; exp: number }

function key() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return createHash('sha256').update(secret).digest()
}

export function sealSession(email: string, remember: boolean) {
  const maxAge = remember ? REMEMBER_DAYS * 86400 : SHORT_HOURS * 3600
  const payload: Session = { email, exp: Date.now() + maxAge * 1000 }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return {
    value: Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url'),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      // remember → persistent cookie; otherwise a browser-session cookie (exp still caps it server-side)
      ...(remember && { maxAge }),
    },
  }
}

export function openSession(value?: string | null): Session | null {
  if (!value) return null
  try {
    const raw = Buffer.from(value, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const s = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as Session
    return s.exp > Date.now() && s.email ? s : null
  } catch {
    return null  // tampered, wrong secret, or garbage
  }
}

/** Route handlers: `getSession(req)` */
export const getSession = (req: { cookies: { get(name: string): { value: string } | undefined } }) =>
  openSession(req.cookies.get(SESSION_COOKIE)?.value)

/** For admin-only routes: re-checks the DB each time, so revoking admin takes effect immediately. */
export async function requireAdmin(req: Parameters<typeof getSession>[0]) {
  const session = getSession(req)
  if (!session) return null
  const { prisma } = await import('@/lib/db/prisma')  // lazy: keeps prisma out of the proxy bundle
  const me = await prisma.teamMember.findFirst({
    where: { email: { equals: session.email, mode: 'insensitive' }, isActive: true, isAdmin: true },
    select: { email: true },
  })
  return me ? session : null
}
