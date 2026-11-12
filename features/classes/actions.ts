'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ANIMAL_KEYS, isUuid } from '@/lib/constants';
import { errorCode, flashUrl, safeReturnTo } from '@/lib/flash';
import type { ParsedStudent } from '@/lib/mn/names';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { errorMessage } from '@/lib/errors';
import { mn } from '@/locales/mn';

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const checked = (fd: FormData, key: string) => fd.get(key) === 'on' || fd.get(key) === 'true';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// --- classes -----------------------------------------------------------------
export async function createClass(fd: FormData): Promise<void> {
  const supabase = await createClient();
  const color = text(fd, 'color');
  const icon = text(fd, 'animal_icon');
  const { data, error } = await supabase.rpc('create_class', {
    p_grade: Number(text(fd, 'grade')),
    p_section: text(fd, 'section'),
    p_color: HEX_COLOR.test(color) ? color : null,
    p_animal_icon: ANIMAL_KEYS.includes(icon) ? icon : null,
  });
  if (error || !data) redirect(flashUrl('/t/classes', 'error', errorCode(error)));
  redirect(flashUrl(`/t/classes/${data}`, 'ok', 'created'));
}

export async function updateClassSettings(fd: FormData): Promise<void> {
  const id = text(fd, 'id');
  const back = `/t/classes/${id}`;
  if (!isUuid(id)) redirect('/t/classes');

  const homePractice = checked(fd, 'home_practice_enabled');
  // practice from home is only safe with the picture password, so it switches it on
  const picturePassword = checked(fd, 'picture_password_enabled') || homePractice;
  const color = text(fd, 'color');
  const icon = text(fd, 'animal_icon');
  const lateAfter = Number(text(fd, 'late_after_minutes'));
  const lateCoef = Number(text(fd, 'late_coefficient'));
  const excused = text(fd, 'excused_policy');

  const supabase = await createClient();
  const { error } = await supabase
    .from('classes')
    .update({
      picture_password_enabled: picturePassword,
      home_practice_enabled: homePractice,
      homeroom_teacher_name: text(fd, 'homeroom_teacher_name') || null,
      ...(HEX_COLOR.test(color) ? { color } : {}),
      ...(ANIMAL_KEYS.includes(icon) ? { animal_icon: icon } : {}),
      ...(Number.isFinite(lateAfter) && lateAfter >= 0 && lateAfter <= 60 ? { late_after_minutes: Math.round(lateAfter) } : {}),
      ...(Number.isFinite(lateCoef) && lateCoef >= 0 && lateCoef <= 1 ? { late_coefficient: lateCoef } : {}),
      ...(excused === 'exclude' || excused === 'count_present' ? { excused_policy: excused } : {}),
    })
    .eq('id', id);
  redirect(error ? flashUrl(back, 'error', errorCode(error)) : flashUrl(back, 'ok', 'saved'));
}

export async function setClassStatus(fd: FormData): Promise<void> {
  const id = text(fd, 'id');
  const status = text(fd, 'status') === 'archived' ? 'archived' : 'active';
  if (!isUuid(id)) redirect('/t/classes');
  const supabase = await createClient();
  const { error } = await supabase.from('classes').update({ status }).eq('id', id);
  if (error) redirect(flashUrl(`/t/classes/${id}`, 'error', errorCode(error)));
  redirect(flashUrl(status === 'archived' ? '/t/classes' : `/t/classes/${id}`, 'ok', status === 'archived' ? 'archived' : 'restored'));
}

// --- timetable ---------------------------------------------------------------
export async function addScheduleSlot(fd: FormData): Promise<void> {
  const classId = text(fd, 'class_id');
  const back = `/t/classes/${classId}`;
  if (!isUuid(classId)) redirect('/t/classes');
  const weekday = Number(text(fd, 'weekday'));
  const starts = text(fd, 'starts_at');
  const ends = text(fd, 'ends_at');
  if (!(weekday >= 1 && weekday <= 7) || !/^\d{2}:\d{2}/.test(starts) || !/^\d{2}:\d{2}/.test(ends) || ends <= starts) {
    redirect(flashUrl(back, 'error', 'invalid'));
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('class_schedule_slots')
    .insert({ class_id: classId, weekday, starts_at: starts, ends_at: ends });
  redirect(error ? flashUrl(back, 'error', errorCode(error)) : flashUrl(back, 'ok', 'saved'));
}

export async function deleteScheduleSlot(fd: FormData): Promise<void> {
  const classId = text(fd, 'class_id');
  const id = text(fd, 'id');
  if (!isUuid(classId) || !isUuid(id)) redirect('/t/classes');
  const supabase = await createClient();
  const { error } = await supabase.from('class_schedule_slots').delete().eq('id', id).eq('class_id', classId);
  redirect(error ? flashUrl(`/t/classes/${classId}`, 'error', errorCode(error)) : flashUrl(`/t/classes/${classId}`, 'ok', 'deleted'));
}

// --- lessons -----------------------------------------------------------------
async function lessonAction(fd: FormData, fn: 'open_lesson' | 'close_lesson' | 'kick_all_students', ok: string) {
  const classId = text(fd, 'class_id');
  const back = safeReturnTo(fd.get('return_to'), '/t/dashboard');
  if (!isUuid(classId)) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_class_id: classId });
  redirect(error ? flashUrl(back, 'error', errorCode(error)) : flashUrl(back, 'ok', ok));
}

