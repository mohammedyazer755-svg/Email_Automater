import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const requested = searchParams.get('next') ?? '/dashboard';
  const next = /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(requested) ? requested : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return user to login with error if auth failed
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
