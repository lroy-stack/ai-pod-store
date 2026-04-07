import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login page and all API routes without auth check
  if (pathname === '/login' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Check for admin session cookie
  // Note: With iron-session, the cookie is encrypted and cannot be read in Edge middleware.
  // We only check for its existence here. Actual session validation happens in API routes
  // and server components using getIronSession() which can decrypt the cookie.
  const sessionCookie = request.cookies.get('admin-session');

  if (!sessionCookie) {
    // nextUrl already includes basePath — safe for redirect
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists - let it through. API routes will validate the encrypted content.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     *
     * The root path '/' must be listed explicitly because the regex
     * pattern does not match an empty string (basePath root).
     */
    '/',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
