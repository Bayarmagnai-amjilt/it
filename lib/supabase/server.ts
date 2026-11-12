import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertSupabaseEnv, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/**
 * Supabase client for the signed-in TEACHER, for Server Components, Server
 * Actions and Route Handlers. It carries the teacher's own session, so Row Level
 * Security decides what each query may see.
 */
export async function createClient() {
  assertSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which cannot write cookies.
          // proxy.ts refreshes the session cookies, so this is safe to ignore.
        }
      },
    },
  });
}