export async function openLesson(fd: FormData): Promise<void> {
  await lessonAction(fd, 'open_lesson', 'lesson_opened');
}
export async function closeLesson(fd: FormData): Promise<void> {
  await lessonAction(fd, 'close_lesson', 'lesson_closed');
}
export async function kickAllStudents(fd: FormData): Promise<void> {
  await lessonAction(fd, 'kick_all_students', 'kicked');
}

// --- students ----------------------------------------------------------------
export async function addStudent(fd: FormData): Promise<void> {
  const classId = text(fd, 'class_id');
  const back = `/t/classes/${classId}`;
  if (!isUuid(classId)) redirect('/t/classes');
  const first = text(fd, 'first_name');
  if (!first) redirect(flashUrl(back, 'error', 'name_required'));
  const supabase = await createClient();
  const { error } = await supabase.rpc('add_students', {
    p_class_id: classId,
    p_students: [{ first_name: first, family_initial: text(fd, 'family_initial'), gender: text(fd, 'gender') }],
  });
  redirect(error ? flashUrl(back, 'error', errorCode(error)) : flashUrl(back, 'ok', 'student_added'));
}

/** Called from the import page with the rows the teacher confirmed. */
export async function importStudents(classId: string, rows: ParsedStudent[]): Promise<ActionResult> {
  if (!isUuid(classId) || !Array.isArray(rows) || rows.length === 0 || rows.length > 200) {
    return { ok: false, error: mn.errors.invalid };
  }
  const clean = rows
    .map((r) => ({
      first_name: String(r?.first_name ?? '').trim().slice(0, 60),
      family_initial: r?.family_initial ? String(r.family_initial).trim().slice(0, 1) : '',
      gender: r?.gender === 'male' || r?.gender === 'female' ? r.gender : '',
    }))
    .filter((r) => r.first_name);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('add_students', { p_class_id: classId, p_students: clean });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath('/t', 'layout');
  return { ok: true, message: String(data ?? clean.length) };
}

async function studentAction(
  fd: FormData,
  run: (supabase: Awaited<ReturnType<typeof createClient>>, studentId: string) => PromiseLike<{ error: unknown }>,
  ok: string,
) {
  const studentId = text(fd, 'student_id');
  const back = safeReturnTo(fd.get('return_to'), '/t/students');
  if (!isUuid(studentId)) redirect(back);
  const supabase = await createClient();
  const { error } = await run(supabase, studentId);
  redirect(error ? flashUrl(back, 'error', errorCode(error as { message?: string; code?: string })) : flashUrl(back, 'ok', ok));
}

export async function updateStudent(fd: FormData): Promise<void> {
  await studentAction(
    fd,
    (supabase, id) =>
      supabase.rpc('update_student', {
        p_student_id: id,
        p_first_name: text(fd, 'first_name'),
        p_family_initial: text(fd, 'family_initial'),
        p_gender: text(fd, 'gender') || null,
      }),
    'saved',
  );
}

export async function resetPicturePassword(fd: FormData): Promise<void> {
  await studentAction(fd, (supabase, id) => supabase.rpc('reset_picture_password', { p_student_id: id }), 'picture_reset');
}

export async function transferStudent(fd: FormData): Promise<void> {
  const to = text(fd, 'to_class_id');
  if (!isUuid(to)) redirect(flashUrl(safeReturnTo(fd.get('return_to'), '/t/students'), 'error', 'invalid'));
  await studentAction(
    fd,
    (supabase, id) => supabase.rpc('transfer_student', { p_student_id: id, p_to_class_id: to }),
    'transferred',
  );
}

export async function removeStudent(fd: FormData): Promise<void> {
  await studentAction(fd, (supabase, id) => supabase.rpc('remove_student', { p_student_id: id }), 'student_removed');
}

export async function addNote(fd: FormData): Promise<void> {
  const body = text(fd, 'body').slice(0, 2000);
  if (!body) redirect(flashUrl(safeReturnTo(fd.get('return_to'), '/t/students'), 'error', 'invalid'));
  await studentAction(
    fd,
    async (supabase, id) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return supabase.from('teacher_notes').insert({ student_id: id, teacher_id: user?.id, body });
    },
    'saved',
  );
}

export async function deleteNote(fd: FormData): Promise<void> {
  const noteId = text(fd, 'note_id');
  const back = safeReturnTo(fd.get('return_to'), '/t/students');
  if (!isUuid(noteId)) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.from('teacher_notes').delete().eq('id', noteId);
  redirect(error ? flashUrl(back, 'error', errorCode(error)) : flashUrl(back, 'ok', 'deleted'));
}
