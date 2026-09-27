import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function updateSession(request: NextRequest) {
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
  const authRoute = pathname === '/login' || pathname === '/signup';
  let response = NextResponse.next({ request });
  if (!protectedRoute && !authRoute) return response;
  const login = () => {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('redirectTo', pathname);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('placeholder') || url.includes('your-project'))
    return protectedRoute ? login() : response;
  try {
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach((c) => request.cookies.set(c.name, c.value));
          response = NextResponse.next({ request });
          cookies.forEach((c) => response.cookies.set(c.name, c.value, c.options));
        },
      },
    });
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user && protectedRoute) return login();
    if (user && authRoute) {
      const target = request.nextUrl.clone();
      target.pathname = '/dashboard';
      target.search = '';
      const redirect = NextResponse.redirect(target);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }
  } catch {
    if (protectedRoute) return login();
  }
  return response;
}
