import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authConfig, decodeSession } from '@/lib/session';

const PUBLIC_PATHS = new Set(['/login']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(authConfig.sessionCookieName)?.value;
  const session = await decodeSession(sessionToken);
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api).*)']
};
