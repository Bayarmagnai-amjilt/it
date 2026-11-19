import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, buttonClass, Card, PageHeader, tableClass, tdClass, thClass, thRightClass } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/teacher';
import { isUuid, LOW_PERCENT } from '@/lib/constants';
import { fill } from '@/lib/errors';
import { formatStamp } from '@/lib/mn/dates';
import { compareNames, displayName } from '@/lib/mn/names';
import type { QuizResults } from '@/lib/quiz/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.quiz.results };

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border-[3px] border-ink-900 bg-white p-4 shadow-brut-sm">
      <p className="text-sm font-bold text-slate-600">{label}</p>
      <p className="font-heading text-3xl font-bold text-ink-900">{value}</p>
      {note ? <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-600">{note}</p> : null}
    </div>
  );
}

export default async function QuizResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireTeacher();
  const { data } = await supabase.rpc('quiz_results', { p_assignment_id: id });
  const results = data as QuizResults | null;
  if (!results) notFound();

  const { assignment, questions } = results;
  const max = Number(assignment.total_points);
  const live = assignment.mode === 'live';
  const students = [...results.students].sort(compareNames);
  const took = students.filter((s) => s.attempts > 0);
  const average = took.length && max ? Math.round((took.reduce((sum, s) => sum + Number(s.score ?? 0), 0) / took.length / max) * 100) : null;
  const answered = questions.filter((q) => q.answered > 0);
  const missed = answered.length ? answered.reduce((a, b) => (b.correct / b.answered < a.correct / a.answered ? b : a)) : null;

  return (
    <div>
      <PageHeader
        title={fill(mn.quiz.resultsTitle, { title: assignment.title })}
        subtitle={`${assignment.class_name} · ${mn.quiz.modes[assignment.mode]} · ${formatStamp(assignment.created_at)}`}
        actions={
          <>
            <Link href={`/t/quizzes/${assignment.quiz_id}`} className={buttonClass('ghost', 'md')}>
              ← {mn.common.back}
            </Link>
            <a href={`/api/export/quiz/${id}`} className={buttonClass('secondary', 'md')}>
              📥 {mn.quiz.exportCsv}
            </a>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={mn.quiz.participants} value={`${took.length} / ${students.length}`} />
        <Stat label={mn.quiz.average} value={average === null ? '—' : `${average}%`} />
        <Stat
          label={mn.quiz.mostMissed}
          value={missed ? `${pct(missed.correct, missed.answered)}%` : '—'}
          note={missed ? `${missed.position}. ${missed.text ?? mn.quiz.types[missed.type]}` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={mn.quiz.perQuestion}>
          {/* one series (share answered right): bars with the value at the tip, no legend */}
          <ul className="space-y-3">
            {questions.map((q) => {
              const share = pct(q.correct, q.answered);
              return (
                <li key={q.id} className="space-y-1" title={`${q.correct} / ${q.answered}`}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-bold text-ink-900">
                      {q.position}. {q.text || mn.quiz.types[q.type]}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                      {q.answered ? `${q.correct}/${q.answered}` : mn.quiz.noAnswers}
                      {q.avg_time_ms !== null ? ` · ${fill(mn.quiz.secondsShort, { n: Math.round(Number(q.avg_time_ms) / 100) / 10 })}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 flex-1 rounded-full bg-ink-100">
                      <span
                        className="block h-3 rounded-r-[4px] bg-brand-500"
                        style={{ width: `${share ?? 0}%`, borderTopLeftRadius: 9999, borderBottomLeftRadius: 9999 }}
                      />
                    </span>
                    <span className="w-12 text-right font-heading font-bold tabular-nums text-ink-900">{share === null ? '—' : `${share}%`}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title={mn.quiz.perStudent}>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>№</th>
                  <th className={thClass}>{mn.common.name}</th>
                  <th className={thRightClass}>{mn.quiz.score}</th>
                  <th className={thRightClass}>{mn.quiz.percent}</th>
                  {live ? <th className={thRightClass}>{mn.quiz.gamePoints}</th> : <th className={thRightClass}>{mn.quiz.attempts}</th>}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const share = s.attempts > 0 && s.score !== null ? pct(Number(s.score), max) : null;
                  return (
                    <tr key={s.student_id}>
                      <td className={`${tdClass} w-10 tabular-nums text-slate-500`}>{i + 1}</td>
                      <td className={`${tdClass} font-semibold text-ink-900`}>
                        {displayName(s)} {s.status === 'in_progress' ? <Badge tone="warning">{mn.quiz.inProgress}</Badge> : null}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {s.attempts > 0 ? `${Number(s.score ?? 0)} / ${max}` : <span className="text-slate-400">{mn.quiz.notTaken}</span>}
                      </td>
                      <td className={`${tdClass} text-right font-bold tabular-nums ${share !== null && share < LOW_PERCENT ? 'text-red-700' : 'text-ink-900'}`}>
                        {share === null ? '' : `${share}%`}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{live ? (s.game_points ?? '') : s.attempts || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
