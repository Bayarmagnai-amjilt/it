import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, buttonClass, Card, EmptyState, Field, Input, PageHeader, Select } from '@/components/ui';
import { attendancePercent, countStatuses, type ExcusedPolicy } from '@/lib/attendance';
import { requireTeacher } from '@/lib/auth/teacher';
import { ATTENDANCE_STATUSES, ATTENDANCE_STYLE, LOW_PERCENT } from '@/lib/constants';
import { formatDayMonth, formatPercent, isYearMonth, monthRange, shiftMonth, todayISO } from '@/lib/mn/dates';
import { displayName, sortByName } from '@/lib/mn/names';
import { param, type SearchParams } from '@/lib/params';
import { fetchAll } from '@/lib/supabase/paginate';
import { loadClasses, pick } from '@/lib/teacher-data';
import type { AttendanceStatus, RosterStudent } from '@/lib/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.attendance.history };

export default async function AttendanceHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireTeacher();
  const sp = await searchParams;
  const classes = await loadClasses(supabase);
  const cls = pick(classes, param(sp.class));
  const wantedMonth = param(sp.month);
  const month = isYearMonth(wantedMonth) ? wantedMonth : todayISO().slice(0, 7);

  if (!cls) {
    return (
      <div>
        <PageHeader title={mn.attendance.history} />
        <EmptyState title={mn.classes.empty} hint={mn.classes.emptyHint} />
      </div>
    );
  }

  const { from, to } = monthRange(month);
  const [{ data: lessonData }, { data: rosterData }, { data: classData }] = await Promise.all([
    supabase
      .from('lesson_sessions')
      .select('id, held_on, period')
      .eq('class_id', cls.id)
      .gte('held_on', from)
      .lte('held_on', to)
      .order('held_on')
      .order('period'),
    supabase.rpc('class_roster', { p_class_id: cls.id }),
    supabase.from('classes').select('late_coefficient, excused_policy').eq('id', cls.id).maybeSingle(),
  ]);
  const lessons = (lessonData ?? []) as { id: string; held_on: string; period: number }[];
  const roster = sortByName((rosterData ?? []) as RosterStudent[]);
  const settings = (classData ?? { late_coefficient: 0.5, excused_policy: 'exclude' }) as {
    late_coefficient: number;
    excused_policy: ExcusedPolicy;
  };

  const marks = new Map<string, AttendanceStatus>(); // `${lesson}:${student}` -> status
  if (lessons.length > 0) {
    const ids = lessons.map((l) => l.id);
    const attendance = await fetchAll<{ lesson_session_id: string; student_id: string; status: AttendanceStatus }>((a, b) =>
      supabase
        .from('attendance')
        .select('lesson_session_id, student_id, status')
        .in('lesson_session_id', ids)
        .order('lesson_session_id')
        .order('student_id')
        .range(a, b),
    );
    for (const a of attendance) {
      marks.set(`${a.lesson_session_id}:${a.student_id}`, a.status);
    }
  }

  return (
    <div>
      <PageHeader
        title={mn.attendance.history}
        subtitle={`${cls.name} · ${month.replace('-', '.')}`}
        actions={
          <Link href={`/t/attendance?class=${cls.id}`} className={buttonClass('secondary')}>
            {mn.nav.takeAttendance}
          </Link>
        }
      />

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label={mn.common.class}>
            <Select name="class" defaultValue={cls.id} className="w-28">
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={mn.attendance.month}>
            <Input type="month" name="month" defaultValue={month} className="w-44" />
          </Field>
          <Button type="submit" variant="secondary">
            {mn.common.show}
          </Button>
          <div className="ml-auto flex gap-2">
            <Link href={`/t/attendance/history?class=${cls.id}&month=${shiftMonth(month, -1)}`} className={buttonClass('ghost', 'sm')}>
              ← {mn.attendance.prevMonth}
            </Link>
            <Link href={`/t/attendance/history?class=${cls.id}&month=${shiftMonth(month, 1)}`} className={buttonClass('ghost', 'sm')}>
              {mn.attendance.nextMonth} →
            </Link>
          </div>
        </form>
      </Card>

      {lessons.length === 0 ? (
        <EmptyState title={mn.attendance.noLessons} hint={mn.attendance.noLessonsHint} />
      ) : (
        <Card>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {ATTENDANCE_STATUSES.map((s) => (
              <span key={s} className={`rounded-lg border-2 border-ink-900 px-2 py-0.5 font-bold ${ATTENDANCE_STYLE[s].cell}`}>
                {mn.attendanceShort[s]} = {mn.attendanceStatus[s]}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b-2 border-ink-900 bg-ink-50 px-3 py-2 text-left font-extrabold">{mn.common.name}</th>
                  {lessons.map((l) => (
                    <th key={l.id} className="border-b-2 border-ink-900 bg-ink-50 px-1 py-2 text-center font-mono text-xs font-bold tabular-nums">
                      <Link href={`/t/attendance?class=${cls.id}&date=${l.held_on}&period=${l.period}`} className="hover:underline">
                        {formatDayMonth(l.held_on)}
                        {l.period > 1 ? <span className="block text-[10px] text-slate-500">#{l.period}</span> : null}
                      </Link>
                    </th>
                  ))}
                  <th className="border-b-2 border-ink-900 bg-ink-50 px-3 py-2 text-right font-extrabold">%</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => {
                  const statuses = lessons.map((l) => marks.get(`${l.id}:${s.student_id}`));
                  const percent = attendancePercent(countStatuses(statuses), Number(settings.late_coefficient), settings.excused_policy);
                  return (
                    <tr key={s.student_id}>
                      <td className="sticky left-0 z-10 whitespace-nowrap border-b border-ink-100 bg-white px-3 py-1.5 font-bold">
                        <Link href={`/t/students/${s.student_id}`} className="hover:underline">
                          {displayName(s)}
                        </Link>
                      </td>
                      {statuses.map((status, i) => (
                        <td key={lessons[i].id} className="border-b border-ink-100 p-0.5 text-center">
                          {status ? (
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-extrabold ${ATTENDANCE_STYLE[status].cell}`}
                              title={mn.attendanceStatus[status]}
                            >
                              {mn.attendanceShort[status]}
                            </span>
                          ) : (
                            <span className="text-slate-300">·</span>
                          )}
                        </td>
                      ))}
                      <td
                        className={`border-b border-ink-100 px-3 py-1.5 text-right font-mono font-bold tabular-nums ${
                          percent !== null && percent < LOW_PERCENT ? 'bg-red-50 text-red-700' : ''
                        }`}
                      >
                        {percent === null ? '—' : formatPercent(percent)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">{mn.attendance.historyHint}</p>
        </Card>
      )}
    </div>
  );
}
