'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CLASS_SECTIONS, isUuid, LOGO_BUCKET, LOGO_MAX_BYTES, LOGO_TYPES } from '@/lib/constants';
import { errorCode, flashUrl, safeReturnTo } from '@/lib/flash';
import type { ParsedStudent } from '@/lib/mn/names';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { errorMessage } from '@/lib/errors';
import { mn } from '@/locales/mn';

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const checked = (fd: FormData, key: string) => fd.get(key) === 'on' || fd.get(key) === 'true';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

type Supabase = Awaited<ReturnType<typeof createClient>>;

// --- class logos -------------------------------------------------------------
/** The logo picture sent with the form, if the teacher picked one. */
function logoFile(fd: FormData): File | null {
  const file = fd.get('logo');
  return file && typeof file !== 'string' && file.size > 0 ? file : null;
}

/** Stores the logo in the class's Storage folder; returns its public URL or an error code. */
async function uploadLogo(supabase: Supabase, classId: string, file: File): Promise<{ url: string } | { error: string }> {
  const ext = LOGO_TYPES[file.type];
  if (!ext || file.size > LOGO_MAX_BYTES) return { error: 'logo_invalid' };
  const bucket = supabase.storage.from(LOGO_BUCKET);
  // a new name every time, so browsers never show a cached old logo
  const path = `${classId}/${Date.now()}.${ext}`;
  const { error } = await bucket.upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) return { error: 'logo_failed' };
  return { url: bucket.getPublicUrl(path).data.publicUrl };
}

/** Deletes the class's logo files, except the one at `keepUrl`. */
async function removeLogos(supabase: Supabase, classId: string, keepUrl?: string): Promise<void> {
  const bucket = supabase.storage.from(LOGO_BUCKET);
  const { data } = await bucket.list(classId);
  const stale = (data ?? []).map((f) => `${classId}/${f.name}`).filter((path) => !keepUrl?.endsWith(`/${path}`));
  if (stale.length > 0) await bucket.remove(stale);
}

// --- classes -----------------------------------------------------------------
export async function createClass(fd: FormData): Promise<void> {
  const section = text(fd, 'section');
  if (!CLASS_SECTIONS.includes(section)) redirect(flashUrl('/t/classes', 'error', 'section_required'));
  const color = text(fd, 'color');
  const logo = logoFile(fd);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_class', {
    p_grade: Number(text(fd, 'grade')),
    p_section: section,
    p_color: HEX_COLOR.test(color) ? color : null,
  });
  if (error || !data) redirect(flashUrl('/t/classes', 'error', errorCode(error)));
  const back = `/t/classes/${data}`;

  if (logo) {
    // the class exists by now: if the picture fails, the teacher retries in its settings
    const saved = await uploadLogo(supabase, data, logo);
    if ('error' in saved) redirect(flashUrl(back, 'error', saved.error));
    const { error: logoError } = await supabase.from('classes').update({ animal_icon: saved.url }).eq('id', data);
    if (logoError) redirect(flashUrl(back, 'error', 'logo_failed'));
  }
  redirect(flashUrl(back, 'ok', 'created'));
}

export async function updateClassSettings(fd: FormData): Promise<void> {
  const id = text(fd, 'id');
  const back = `/t/classes/${id}`;
  if (!isUuid(id)) redirect('/t/classes');

  const homePractice = checked(fd, 'home_practice_enabled');
  // practice from home is only safe with the picture password, so it switches it on
  const picturePassword = checked(fd, 'picture_password_enabled') || homePractice;
  const color = text(fd, 'color');
  const lateAfter = Number(text(fd, 'late_after_minutes'));
  const lateCoef = Number(text(fd, 'late_coefficient'));
  const excused = text(fd, 'excused_policy');

  const supabase = await createClient();
  // new logo: the URL of a freshly uploaded picture, '' when it was taken away, null = unchanged
  let newIcon: string | null = null;
  const logo = logoFile(fd);
  if (logo) {
    const saved = await uploadLogo(supabase, id, logo);
    if ('error' in saved) redirect(flashUrl(back, 'error', saved.error));
    newIcon = saved.url;
  } else if (text(fd, 'logo_remove') === '1') {
    newIcon = '';
  }

  const { error } = await supabase
    .from('classes')
    .update({
      picture_password_enabled: picturePassword,
      home_practice_enabled: homePractice,
      homeroom_teacher_name: text(fd, 'homeroom_teacher_name') || null,
      ...(HEX_COLOR.test(color) ? { color } : {}),
      ...(newIcon !== null ? { animal_icon: newIcon } : {}),
      ...(Number.isFinite(lateAfter) && lateAfter >= 0 && lateAfter <= 60 ? { late_after_minutes: Math.round(lateAfter) } : {}),
      ...(Number.isFinite(lateCoef) && lateCoef >= 0 && lateCoef <= 1 ? { late_coefficient: lateCoef } : {}),
      ...(excused === 'exclude' || excused === 'count_present' ? { excused_policy: excused } : {}),
    })
    .eq('id', id);
  if (error) redirect(flashUrl(back, 'error', errorCode(error)));
  // the logo changed: the old picture is no longer needed
  if (newIcon !== null) await removeLogos(supabase, id, newIcon);
  redirect(flashUrl(back, 'ok', 'saved'));
}

export async function deleteClass(fd: FormData): Promise<void> {
  const id = text(fd, 'id');
  if (!isUuid(id)) redirect('/t/classes');
  const back = safeReturnTo(fd.get('return_to'), `/t/classes/${id}`);
  const supabase = await createClient();
  const { data: cls } = await supabase.from('classes').select('name').eq('id', id).maybeSingle();
  if (!cls) redirect(flashUrl('/t/classes', 'error', 'not_allowed'));
  if (text(fd, 'confirm_name').toLocaleUpperCase('mn') !== cls.name.toLocaleUpperCase('mn')) {
    redirect(flashUrl(back, 'error', 'confirm_mismatch'));
  }
  // Storage only lets a teacher of the class remove its files, so they go first
  await removeLogos(supabase, id);
  const { error } = await supabase.rpc('delete_class', { p_class_id: id });
  if (error) redirect(flashUrl(back, 'error', errorCode(error)));
  revalidatePath('/t', 'layout');
  redirect(flashUrl('/t/classes', 'ok', 'class_deleted'));
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
