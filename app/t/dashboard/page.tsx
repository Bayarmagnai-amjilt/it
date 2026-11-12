import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/teacher/Flash';
import { LessonButtons } from '@/components/teacher/LessonButtons';
import { Alert, Badge, buttonClass, Card, ClassChip, EmptyState, PageHeader } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/teacher';
import { animalEmoji } from '@/lib/constants';
import { fill } from '@/lib/errors';
import { formatDate, formatPercent, formatTime, isoWeekday } from '@/lib/mn/dates';
import type { SearchParams } from '@/lib/params';
import { loadClasses, loadTerms } from '@/lib/teacher-data';
import type { DashboardSummary } from '@/lib/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.nav.dashboard };

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-slate-900">{value}</p>
      {note ? (
        <p className={`mt-1 text-sm font-semibold ${tone === 'up' ? 'text-emerald-700' : tone === 'down' ? 'text-red-700' : 'text-slate-500'}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireTeacher();
  const sp = await searchParams;
  const [{ data }, classes, { year, terms }] = await Promise.all([
    supabase.rpc('dashboard_summary'),
    loadClasses(supabase),
    loadTerms(supabase),
  ]);
  const s = data as DashboardSummary | null;

  // week-over-week change of attendance, in percentage points
  const delta =
    s && s.week_attendance !== null && s.prev_week_attendance !== null
      ? Math.round((s.week_attendance - s.prev_week_attendance) * 10) / 10
      : null;
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${formatPercent(v)}%`);

  return (
    <div>
      <PageHeader
        title={mn.nav.dashboard}
        subtitle={s ? `${formatDate(s.today)} · ${mn.weekdays[isoWeekday(s.today) - 1]}` : undefined}
      />
      <Flash params={sp} />

      {!year ? (
        <div className="mb-4">
          <Alert tone="warning">
            {mn.dashboard.noYear}{' '}
            <Link href="/t/settings" className="font-bold underline">
              {mn.nav.settings}
            </Link>
          </Alert>
        </div>
      ) : terms.length === 0 ? (
        <div className="mb-4">
          <Alert tone="warning">
            {mn.dashboard.noTerms}{' '}
            <Link href="/t/settings" className="font-bold underline">
              {mn.nav.settings}
            </Link>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={mn.dashboard.kpiStudents} value={String(s?.students ?? 0)} note={fill(mn.dashboard.kpiClasses, { n: s?.classes ?? 0 })} />
        <Kpi label={mn.dashboard.kpiToday} value={pct(s?.today_attendance)} note={s?.today_attendance === null ? mn.dashboard.notTakenYet : undefined} />
        <Kpi
          label={mn.dashboard.kpiWeek}
          value={pct(s?.week_attendance)}
          note={delta === null ? undefined : `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)} ${mn.dashboard.vsLastWeek}`}
          tone={delta === null ? undefined : delta >= 0 ? 'up' : 'down'}
        />
        <Kpi label={mn.dashboard.kpiOnline} value={String(s?.online ?? 0)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title={mn.dashboard.todaySchedule}>
          {!s || s.schedule.length === 0 ? (
            <p className="text-sm text-slate-600">{mn.dashboard.noLessonsToday}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {s.schedule.map((row) => (
                <li key={`${row.class_id}-${row.starts_at}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-24 text-sm font-semibold tabular-nums text-slate-600">
                      {formatTime(row.starts_at)}–{formatTime(row.ends_at)}
                    </span>
                    <ClassChip name={row.name} color={row.color} emoji={animalEmoji(row.animal_icon)} />
                    {row.open_lesson_id ? <Badge tone="success">{mn.lesson.open}</Badge> : null}
                    {row.attendance_done ? <Badge tone="info">{mn.dashboard.attendanceDone}</Badge> : null}
                  </div>
                  <LessonButtons classId={row.class_id} isOpen={Boolean(row.open_lesson_id)} returnTo="/t/dashboard" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={mn.dashboard.myClasses}
          actions={
            <Link href="/t/classes" className={buttonClass('ghost', 'sm')}>
              {mn.common.all} →
            </Link>
          }
        >
          {classes.length === 0 ? (
            <EmptyState
              title={mn.classes.empty}
              hint={mn.classes.emptyHint}
              action={
                <Link href="/t/classes" className={buttonClass('primary')}>
                  {mn.classes.create}
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {classes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/t/classes/${c.id}`}>
                      <ClassChip name={c.name} color={c.color} emoji={animalEmoji(c.animal_icon)} />
                    </Link>
                    <span className="text-sm text-slate-600">{fill(mn.classes.studentCount, { n: c.student_count })}</span>
                    {c.open_lesson_id ? <Badge tone="success">{mn.lesson.open}</Badge> : null}
                  </div>
                  <LessonButtons classId={c.id} isOpen={Boolean(c.open_lesson_id)} returnTo="/t/dashboard" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-6 text-sm text-slate-500">{mn.dashboard.moreSoon}</p>
    </div>
  );
}
