import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/constants';
import { todayISO } from '@/lib/mn/dates';
import { compareNames, displayName } from '@/lib/mn/names';
import { createClient } from '@/lib/supabase/server';
import type { QuizResults } from '@/lib/quiz/types';
import { mn } from '@/locales/mn';

export const dynamic = 'force-dynamic';

const cell = (value: unknown) => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (values: unknown[]) => values.map(cell).join(',');
const percent = (score: number | null, max: number) => (score === null || !max ? '' : Math.round((score / max) * 1000) / 10);

// /api/export/quiz/<assignment id>: one row per student, then one per question.
// UTF-8 with a BOM so Excel shows Mongolian letters correctly.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('quiz_results', { p_assignment_id: id });
  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const results = data as QuizResults;
  const max = Number(results.assignment.total_points);
  const live = results.assignment.mode === 'live';

  const lines = [
    row([results.assignment.title, results.assignment.class_name]),
    '',
    row(['№', mn.common.name, mn.quiz.attempts, mn.quiz.score, mn.common.total, mn.quiz.percent, ...(live ? [mn.quiz.gamePoints] : [])]),
    ...[...results.students].sort(compareNames).map((s, i) =>
      row([
        i + 1,
        displayName(s),
        s.attempts,
        s.score ?? '',
        max,
        percent(s.score === null ? null : Number(s.score), max),
        ...(live ? [s.game_points ?? ''] : []),
      ]),
    ),
    '',
    row(['№', mn.quiz.questionText, mn.quiz.type, mn.quiz.points, mn.quiz.participants, mn.quiz.correctRate, mn.quiz.avgTime]),
    ...results.questions.map((q) =>
      row([
        q.position,
        q.text ?? '',
        mn.quiz.types[q.type],
        q.points,
        q.answered,
        q.answered ? `${Math.round((q.correct / q.answered) * 100)}%` : '',
        q.avg_time_ms === null ? '' : Math.round(q.avg_time_ms / 100) / 10,
      ]),
    ),
  ];
  const name = `${results.assignment.class_name}_${results.assignment.title}_${todayISO()}.csv`.replace(/[\\/:*?"<>|\s]+/g, '_');
  return new NextResponse(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  });
}
