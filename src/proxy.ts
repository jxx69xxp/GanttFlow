import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, getSession, needsRenewal, sealSession } from '@/lib/session'

// Everything needs a session except the login page/API and the cron endpoint (it has its own bearer secret).
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const session = getSession(req)

  if (pathname === '/login') {
    return session ? NextResponse.redirect(new URL('/', req.url)) : NextResponse.next()
  }
  if (session) {
    const res = NextResponse.next()
    if (needsRenewal(session)) {
      const { value, options } = sealSession(session.email, true)
      res.cookies.set(SESSION_COOKIE, value, options)
    }
    return res
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const login = new URL('/login', req.url)
  if (pathname !== '/') login.searchParams.set('next', pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/|api/cron).*)'],
}
