import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// The projector asks for the live game's state about once a second.
// Teacher-only: proxy.ts answers 401 to /api/* without a teacher session.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('live_host_state', { p_live_id: id });
  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
