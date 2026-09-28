import { NextResponse, type NextRequest } from 'next/server';
import { localMode } from './lib/local/config';
import { cookieName, verifySession } from './lib/local/auth';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  if (localMode) {
    const pathname = request.nextUrl.pathname;
    const protectedRoute = [
      '/dashboard',
      '/contacts',
      '/imports',
      '/campaigns',
      '/templates',
      '/analytics',
      '/settings',
      '/automations',
    ].some((p) => pathname === p || pathname.startsWith(p + '/'));
    const authenticated = verifySession(request.cookies.get(cookieName)?.value);
    if (
      (!authenticated && protectedRoute) ||
      pathname === '/signup' ||
      (authenticated && pathname === '/login')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = authenticated ? '/dashboard' : '/login';
      url.search = '';
      if (!authenticated && protectedRoute) url.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
