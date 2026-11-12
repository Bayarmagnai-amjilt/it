import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export interface Teacher {
  id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'teacher';
  is_active: boolean;
}

/**
 * For teacher pages: returns the signed-in, active teacher and a Supabase client
 * that carries their session. Anyone else is sent to the login page.
 * Wrapped in cache(): the layout and the page of one request share one lookup.
 */
export const requireTeacher = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/teacher/login');

  const { data } = await supabase
    .from('teachers')
    .select('id, full_name, email, role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  const teacher = data as Teacher | null;
  if (!teacher || !teacher.is_active) redirect('/teacher/login?error=inactive');
  return { supabase, teacher };
});
