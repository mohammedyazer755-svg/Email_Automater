import { createBrowserClient } from '@supabase/ssr';

import { localMode } from '@/lib/local/config';
import { localClient } from '@/lib/local/client';
export function createClient() {
  if (localMode) return localClient as unknown as ReturnType<typeof createBrowserClient>;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a dummy client or throw warning in dev if env variables are pending
    console.warn(
      'Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are not set.',
    );
  }

  return createBrowserClient(
    supabaseUrl || 'https://placeholder-project.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
  );
}
