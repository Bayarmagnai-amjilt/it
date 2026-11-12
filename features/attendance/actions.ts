'use server';

import { revalidatePath } from 'next/cache';
import { ATTENDANCE_STATUSES, isUuid } from '@/lib/constants';
import { errorMessage } from '@/lib/errors';
import { isISODate } from '@/lib/mn/dates';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult, AttendanceStatus } from '@/lib/types';
import { mn } from '@/locales/mn';

export async function saveAttendance(input: {
  classId: string;
  date: string;
  period: number;
  rows: { student_id: string; status: AttendanceStatus; note?: string | null }[];
}): Promise<ActionResult> {
  if (
    !input ||
    !isUuid(input.classId) ||
    !isISODate(input.date) ||
    !Number.isInteger(input.period) ||
    input.period < 1 ||
    input.period > 12 ||
    !Array.isArray(input.rows)
  ) {
    return { ok: false, error: mn.errors.invalid };
  }
  const rows = input.rows
    .filter((r) => isUuid(r?.student_id) && ATTENDANCE_STATUSES.includes(r.status))
    .map((r) => ({ student_id: r.student_id, status: r.status, note: (r.note ?? '').slice(0, 300) }));

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_attendance', {
    p_class_id: input.classId,
    p_date: input.date,
    p_period: input.period,
    p_rows: rows,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath('/t', 'layout');
  return { ok: true };
}
