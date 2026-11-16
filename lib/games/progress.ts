import { getStudentSession } from '@/lib/auth/student';
import { createAdminClient } from '@/lib/supabase/admin';

/** Stars per "game:level" of the logged-in student, or null for a guest. */
export async function studentGameProgress(): Promise<Record<string, number> | null> {
  const session = await getStudentSession();
  if (!session) return null;
  const { data } = await createAdminClient().rpc('student_puzzle_progress', { p_session_id: session.session_id });
  const rows = (data ?? []) as { game: string; level: number; stars: number }[];
  return Object.fromEntries(rows.map((r) => [`${r.game}:${r.level}`, r.stars]));
}
