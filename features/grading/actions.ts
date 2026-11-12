'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { COMPONENT_SOURCES, isUuid } from '@/lib/constants';
import { errorMessage } from '@/lib/errors';
import { errorCode, flashUrl } from '@/lib/flash';
import { isISODate } from '@/lib/mn/dates';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult, GradeComponentInput } from '@/lib/types';
import { mn } from '@/locales/mn';

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();

export async function saveComponents(input: {
  classId: string;
  termId: string;
  components: GradeComponentInput[];
}): Promise<ActionResult> {
  if (!input || !isUuid(input.classId) || !isUuid(input.termId) || !Array.isArray(input.components)) {
    return { ok: false, error: mn.errors.invalid };
  }
  const components = input.components.map((c) => ({
    id: isUuid(c.id) ? c.id : null,
    name: String(c.name ?? '').trim().slice(0, 60),
    weight: Number(c.weight),
    source: COMPONENT_SOURCES.includes(c.source) ? c.source : 'manual',
    missing_policy: c.missing_policy === 'exclude' ? 'exclude' : 'zero',
  }));
  if (components.some((c) => !c.name || !Number.isFinite(c.weight) || c.weight <= 0)) {
    return { ok: false, error: mn.grades.setup.rowInvalid };
  }
  if (new Set(components.map((c) => c.name)).size !== components.length) {
    return { ok: false, error: mn.grades.setup.duplicateName };
  }
  // the database checks the sum again; this gives the teacher the message early
  const total = Math.round(components.reduce((sum, c) => sum + c.weight, 0) * 100) / 100;
  if (total !== 100) return { ok: false, error: mn.errors.weights_must_sum_100 };

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_grade_components', {
    p_class_id: input.classId,
    p_term_id: input.termId,
    p_components: components,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath('/t', 'layout');
  return { ok: true };
}

export async function copyComponents(fd: FormData): Promise<void> {
  const from = text(fd, 'from_class_id');
  const to = text(fd, 'to_class_id');
  const term = text(fd, 'term_id');
  const back = `/t/grades/setup?class=${to}&term=${term}`;
  if (!isUuid(from) || !isUuid(to) || !isUuid(term)) redirect('/t/grades/setup');
  const supabase = await createClient();
  const { error } = await supabase.rpc('copy_grade_components', {
    p_from_class_id: from,
    p_to_class_id: to,
    p_term_id: term,
  });
  redirect(error ? flashUrl(back, 'error', errorCode(error)) : flashUrl(back, 'ok', 'copied'));
}

export async function createGradeItem(fd: FormData): Promise<void> {
  const classId = text(fd, 'class_id');
  const termId = text(fd, 'term_id');
  const componentId = text(fd, 'component_id');
  const back = `/t/grades?class=${classId}&term=${termId}`;
  if (!isUuid(classId) || !isUuid(termId) || !isUuid(componentId)) redirect('/t/grades');
  const max = Number(text(fd, 'max_score'));
  const heldOn = text(fd, 'held_on');
  if (!text(fd, 'title')) redirect(flashUrl(back, 'error', 'title_required'));
  if (!Number.isFinite(max) || max <= 0 || max > 1000) redirect(flashUrl(back, 'error', 'invalid'));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_grade_item', {
    p_component_id: componentId,
    p_title: text(fd, 'title').slice(0, 80),
    p_max_score: max,
    p_held_on: isISODate(heldOn) ? heldOn : null,
  });
  if (error || !data) redirect(flashUrl(back, 'error', errorCode(error)));
  redirect(`${back}&item=${data}`);
}

export async function deleteGradeItem(fd: FormData): Promise<void> {
  const classId = text(fd, 'class_id');
  const termId = text(fd, 'term_id');
  const itemId = text(fd, 'item_id');
  const back = `/t/grades?class=${classId}&term=${termId}`;
  if (!isUuid(itemId)) redirect('/t/grades');
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_grade_item', { p_grade_item_id: itemId });
  redirect(error ? flashUrl(back, 'error', errorCode(error)) : flashUrl(back, 'ok', 'deleted'));
}

export async function saveScores(input: {
  itemId: string;
  rows: { student_id: string; score: number | null; is_excused: boolean }[];
}): Promise<ActionResult> {
  if (!input || !isUuid(input.itemId) || !Array.isArray(input.rows)) {
    return { ok: false, error: mn.errors.invalid };
  }
  const rows = input.rows
    .filter((r) => isUuid(r?.student_id))
    .map((r) => ({
      student_id: r.student_id,
      score: r.score === null || r.score === undefined || Number.isNaN(Number(r.score)) ? null : Number(r.score),
      is_excused: Boolean(r.is_excused),
    }));
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_scores', { p_grade_item_id: input.itemId, p_rows: rows });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath('/t', 'layout');
  return { ok: true };
}

/** Letter bands of the whole school (the owner edits them). */
export async function saveBands(fd: FormData): Promise<void> {
  const back = safeBack(text(fd, 'return_to'));
  const count = Math.min(Number(text(fd, 'count')) || 0, 10);
  const bands = Array.from({ length: count }, (_, i) => ({
    letter: text(fd, `letter_${i}`).slice(0, 3),
    min_percent: Number(text(fd, `min_${i}`)),
    teacher_label: text(fd, `label_${i}`).slice(0, 30),
    stars: Number(text(fd, `stars_${i}`)),
    student_message: text(fd, `message_${i}`).slice(0, 60),
  }));
  const bad = bands.some(
    (b) =>
      !b.letter ||
      !b.teacher_label ||
      !b.student_message ||
      !Number.isFinite(b.min_percent) ||
      b.min_percent < 0 ||
      b.min_percent > 100 ||
      !(b.stars >= 1 && b.stars <= 5),
  );
  if (bad || new Set(bands.map((b) => b.min_percent)).size !== bands.length) {
    redirect(flashUrl(back, 'error', 'invalid'));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_default_bands', { p_bands: bands });
  redirect(error ? flashUrl(back, 'error', errorCode(error)) : flashUrl(back, 'ok', 'saved'));
}

function safeBack(value: string): string {
  return value.startsWith('/t/') && !value.includes('//') ? value : '/t/grades/setup';
}
