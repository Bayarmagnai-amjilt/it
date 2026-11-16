'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isQuizImageUrl, isUuid, LOGO_MAX_BYTES, LOGO_TYPES, QUIZ_MEDIA_BUCKET } from '@/lib/constants';
import { errorMessage, fill } from '@/lib/errors';
import { errorCode, flashUrl } from '@/lib/flash';
import { problems, toPayload, type QuizDraft } from '@/lib/quiz/draft';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { mn } from '@/locales/mn';

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();

/** Saves the editor's quiz. Returns the quiz id, or the first thing to fix. */
export async function saveQuiz(draft: QuizDraft): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!draft || !Array.isArray(draft.questions)) return { ok: false, error: mn.errors.invalid };
  const first = problems(draft)[0];
  if (first) {
    const template = mn.quiz.problems[first.code];
    return { ok: false, error: fill(template, { n: first.n ?? 0 }) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('save_quiz', {
    p_quiz_id: isUuid(draft.id) ? draft.id : null,
    p_quiz: toPayload(draft, isQuizImageUrl),
  });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  revalidatePath('/t/quizzes', 'layout');
  return { ok: true, id: String(data) };
}

/** Stores a question picture in the teacher's own Storage folder. */
export async function uploadQuizImage(fd: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = fd.get('image');
  if (!file || typeof file === 'string' || file.size === 0) return { ok: false, error: mn.errors.invalid };
  const ext = LOGO_TYPES[file.type];
  if (!ext || file.size > LOGO_MAX_BYTES) return { ok: false, error: mn.errors.logo_invalid };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: mn.errors.not_allowed };
  const bucket = supabase.storage.from(QUIZ_MEDIA_BUCKET);
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await bucket.upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) return { ok: false, error: mn.errors.logo_failed };
  return { ok: true, url: bucket.getPublicUrl(path).data.publicUrl };
}

export async function archiveQuiz(fd: FormData): Promise<void> {
  const id = text(fd, 'quiz_id');
  if (!isUuid(id)) redirect('/t/quizzes');
  const supabase = await createClient();
  const { error } = await supabase.rpc('archive_quiz', { p_quiz_id: id });
  if (error) redirect(flashUrl(`/t/quizzes/${id}`, 'error', errorCode(error)));
  revalidatePath('/t/quizzes', 'layout');
  redirect(flashUrl('/t/quizzes', 'ok', 'quiz_archived'));
}

export async function assignQuiz(fd: FormData): Promise<void> {
  const quizId = text(fd, 'quiz_id');
  const classId = text(fd, 'class_id');
  const back = `/t/quizzes/${quizId}`;
  if (!isUuid(quizId)) redirect('/t/quizzes');
  if (!isUuid(classId)) redirect(flashUrl(back, 'error', 'invalid'));
  // <input type="datetime-local"> has no zone; the school runs on Ulaanbaatar time (UTC+8)
  const closes = text(fd, 'closes_at');
  const closesAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(closes) ? new Date(`${closes}:00+08:00`).toISOString() : null;
  const maxAttempts = Number(text(fd, 'max_attempts'));
  const supabase = await createClient();
  const { error } = await supabase.rpc('assign_quiz', {
    p_quiz_id: quizId,
    p_class_id: classId,
    p_closes_at: closesAt,
    p_max_attempts: Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : null,
    p_show_correct: text(fd, 'show_correct'),
  });
  redirect(error ? flashUrl(back, 'error', errorCode(error)) : flashUrl(back, 'ok', 'quiz_assigned'));
}

export async function closeAssignment(fd: FormData): Promise<void> {
  const id = text(fd, 'assignment_id');
  const back = text(fd, 'return_to').startsWith('/t/quizzes') ? text(fd, 'return_to') : '/t/quizzes';
  if (!isUuid(id)) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc('close_assignment', { p_assignment_id: id });
  redirect(error ? flashUrl(back, 'error', errorCode(error)) : flashUrl(back, 'ok', 'assignment_closed'));
}

/** Opens the lobby of a live game and sends the teacher to the projector screen. */
export async function startLive(fd: FormData): Promise<void> {
  const quizId = text(fd, 'quiz_id');
  const classId = text(fd, 'class_id');
  const back = `/t/quizzes/${quizId}`;
  if (!isUuid(quizId)) redirect('/t/quizzes');
  if (!isUuid(classId)) redirect(flashUrl(back, 'error', 'invalid'));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('live_start', { p_quiz_id: quizId, p_class_id: classId });
  if (error || !data) redirect(flashUrl(back, 'error', errorCode(error)));
  redirect(`/present/live/${data}`);
}

/** The projector's buttons: next question, show the answer, end the game. */
export async function controlLive(liveId: string, action: 'next' | 'reveal' | 'finish'): Promise<ActionResult> {
  if (!isUuid(liveId) || !['next', 'reveal', 'finish'].includes(action)) return { ok: false, error: mn.errors.invalid };
  const supabase = await createClient();
  const { error } = await supabase.rpc('live_control', { p_live_id: liveId, p_action: action });
  return error ? { ok: false, error: errorMessage(error) } : { ok: true };
}
