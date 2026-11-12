import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { isUuid } from '@/lib/constants';
import { createAdminClient } from '@/lib/supabase/admin';
import type { StudentSession } from '@/lib/types';

// The cookie holds only the session id: a random UUID created by the database.
// The browser cannot read it (httpOnly) and it means nothing once the session
// is closed (logout, end of lesson, "log everyone out", login on another device).
export const STUDENT_COOKIE = 'student_session';

/**
 * The student behind the session cookie, or null when there is no live session.
 * Wrapped in cache(): the layout and the page of one request share one lookup.
 */
export const getStudentSession = cache(async (): Promise<StudentSession | null> => {
  const id = (await cookies()).get(STUDENT_COOKIE)?.value;
  if (!isUuid(id)) return null;
  const { data, error } = await createAdminClient().rpc('student_session', { p_session_id: id });
  if (error || !data) return null;
  return data as StudentSession;
});

/** For student pages: the student, or a redirect to the class picker. */
export async function requireStudent(): Promise<StudentSession> {
  const session = await getStudentSession();
  if (!session) redirect('/');
  return session;
}
