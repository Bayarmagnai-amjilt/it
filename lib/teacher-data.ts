import type { createClient } from '@/lib/supabase/server';
import { compareText } from '@/lib/mn/names';
import type { TeacherClass, Term } from '@/lib/types';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface SchoolYear {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
}

/** The teacher's classes of the current school year: 1А, 1Б, 2А ... */
export async function loadClasses(supabase: Supabase, includeArchived = false): Promise<TeacherClass[]> {
  const { data } = await supabase.rpc('my_classes', { p_include_archived: includeArchived });
  const list = (data ?? []) as TeacherClass[];
  return [...list].sort((a, b) => a.grade - b.grade || compareText(a.section, b.section));
}

/** Current school year, its terms, and the term that is running today. */
export async function loadTerms(
  supabase: Supabase,
): Promise<{ year: SchoolYear | null; terms: Term[]; currentTermId: string | null }> {
  const { data: year } = await supabase
    .from('school_years')
    .select('id, name, starts_on, ends_on')
    .eq('is_current', true)
    .maybeSingle();
  if (!year) return { year: null, terms: [], currentTermId: null };
  const [{ data: terms }, { data: current }] = await Promise.all([
    supabase.from('terms').select('*').eq('school_year_id', year.id).order('sort_order').order('starts_on'),
    supabase.rpc('current_term_id'),
  ]);
  return {
    year: year as SchoolYear,
    terms: (terms ?? []) as Term[],
    currentTermId: (current as string | null) ?? null,
  };
}

/** The id from the address when it is one of the allowed ones, else the fallback. */
export function pick<T extends { id: string }>(list: T[], wanted: string | undefined, fallback?: string | null): T | null {
  return list.find((x) => x.id === wanted) ?? list.find((x) => x.id === fallback) ?? list[0] ?? null;
}
