import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

let client: SupabaseClient | null = null;

/**
 * Server-only client that uses the SECRET key. It bypasses Row Level Security,
 * so it is used for exactly one job: calling the login and student functions,
 * which scope every answer to one class or one student session themselves.
 * Never import this file from a client component.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient must never run in the browser');
  }
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!SUPABASE_URL || !secret) {
    throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example).');
  }
  client ??= createClient(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
