'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, fieldClass } from '@/components/ui';
import { saveScores } from '@/features/grading/actions';
import { LOW_PERCENT } from '@/lib/constants';
import { fill } from '@/lib/errors';
import { displayName } from '@/lib/mn/names';
import type { GradeItemSheet } from '@/lib/types';
import { mn } from '@/locales/mn';

interface Cell {
  score: string; // kept as text while typing; '' = not handed in
  excused: boolean;
}

/** Scores of one piece of work, one row per student. */
export function ScoreGrid({
  itemId,
  maxScore,
  rows,
}: {
  itemId: string;
  maxScore: number;
  rows: GradeItemSheet['rows']; // in alphabet order
}) {
  const [cells, setCells] = useState<Record<string, Cell>>(() =>
    Object.fromEntries(rows.map((r) => [r.student_id, { score: r.score === null ? '' : String(r.score), excused: r.is_excused }])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const invalid = (c: Cell) => c.score !== '' && (!Number.isFinite(Number(c.score)) || Number(c.score) < 0 || Number(c.score) > maxScore);
  const anyInvalid = Object.values(cells).some(invalid);

  function change(id: string, patch: Partial<Cell>) {
    setCells((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setSaved(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveScores({
        itemId,
        rows: rows.map((r) => ({
          student_id: r.student_id,
          score: cells[r.student_id].score === '' ? null : Number(cells[r.student_id].score),
          is_excused: cells[r.student_id].excused,
        })),
      });
      if (result.ok) setSaved(true);
      else setError(result.error ?? mn.errors.generic);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setCells((prev) => Object.fromEntries(Object.entries(prev).map(([id, c]) => [id, c.score === '' && !c.excused ? { ...c, score: String(maxScore) } : c])));
            setSaved(false);
          }}
        >
          {fill(mn.grades.fillMax, { max: maxScore })}
        </Button>
        <span className="text-xs text-slate-500">{mn.grades.scoreHint}</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.map((r, i) => {
          const cell = cells[r.student_id];
          const bad = invalid(cell);
          const percent = cell.score !== '' && !bad ? (Number(cell.score) / maxScore) * 100 : null;
          return (
            <li key={r.student_id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="w-7 text-right text-sm tabular-nums text-slate-500">{i + 1}</span>
              <span className="min-w-40 flex-1 font-semibold text-slate-900">{displayName(r)}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={maxScore}
                step="any"
                value={cell.score}
                disabled={cell.excused}
                onChange={(e) => change(r.student_id, { score: e.target.value })}
                aria-label={`${displayName(r)} — ${mn.grades.score}`}
                aria-invalid={bad}
                className={`${fieldClass('w-24 text-right tabular-nums')} ${
                  bad ? 'ring-2 ring-red-500' : percent !== null && percent < LOW_PERCENT ? 'font-bold ring-2 ring-red-200' : ''
                }`}
              />
              <span className="w-14 text-sm tabular-nums text-slate-500">/ {maxScore}</span>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={cell.excused}
                  onChange={(e) => change(r.student_id, { excused: e.target.checked, score: e.target.checked ? '' : cell.score })}
                  className="h-4 w-4"
                />
                {mn.grades.excused}
              </label>
            </li>
          );
        })}
      </ul>

      {anyInvalid ? <Alert tone="error">{mn.errors.score_out_of_range}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">{mn.common.saved}</Alert> : null}
      <Button type="button" size="lg" onClick={save} disabled={pending || anyInvalid}>
        {pending ? mn.common.loading : mn.common.save}
      </Button>
    </div>
  );
}
