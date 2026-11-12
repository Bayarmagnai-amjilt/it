'use server';

import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/constants';
import { errorCode, flashUrl } from '@/lib/flash';
import { isISODate } from '@/lib/mn/dates';
import { createClient } from '@/lib/supabase/server';

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const BACK = '/t/settings';

/** First-time setup of the school year (the database refuses when one exists). */
export async function createSchoolYear(fd: FormData): Promise<void> {
  const name = text(fd, 'name').slice(0, 30);
  const starts = text(fd, 'starts_on');
  const ends = text(fd, 'ends_on');
  if (!name || !isISODate(starts) || !isISODate(ends) || ends <= starts) {
    redirect(flashUrl(BACK, 'error', 'invalid'));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_school_year', { p_name: name, p_starts_on: starts, p_ends_on: ends });
  redirect(error ? flashUrl(BACK, 'error', errorCode(error)) : flashUrl(BACK, 'ok', 'saved'));
}

export async function updateSchoolYear(fd: FormData): Promise<void> {
  const id = text(fd, 'id');
  const name = text(fd, 'name').slice(0, 30);
  const starts = text(fd, 'starts_on');
  const ends = text(fd, 'ends_on');
  if (!isUuid(id) || !name || !isISODate(starts) || !isISODate(ends) || ends <= starts) {
    redirect(flashUrl(BACK, 'error', 'invalid'));
  }
  const supabase = await createClient();
  const { error } = await supabase.from('school_years').update({ name, starts_on: starts, ends_on: ends }).eq('id', id);
  redirect(error ? flashUrl(BACK, 'error', errorCode(error)) : flashUrl(BACK, 'ok', 'saved'));
}

export async function saveTerm(fd: FormData): Promise<void> {
  const id = text(fd, 'id');
  const yearId = text(fd, 'school_year_id');
  const name = text(fd, 'name').slice(0, 30);
  const starts = text(fd, 'starts_on');
  const ends = text(fd, 'ends_on');
  const order = Number(text(fd, 'sort_order')) || 1;
  if (!name || !isISODate(starts) || !isISODate(ends) || ends <= starts) {
    redirect(flashUrl(BACK, 'error', 'invalid'));
  }
  const supabase = await createClient();
  const row = { name, starts_on: starts, ends_on: ends, sort_order: order };
  const { error } = isUuid(id)
    ? await supabase.from('terms').update(row).eq('id', id)
    : await supabase.from('terms').insert({ ...row, school_year_id: yearId });
  redirect(error ? flashUrl(BACK, 'error', errorCode(error)) : flashUrl(BACK, 'ok', 'saved'));
}

export async function deleteTerm(fd: FormData): Promise<void> {
  const id = text(fd, 'id');
  if (!isUuid(id)) redirect(BACK);
  const supabase = await createClient();
  const { error } = await supabase.from('terms').delete().eq('id', id);
  // a term that already has lessons or grades cannot be deleted (foreign keys)
  redirect(error ? flashUrl(BACK, 'error', 'term_in_use') : flashUrl(BACK, 'ok', 'deleted'));
}

export async function saveLessonMinutes(fd: FormData): Promise<void> {
  const minutes = Math.round(Number(text(fd, 'lesson_minutes')));
  if (!Number.isFinite(minutes) || minutes < 10 || minutes > 180) {
    redirect(flashUrl(BACK, 'error', 'invalid'));
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'lesson_minutes', value: minutes, updated_at: new Date().toISOString() });
  redirect(error ? flashUrl(BACK, 'error', errorCode(error)) : flashUrl(BACK, 'ok', 'saved'));
}
