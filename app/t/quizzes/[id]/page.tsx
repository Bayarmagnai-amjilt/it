import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/ConfirmButton';
import { QuestionView } from '@/components/quiz/QuestionView';
import { Flash } from '@/components/teacher/Flash';
import { Badge, Button, buttonClass, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { archiveQuiz, assignQuiz, closeAssignment, startLive } from '@/features/quizzes/actions';
import { requireTeacher } from '@/lib/auth/teacher';
import { isUuid } from '@/lib/constants';
import { fill } from '@/lib/errors';
import { formatStamp } from '@/lib/mn/dates';
import type { SearchParams } from '@/lib/params';
import type { QuizDetail } from '@/lib/quiz/types';
import { loadClasses } from '@/lib/teacher-data';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.nav.quizzes };

export default async function QuizPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;
  const { supabase } = await requireTeacher();
  const [{ data }, classes] = await Promise.all([supabase.rpc('quiz_detail', { p_quiz_id: id }), loadClasses(supabase)]);
  const quiz = data as QuizDetail | null;
  if (!quiz) notFound();
  const back = `/t/quizzes/${id}`;
  const now = Date.now();

  return (
    <div>
      <PageHeader
        title={quiz.title}
        subtitle={[fill(mn.quiz.questionCount, { n: quiz.questions.length }), quiz.description].filter(Boolean).join(' · ')}
        actions={
          <>
            <Link href="/t/quizzes" className={buttonClass('ghost', 'md')}>
              ← {mn.common.back}
            </Link>
            <Link href={`${back}/edit`} className={buttonClass('secondary', 'md')}>
              ✏️ {mn.quiz.edit}
            </Link>
          </>
        }
      />
      <Flash params={sp} />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Card title={mn.quiz.preview}>
          <ol className="space-y-5">
            {quiz.questions.map((q, i) => (
              <li key={q.id} className="rounded-2xl border-2 border-ink-200 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
                  <span className="text-ink-900">{fill(mn.quiz.questionN, { n: i + 1 })}</span>
                  <Badge tone="info">{mn.quiz.types[q.type]}</Badge>
                  <Badge>{q.time_limit ? fill(mn.quiz.seconds, { n: q.time_limit }) : mn.quiz.noLimit}</Badge>
                  <Badge>{fill(mn.live.points, { n: Number(q.points) })}</Badge>
                </div>
                <QuestionView question={q} reveal={q.answer_key ? { key: q.answer_key } : null} />
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-6">
          <Card title={`▶ ${mn.quiz.liveTitle}`}>
            <p className="mb-3 text-sm text-slate-600">{mn.quiz.liveHint}</p>
            <form action={startLive} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="quiz_id" value={id} />
              <Field label={mn.quiz.assignClass}>
                <Select name="class_id" required defaultValue="">
                  <option value="" disabled>
                    —
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="accent">
                {mn.quiz.liveButton}
              </Button>
            </form>
          </Card>

          <Card title={`📝 ${mn.quiz.assignTitle}`}>
            <p className="mb-3 text-sm text-slate-600">{mn.quiz.assignHint}</p>
            <form action={assignQuiz} className="space-y-3">
              <input type="hidden" name="quiz_id" value={id} />
              <Field label={mn.quiz.assignClass}>
                <Select name="class_id" required defaultValue="">
                  <option value="" disabled>
                    —
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={mn.quiz.closesAt}>
                <Input type="datetime-local" name="closes_at" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={mn.quiz.maxAttempts}>
                  <Select name="max_attempts" defaultValue="1">
                    <option value="">{mn.quiz.unlimited}</option>
                    {[1, 2, 3, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={mn.quiz.showCorrect}>
                  <Select name="show_correct" defaultValue="after_submit">
                    {(['after_each', 'after_submit', 'never'] as const).map((k) => (
                      <option key={k} value={k}>
                        {mn.quiz.showCorrectOptions[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button type="submit" className="w-full">
                {mn.quiz.assignButton}
              </Button>
            </form>
          </Card>

          <Card title={mn.quiz.assignments}>
            {quiz.assignments.length === 0 ? (
              <p className="text-sm text-slate-600">{mn.quiz.noAssignments}</p>
            ) : (
              <ul className="divide-y-2 divide-dashed divide-ink-100">
                {quiz.assignments.map((a) => {
                  const open = a.mode === 'live' ? a.live_state !== 'finished' : !a.closes_at || new Date(a.closes_at).getTime() > now;
                  return (
                    <li key={a.id} className="space-y-2 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink-900">{a.class_name}</span>
                        <Badge tone={a.mode === 'live' ? 'warning' : 'info'}>{mn.quiz.modes[a.mode]}</Badge>
                        <Badge tone={open ? 'success' : 'neutral'}>{open ? mn.quiz.open_ : mn.quiz.closed}</Badge>
                        <span className="text-xs font-semibold text-slate-500">
                          {formatStamp(a.created_at)} · {fill(mn.quiz.playerCount, { n: a.players })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/t/quizzes/results/${a.id}`} className={buttonClass('secondary', 'sm')}>
                          {mn.quiz.results}
                        </Link>
                        {a.mode === 'live' && open && a.live_id ? (
                          <Link href={`/present/live/${a.live_id}`} className={buttonClass('accent', 'sm')}>
                            {mn.quiz.hostScreen}
                          </Link>
                        ) : null}
                        {open ? (
                          <form action={closeAssignment}>
                            <input type="hidden" name="assignment_id" value={a.id} />
                            <input type="hidden" name="return_to" value={back} />
                            <Button type="submit" size="sm" variant="ghost">
                              {mn.quiz.close}
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <form action={archiveQuiz}>
            <input type="hidden" name="quiz_id" value={id} />
            <ConfirmButton variant="danger" size="sm" message={fill(mn.quiz.archiveConfirm, { title: quiz.title })}>
              🗑 {mn.quiz.archive}
            </ConfirmButton>
          </form>
        </div>
      </div>
    </div>
  );
}
