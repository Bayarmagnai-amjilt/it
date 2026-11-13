'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, fieldClass } from '@/components/ui';
import { saveComponents } from '@/features/grading/actions';
import { COMPONENT_SOURCES } from '@/lib/constants';
import type { ComponentSource, GradeComponentInput, MissingPolicy } from '@/lib/types';
import { mn } from '@/locales/mn';

interface Row extends GradeComponentInput {
  key: string; // stable React key, also for rows not saved yet
}

// The example of the prompt (section 6): the weights add up to 100.
const EXAMPLE: { nameKey: keyof typeof mn.grades.exampleNames; weight: number; source: ComponentSource; missing: MissingPolicy }[] = [
  { nameKey: 'attendance', weight: 10, source: 'attendance', missing: 'zero' },
  { nameKey: 'quiz', weight: 30, source: 'quiz', missing: 'zero' },
  { nameKey: 'scratch', weight: 20, source: 'scratch', missing: 'zero' },
  { nameKey: 'practice', weight: 10, source: 'practice', missing: 'exclude' },
  { nameKey: 'participation', weight: 10, source: 'manual', missing: 'zero' },
  { nameKey: 'exam', weight: 20, source: 'quiz', missing: 'zero' },
];

let counter = 0;
const newKey = () => `new-${++counter}`;

/**
 * Grading setup of one class and term. The Save button stays disabled, and the
 * total turns red, until the weights add up to exactly 100 %.
 */
export function ComponentsEditor({
  classId,
  termId,
  initial,
  lockedIds,
}: {
  classId: string;
  termId: string;
  initial: GradeComponentInput[];
  lockedIds: string[]; // components that already hold scored work: cannot be removed
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((c) => ({ ...c, key: c.id ?? newKey() })));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = Math.round(rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0) * 100) / 100;
  const valid = total === 100 && rows.length > 0 && rows.every((r) => r.name.trim() && Number(r.weight) > 0);

  function change(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setSaved(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveComponents({
        classId,
        termId,
        components: rows.map(({ id, name, weight, source, missing_policy }) => ({
          id: id ?? null,
          name: name.trim(),
          weight: Number(weight),
          source,
          missing_policy,
        })),
      });
      if (result.ok) {
        setSaved(true);
        // reload so that new rows get their database ids; ?ok=saved shows the notice
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        url.searchParams.set('ok', 'saved');
        window.location.assign(url.toString());
      } else {
        setError(result.error ?? mn.errors.generic);
      }
    });
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <div className="rounded-2xl border-[3px] border-dashed border-ink-300 bg-ink-50 p-5 text-center">
          <p className="text-sm text-slate-700">{mn.grades.setup.empty}</p>
          <div className="mt-3">
            <Button
              type="button"
              onClick={() =>
                setRows(
                  EXAMPLE.map((e) => ({
                    key: newKey(),
                    name: mn.grades.exampleNames[e.nameKey],
                    weight: e.weight,
                    source: e.source,
                    missing_policy: e.missing,
                  })),
                )
              }
            >
              {mn.grades.setup.useExample}
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-b-2 border-ink-900 px-2 py-2 font-extrabold">{mn.grades.setup.name}</th>
                <th className="border-b-2 border-ink-900 px-2 py-2 font-extrabold">{mn.grades.setup.weight}</th>
                <th className="border-b-2 border-ink-900 px-2 py-2 font-extrabold">{mn.grades.setup.source}</th>
                <th className="border-b-2 border-ink-900 px-2 py-2 font-extrabold">{mn.grades.setup.missing}</th>
                <th className="border-b-2 border-ink-900 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const locked = Boolean(r.id && lockedIds.includes(r.id));
                return (
                  <tr key={r.key}>
                    <td className="border-b border-ink-100 px-2 py-2">
                      <input
                        value={r.name}
                        onChange={(e) => change(r.key, { name: e.target.value })}
                        maxLength={60}
                        aria-label={mn.grades.setup.name}
                        className={fieldClass('min-w-40')}
                      />
                    </td>
                    <td className="border-b border-ink-100 px-2 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={Number(r.weight) || 0}
                          onChange={(e) => change(r.key, { weight: Number(e.target.value) })}
                          aria-label={`${r.name} — ${mn.grades.setup.weight}`}
                          className="w-28 accent-brand-500"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={Number.isFinite(r.weight) ? r.weight : ''}
                          onChange={(e) => change(r.key, { weight: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
                          aria-label={`${r.name} — ${mn.grades.setup.weight} %`}
                          className={fieldClass('w-20 text-right tabular-nums')}
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </td>
                    <td className="border-b border-ink-100 px-2 py-2">
                      <select
                        value={r.source}
                        onChange={(e) => change(r.key, { source: e.target.value as ComponentSource })}
                        aria-label={mn.grades.setup.source}
                        className={fieldClass('min-w-44')}
                      >
                        {COMPONENT_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {mn.sources[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-ink-100 px-2 py-2">
                      {r.source === 'attendance' ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <select
                          value={r.missing_policy}
                          onChange={(e) => change(r.key, { missing_policy: e.target.value as MissingPolicy })}
                          aria-label={mn.grades.setup.missing}
                          className={fieldClass('min-w-36')}
                        >
                          <option value="zero">{mn.missing.zero}</option>
                          <option value="exclude">{mn.missing.exclude}</option>
                        </select>
                      )}
                    </td>
                    <td className="border-b border-ink-100 px-2 py-2 text-right">
                      <button
                        type="button"
                        disabled={locked}
                        title={locked ? mn.errors.component_has_items : mn.common.delete}
                        aria-label={mn.common.delete}
                        onClick={() => {
                          setRows((prev) => prev.filter((x) => x.key !== r.key));
                          setSaved(false);
                        }}
                        className="rounded-lg border-2 border-transparent px-2 py-1 text-slate-500 hover:border-ink-900 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-2 py-3 text-right font-bold">{mn.common.total}</td>
                <td className="px-2 py-3">
                  <span
                    className={`inline-block rounded-lg border-2 border-ink-900 px-3 py-1 font-mono text-base font-bold tabular-nums ${
                      total === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                    }`}
                    role="status"
                  >
                    {total}%
                  </span>
                </td>
                <td colSpan={3} className="px-2 py-3 text-sm font-semibold text-red-700">
                  {total !== 100 ? mn.errors.weights_must_sum_100 : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">{mn.common.saved}</Alert> : null}

      {rows.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setRows((prev) => [...prev, { key: newKey(), name: '', weight: 0, source: 'manual', missing_policy: 'zero' }]);
              setSaved(false);
            }}
          >
            + {mn.grades.setup.addRow}
          </Button>
          <Button type="button" onClick={save} disabled={!valid || pending}>
            {pending ? mn.common.loading : mn.common.save}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
