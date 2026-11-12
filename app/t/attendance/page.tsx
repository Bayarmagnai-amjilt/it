import type { Metadata } from 'next';
import Link from 'next/link';
import { AttendanceSheet } from '@/components/teacher/AttendanceSheet';
import { Flash } from '@/components/teacher/Flash';
import { Alert, Badge, Button, buttonClass, Card, EmptyState, Field, Input, PageHeader, Select } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/teacher';
import { fill } from '@/lib/errors';
import { formatDate, isISODate, isoWeekday, todayISO } from '@/lib/mn/dates';
import { sortByName } from '@/lib/mn/names';
import { param, type SearchParams } from '@/lib/params';
import { loadClasses, pick } from '@/lib/teacher-data';
import type { AttendanceSheetData } from '@/lib/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.nav.attendance };

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireTeacher();
  const sp = await searchParams;
  const classes = await loadClasses(supabase);
  const today = todayISO();
  const wantedDate = param(sp.date);
  const date = isISODate(wantedDate) && wantedDate <= today ? wantedDate : today;
  const period = Math.min(Math.max(Number(param(sp.period)) || 1, 1), 8);

  // default class: one with an open lesson, otherwise the first
  const cls = pick(classes, param(sp.class), classes.find((c) => c.open_lesson_id)?.id);

  if (!cls) {
    return (
      <div>
        <PageHeader title={mn.nav.attendance} />
        <EmptyState
          title={mn.classes.empty}
          hint={mn.classes.emptyHint}
          action={
            <Link href="/t/classes" className={buttonClass('primary')}>
              {mn.classes.create}
            </Link>
          }
        />
      </div>
    );
  }

  const { data, error } = await supabase.rpc('attendance_sheet', {
    p_class_id: cls.id,
    p_date: date,
    p_period: period,
  });
  const sheet = data as AttendanceSheetData | null;
  const rows = sortByName(sheet?.rows ?? []);
  const alreadySaved = rows.length > 0 && rows.every((r) => r.saved);

  return (
    <div>
      <PageHeader
        title={mn.attendance.title}
        subtitle={`${cls.name} · ${formatDate(date)} · ${mn.weekdays[isoWeekday(date) - 1]} · ${fill(mn.attendance.periodN, { n: period })}`}
        actions={
          <Link href={`/t/attendance/history?class=${cls.id}`} className={buttonClass('secondary')}>
            {mn.attendance.history}
          </Link>
        }
      />
      <Flash params={sp} />

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
          <Field label={mn.common.date}>
            <Input type="date" name="date" defaultValue={date} max={today} className="w-44" />
          </Field>
          <Field label={mn.common.period}>
            <Select name="period" defaultValue={String(period)} className="w-24">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">
            {mn.common.show}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {alreadySaved ? <Badge tone="success">{mn.attendance.saved}</Badge> : <Badge tone="warning">{mn.attendance.notSaved}</Badge>}
            {sheet?.any_login ? <Badge tone="info">{mn.attendance.autoSuggested}</Badge> : null}
          </div>
        </form>
      </Card>

      {error || !sheet ? (
        <Alert tone="error">{mn.errors.generic}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState
          title={mn.classes.noStudents}
          hint={mn.classes.noStudentsHint}
          action={
            <Link href={`/t/students/import?class=${cls.id}`} className={buttonClass('primary')}>
              {mn.importPage.title}
            </Link>
          }
        />
      ) : (
        <Card>
          {/* key: a different class / date / period starts from a clean sheet */}
          <AttendanceSheet
            key={`${cls.id}-${date}-${period}`}
            classId={cls.id}
            date={date}
            period={period}
            rows={rows}
            anyLogin={sheet.any_login}
            alreadySaved={alreadySaved}
          />
        </Card>
      )}
    </div>
  );
}
