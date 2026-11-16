import { cn } from '@/components/ui';
import { fill } from '@/lib/errors';
import type { Distribution, LeaderRow, PublicQuestion } from '@/lib/quiz/types';
import { mn } from '@/locales/mn';
import { optionColor, optionLetter } from './theme';

interface Row {
  key: string;
  label: string;
  badge: string;
  color: string;
  count: number;
  right: boolean;
}

function rowsFor(question: PublicQuestion, d: Distribution): Row[] {
  const key = question.answer_key ?? {};
  const right = Array.isArray(key.correct) ? key.correct : [key.correct];
  if (question.type === 'single_choice' || question.type === 'multi_choice') {
    return (question.content.options ?? []).map((o, i) => ({
      key: o.id,
      label: o.text,
      badge: optionLetter(i),
      color: optionColor(i),
      count: d.picks[o.id] ?? 0,
      right: right.includes(o.id),
    }));
  }
  if (question.type === 'true_false') {
    return [true, false].map((v) => ({
      key: String(v),
      label: v ? mn.quiz.trueLabel : mn.quiz.falseLabel,
      badge: v ? '👍' : '👎',
      color: v ? '#22c493' : '#ff6b9a',
      count: d.picks[String(v)] ?? 0,
      right: key.correct === v,
    }));
  }
  return [
    { key: 'right', label: mn.live.right, badge: '✓', color: '#22c493', count: d.correct, right: true },
    { key: 'wrong', label: mn.live.wrong, badge: '✗', color: '#ff6b9a', count: d.wrong, right: false },
  ];
}

/**
 * How the class answered: one bar per option, value at the bar's tip.
 * Identity: letter + text beside each bar; the right option carries ✓ and a label.
 */
export function AnswerBars({ question, distribution }: { question: PublicQuestion; distribution: Distribution }) {
  const rows = rowsFor(question, distribution);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,14rem)_1fr] items-center gap-3" title={`${r.label}: ${r.count}`}>
          <span className="flex min-w-0 items-center gap-2 text-lg font-bold text-ink-900">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-ink-900 font-heading text-sm text-white"
              style={{ backgroundColor: r.color }}
              aria-hidden="true"
            >
              {r.badge}
            </span>
            <span className="truncate">{r.label}</span>
            {r.right ? (
              <span className="shrink-0 rounded-md border-2 border-ink-900 bg-mint-200 px-1.5 text-xs font-extrabold text-ink-900">✓ {mn.quiz.correct}</span>
            ) : null}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="block h-6 rounded-r-[4px] transition-[width] duration-500"
              style={{ width: `${(r.count / max) * 85}%`, minWidth: r.count ? 6 : 0, backgroundColor: r.color }}
            />
            <span className="font-heading text-xl font-bold tabular-nums text-ink-900">{r.count}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Leaderboard({ rows, highlight }: { rows: LeaderRow[]; highlight?: string | null }) {
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => (
        <li
          key={r.student_id}
          className={cn(
            'card-in flex items-center gap-3 rounded-2xl border-[3px] border-ink-900 bg-white px-4 py-2 shadow-brut-sm',
            r.student_id === highlight && 'bg-sun-100',
          )}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink-900 bg-ink-50 font-heading font-bold">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-xl font-extrabold text-ink-900">{r.name}</span>
          <span className="font-heading text-xl font-bold tabular-nums text-ink-900">{fill(mn.live.points, { n: r.score })}</span>
        </li>
      ))}
    </ol>
  );
}

/** 1st in the middle and tallest, 2nd on the left, 3rd on the right. */
export function Podium({ rows }: { rows: LeaderRow[] }) {
  const places = [
    { row: rows[1], place: 2, medal: '🥈', height: 'h-32', color: 'bg-ink-100' },
    { row: rows[0], place: 1, medal: '🥇', height: 'h-44', color: 'bg-sun-400' },
    { row: rows[2], place: 3, medal: '🥉', height: 'h-24', color: 'bg-tangerine-100' },
  ];
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-3 items-end gap-3">
      {places.map(({ row, place, medal, height, color }) => (
        <div key={place} className="flex flex-col items-center gap-2 text-center">
          {row ? (
            <>
              <span className="text-5xl" aria-hidden="true">{medal}</span>
              <span className="line-clamp-2 text-xl font-extrabold text-ink-900 sm:text-2xl">{row.name}</span>
              <span className="font-heading text-lg font-bold tabular-nums text-slate-600">{fill(mn.live.points, { n: row.score })}</span>
            </>
          ) : null}
          <div className={cn('flex w-full items-start justify-center rounded-t-2xl border-[3px] border-b-0 border-ink-900 pt-2 font-heading text-4xl font-bold text-ink-900', height, color)}>
            {place}
          </div>
        </div>
      ))}
    </div>
  );
}
