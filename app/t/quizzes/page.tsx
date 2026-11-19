import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/teacher/Flash';
import { Badge, buttonClass, Card, EmptyState, PageHeader } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/teacher';
import { fill } from '@/lib/errors';
import { formatStamp } from '@/lib/mn/dates';
import type { SearchParams } from '@/lib/params';
import type { AssignmentRow, QuizListItem } from '@/lib/quiz/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.nav.quizzes };

export default async function QuizzesPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireTeacher();
  const sp = await searchParams;
  const { data } = await supabase.rpc('my_quizzes');
  const { quizzes, assignments } = (data ?? { quizzes: [], assignments: [] }) as {
    quizzes: QuizListItem[];
    assignments: AssignmentRow[];
  };

  return (
    <div>
      <PageHeader
        title={mn.nav.quizzes}
        subtitle={mn.quiz.pageSubtitle}
        actions={
          <>
            <Link href="/t/games" className={buttonClass('secondary', 'md')}>
              🧩 {mn.games.teacherTitle}
            </Link>
            <Link href="/t/quizzes/new" className={buttonClass('primary', 'md')}>
              + {mn.quiz.newQuiz}
            </Link>
          </>
        }
      />
      <Flash params={sp} />
      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <Card title={mn.quiz.myQuizzes}>
          {quizzes.length === 0 ? (
            <EmptyState
              title={mn.quiz.noQuizzes}
              hint={mn.quiz.noQuizzesHint}
              action={
                <Link href="/t/quizzes/new" className={buttonClass('primary', 'md')}>
                  + {mn.quiz.newQuiz}
                </Link>
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {quizzes.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/t/quizzes/${q.id}`}
                    className="lift flex h-full flex-col gap-2 rounded-2xl border-[3px] border-ink-900 bg-white p-4 shadow-brut-sm hover:bg-sun-50"
                  >
                    <span className="text-lg font-extrabold text-ink-900">{q.title}</span>
                    <span className="mt-auto flex flex-wrap gap-2 text-sm font-semibold text-slate-600">
                      <Badge tone="info">{fill(mn.quiz.questionCount, { n: q.questions })}</Badge>
                      {q.grade ? <Badge>{fill(mn.quiz.gradeOption, { grade: q.grade })}</Badge> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={mn.quiz.recent}>
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-600">{mn.quiz.noRecent}</p>
          ) : (
            <ul className="divide-y-2 divide-dashed divide-ink-100">
              {assignments.map((a) => {
                const running = a.live_id && a.live_state !== 'finished';
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-ink-900">{a.quiz_title}</span>
                      <span className="block text-xs font-semibold text-slate-500">
                        {a.class_name} · {formatStamp(a.created_at)} · {fill(mn.quiz.playerCount, { n: a.players })}
                      </span>
                    </span>
                    <Badge tone={a.mode === 'live' ? 'warning' : 'info'}>{mn.quiz.modes[a.mode]}</Badge>
                    {running ? (
                      <Link href={`/present/live/${a.live_id}`} className={buttonClass('accent', 'sm')}>
                        {mn.quiz.hostScreen}
                      </Link>
                    ) : null}
                    <Link href={`/t/quizzes/results/${a.id}`} className={buttonClass('secondary', 'sm')}>
                      {mn.quiz.results}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
