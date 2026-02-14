import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('[MIDDLEWARE] Request:', pathname);

  // Allow access to login page and API routes without auth
  if (pathname === '/login' || pathname.startsWith('/api/auth/login')) {
    console.log('[MIDDLEWARE] Allowing access to:', pathname);
    return NextResponse.next();
  }

  // Check for admin session cookie
  const sessionCookie = request.cookies.get('admin-session');

  if (!sessionCookie) {
    // No session, redirect to login
    console.log('[MIDDLEWARE] No session, redirecting to login');
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify session data
    const sessionData = JSON.parse(sessionCookie.value);

    // Check if user has admin role
    if (sessionData.role !== 'admin') {
      // Not an admin, redirect to login
      console.log('[MIDDLEWARE] Not admin, redirecting');
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Valid admin session, allow access
    console.log('[MIDDLEWARE] Valid admin session, allowing access');
    return NextResponse.next();
  } catch (error) {
    // Invalid session data, redirect to login
    console.log('[MIDDLEWARE] Invalid session data, redirecting');
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
