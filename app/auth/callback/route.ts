import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Landing point of links in Supabase e-mails (password reset). Supabase sends
// either ?code=... or ?token_hash=...&type=..., depending on the e-mail template.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get('next') ?? '/t/dashboard';
  const target = next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/t/dashboard';

  const supabase = await createClient();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(target, origin));
  } else if (tokenHash && (type === 'recovery' || type === 'email' || type === 'invite')) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(target, origin));
  }
  return NextResponse.redirect(new URL('/teacher/login?error=link', origin));
}
