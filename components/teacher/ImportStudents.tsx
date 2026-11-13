'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Alert, Button, Field, fieldClass, Select, tableClass, tdClass, thClass } from '@/components/ui';
import { importStudents } from '@/features/classes/actions';
import { fill } from '@/lib/errors';
import { displayName, parseStudentLines, type ParsedStudent } from '@/lib/mn/names';
import { mn } from '@/locales/mn';

/**
 * Three ways in: paste a column copied from Excel, type names one per line, or
 * upload an .xlsx / .csv file. Everything ends in the same preview table, which
 * the teacher checks before anything is saved.
 */
export function ImportStudents({ classes, initialClassId }: { classes: { id: string; name: string }[]; initialClassId: string }) {
  const [classId, setClassId] = useState(initialClassId);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ParsedStudent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  function preview(value: string) {
    setText(value);
    setRows(parseStudentLines(value));
    setDone(null);
    setError(null);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setDone(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/import/students', { method: 'POST', body });
      const json = (await response.json()) as { rows?: ParsedStudent[]; error?: string };
      if (!response.ok || !json.rows) {
        setError(mn.importPage.fileError);
      } else if (json.rows.length === 0) {
        setError(mn.importPage.fileEmpty);
      } else {
        setText('');
        setRows(json.rows);
      }
    } catch {
      setError(mn.importPage.fileError);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await importStudents(classId, rows);
      if (result.ok) {
        setDone(Number(result.message ?? rows.length));
        setRows([]);
        setText('');
      } else {
        setError(result.error ?? mn.errors.generic);
      }
    });
  }

  const className = classes.find((c) => c.id === classId)?.name ?? '';

  return (
    <div className="space-y-5">
      <div className="max-w-xs">
        <Field label={mn.importPage.targetClass}>
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field label={mn.importPage.pasteLabel} hint={mn.importPage.pasteHint}>
          <textarea
            value={text}
            onChange={(e) => preview(e.target.value)}
            rows={10}
            placeholder={mn.importPage.pastePlaceholder}
            className={fieldClass('h-auto py-2 font-mono')}
          />
        </Field>
        <div className="space-y-3">
          <Field label={mn.importPage.fileLabel} hint={mn.importPage.fileHint}>
            <input
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={uploading}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
              className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-xl file:border-2 file:border-ink-900 file:bg-white file:px-4 file:py-2 file:font-extrabold file:text-ink-900 file:shadow-brut-sm hover:file:bg-sun-100"
            />
          </Field>
          <a href="/api/import/template" className="inline-block text-sm font-extrabold text-brand-600 hover:underline">
            ⬇ {mn.importPage.template}
          </a>
          {uploading ? <p className="text-sm text-slate-600">{mn.common.loading}</p> : null}
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {done !== null ? (
        <Alert tone="success">
          {fill(mn.importPage.done, { n: done, class: className })}{' '}
          <Link href={`/t/classes/${classId}`} className="font-bold underline">
            {mn.importPage.openClass}
          </Link>
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <div>
          <h2 className="mb-2 text-base font-bold">{fill(mn.importPage.previewTitle, { n: rows.length })}</h2>
          <div className="max-h-96 overflow-auto rounded-xl border-2 border-ink-900">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>№</th>
                  <th className={thClass}>{mn.importPage.willShowAs}</th>
                  <th className={thClass}>{mn.students.familyInitial}</th>
                  <th className={thClass}>{mn.students.firstName}</th>
                  <th className={thClass}>{mn.students.gender}</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className={`${tdClass} tabular-nums text-slate-500`}>{i + 1}</td>
                    <td className={`${tdClass} font-semibold`}>{displayName(r)}</td>
                    <td className={tdClass}>{r.family_initial ?? '—'}</td>
                    <td className={tdClass}>{r.first_name}</td>
                    <td className={tdClass}>{r.gender === 'male' ? mn.students.male : r.gender === 'female' ? mn.students.female : '—'}</td>
                    <td className={tdClass}>
                      <button
                        type="button"
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}
                        className="rounded-lg border-2 border-transparent px-2 py-1 text-slate-500 hover:border-ink-900 hover:bg-red-50 hover:text-red-700"
                        aria-label={mn.common.delete}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <Button type="button" size="lg" disabled={pending || !classId} onClick={save}>
              {pending ? mn.common.loading : fill(mn.importPage.saveButton, { n: rows.length, class: className })}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
