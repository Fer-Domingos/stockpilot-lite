import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authConfig, encodeSession, getSessionCookieOptions, verifySessionToken } from '@/lib/session';

const PUBLIC_PATHS = new Set(['/login']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(authConfig.sessionCookieName)?.value;
  const verification = await verifySessionToken(sessionToken);
  const session = verification?.payload ?? null;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (session && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();

  if (verification?.needsRefresh && session) {
    response.cookies.set(
      authConfig.sessionCookieName,
      await encodeSession({
        email: session.email,
        issuedAt: Date.now()
      }),
      getSessionCookieOptions()
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!api).*)']
};
