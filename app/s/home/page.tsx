import type { Metadata } from 'next';
import Link from 'next/link';
import { ClassLogo } from '@/components/ClassLogo';
import { Mascot } from '@/components/Mascot';
import { requireStudent } from '@/lib/auth/student';
import { fill } from '@/lib/errors';
import { formatStamp } from '@/lib/mn/dates';
import type { StudentActivities } from '@/lib/quiz/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.common.home };
export const dynamic = 'force-dynamic';

const TILE = 'press flex flex-col gap-2 rounded-3xl border-[3px] border-ink-900 bg-white p-6 text-ink-900 shadow-brut hover:bg-sun-50';

export default async function StudentHomePage() {
  const student = await requireStudent();
  const { data } = await createAdminClient().rpc('student_activities', { p_session_id: student.session_id });
  const activities = (data ?? { live: null, quizzes: [] }) as StudentActivities;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Mascot className="bob h-24 w-24" />
          <div>
            <h1 className="text-3xl font-extrabold text-ink-900 sm:text-5xl">{fill(mn.student.hello, { name: student.first_name })}</h1>
            <p className="mt-2 text-xl font-bold text-slate-600 sm:text-2xl">{mn.student.welcome}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border-[3px] border-ink-900 bg-white p-4 pr-6 shadow-brut">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-ink-900 text-4xl"
            style={{ backgroundColor: student.color }}
            aria-hidden="true"
          >
            <ClassLogo icon={student.animal_icon} />
          </span>
          <span>
            <span className="block font-mono text-sm font-bold uppercase text-slate-500">{mn.common.class}</span>
            <span className="block font-heading text-3xl font-bold text-ink-900">{student.class_name}</span>
          </span>
        </div>
      </section>

      {activities.live ? (
        <Link
          href={`/s/live/${activities.live.id}`}
          className="press hero-pattern flex flex-wrap items-center justify-between gap-4 rounded-3xl border-[3px] border-ink-900 p-8 text-white shadow-brut-blush"
        >
          <span>
            <span className="block text-2xl font-extrabold sm:text-3xl">🎮 {mn.live.joinTitle}</span>
            <span className="mt-1 block text-xl font-bold text-ink-100">{activities.live.title}</span>
          </span>
          <span className="rounded-2xl border-[3px] border-ink-900 bg-sun-400 px-8 py-3 font-heading text-2xl font-bold text-ink-900 shadow-brut-sm">
            {mn.live.join} ▶
          </span>
        </Link>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">
          <span aria-hidden="true">📋 </span>
          {mn.student.todayTasks}
        </h2>
        {activities.quizzes.length === 0 ? (
          <p className="rounded-3xl border-[3px] border-dashed border-ink-300 p-6 text-xl font-semibold text-slate-600">{mn.student.noTasks}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {activities.quizzes.map((q) => {
              const left = q.max_attempts === null ? null : Math.max(0, q.max_attempts - q.attempts);
              const canStart = q.in_progress || left === null || left > 0;
              const body = (
                <>
                  <span className="text-2xl font-extrabold">📝 {q.title}</span>
                  <span className="text-lg font-semibold text-slate-600">{fill(mn.quiz.questionCount, { n: q.questions })}</span>
                  {q.best !== null ? (
                    <span className="font-bold text-ink-900">{fill(mn.play.best, { score: Number(q.best), max: Number(q.total_points) })}</span>
                  ) : null}
                  {q.closes_at ? <span className="text-sm font-semibold text-slate-500">{fill(mn.play.closes, { date: formatStamp(q.closes_at) })}</span> : null}
                  <span className="mt-2 font-heading text-xl font-bold text-brand-600">
                    {canStart ? `${q.in_progress ? mn.play.continue : q.attempts ? mn.play.again : mn.play.start} ▶` : mn.play.errors.no_attempts_left}
                  </span>
                </>
              );
              return (
                <li key={q.assignment_id}>
                  {canStart ? (
                    <Link href={`/s/quiz/${q.assignment_id}`} className={TILE}>
                      {body}
                    </Link>
                  ) : (
                    <div className={`${TILE} opacity-70`}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Link href="/games" className="press flex flex-wrap items-center justify-between gap-4 rounded-3xl border-[3px] border-ink-900 bg-mint-100 p-6 shadow-brut hover:bg-mint-200">
        <span>
          <span className="block text-2xl font-extrabold text-ink-900 sm:text-3xl">🧩 {mn.play.games}</span>
          <span className="mt-1 block text-lg font-bold text-slate-600">{mn.play.gamesHint}</span>
        </span>
        <span className="font-heading text-2xl font-bold text-ink-900">▶</span>
      </Link>
    </div>
  );
}
