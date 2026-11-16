import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { STUDENT_COOKIE } from '@/lib/auth/student';
import { isUuid } from '@/lib/constants';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// A player's screen asks for the live game's state every second or two.
// Outside /api on purpose: proxy.ts keeps /api for teachers. The student comes
// only from the session cookie, and live_student_state() checks the class.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await cookies()).get(STUDENT_COOKIE)?.value;
  if (!isUuid(id) || !isUuid(session)) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 });
  const { data, error } = await createAdminClient().rpc('live_student_state', { p_session_id: session, p_live_id: id });
  if (error || !data) return NextResponse.json({ ok: false, error: 'generic' }, { status: 500 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
