'use client';

import { useMemo, useState, useTransition } from 'react';
import { Alert, Badge, Button } from '@/components/ui';
import { saveAttendance } from '@/features/attendance/actions';
import { ATTENDANCE_STATUSES, ATTENDANCE_STYLE } from '@/lib/constants';
import { displayName } from '@/lib/mn/names';
import type { AttendanceRow, AttendanceStatus } from '@/lib/types';
import { mn } from '@/locales/mn';

interface RowState {
  status: AttendanceStatus;
  note: string;
  noteOpen: boolean;
}

/**
 * One lesson's attendance. Everyone starts as "present" (or as the login-based
 * suggestion), so the teacher only taps the exceptions and presses Save.
 */
export function AttendanceSheet({
  classId,
  date,
  period,
  rows,
  anyLogin,
  alreadySaved,
}: {
  classId: string;
  date: string;
  period: number;
  rows: AttendanceRow[]; // in alphabet order
  anyLogin: boolean;
  alreadySaved: boolean;
}) {
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      rows.map((r) => [r.student_id, { status: r.status, note: r.note ?? '', noteOpen: Boolean(r.note) }]),
    ),
  );
  const [dirty, setDirty] = useState(!alreadySaved);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, late: 0, absent: 0, excused: 0, sick: 0 };
    for (const r of rows) c[state[r.student_id]?.status ?? 'present'] += 1;
    return c;
  }, [rows, state]);

  function update(id: string, patch: Partial<RowState>) {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setDirty(true);
    setSavedAt(null);
  }

  function allPresent() {
    setState((prev) => Object.fromEntries(Object.entries(prev).map(([id, r]) => [id, { ...r, status: 'present' as const }])));
    setDirty(true);
    setSavedAt(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveAttendance({
        classId,
        date,
        period,
        rows: rows.map((r) => ({
          student_id: r.student_id,
          status: state[r.student_id].status,
          note: state[r.student_id].note.trim() || null,
        })),
      });
      if (result.ok) {
        setDirty(false);
        setSavedAt(new Date().toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }));
      } else {
        setError(result.error ?? mn.errors.generic);
      }
    });
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_STATUSES.map((s) => (
            <span key={s} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${ATTENDANCE_STYLE[s].cell}`}>
              {ATTENDANCE_STYLE[s].icon} {mn.attendanceStatus[s]} {counts[s]}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {savedAt ? <span className="text-sm font-semibold text-emerald-700">✓ {mn.common.saved} {savedAt}</span> : null}
          <Button type="button" variant="secondary" onClick={allPresent} disabled={pending}>
            {mn.attendance.allPresent}
          </Button>
          <Button type="button" size="lg" onClick={save} disabled={pending || (!dirty && alreadySaved)}>
            {pending ? mn.common.loading : mn.common.save}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {rows.map((r, i) => {
          const row = state[r.student_id];
          return (
            <li key={r.student_id} className="py-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-7 text-right text-sm tabular-nums text-slate-500">{i + 1}</span>
                <span className="min-w-40 flex-1 text-base font-semibold text-slate-900">
                  {displayName(r)}
                  {anyLogin && !r.logged_in ? (
                    <span className="ml-2 align-middle">
                      <Badge tone="warning">{mn.attendance.notLoggedIn}</Badge>
                    </span>
                  ) : null}
                  {r.suggested === 'late' && !r.saved ? (
                    <span className="ml-2 align-middle">
                      <Badge tone="info">{mn.attendance.suggestedLate}</Badge>
                    </span>
                  ) : null}
                </span>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={displayName(r)}>
                  {ATTENDANCE_STATUSES.map((s) => {
                    const active = row.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => update(r.student_id, { status: s })}
                        className={`flex min-h-11 min-w-11 items-center gap-1 rounded-lg border px-3 text-sm font-bold transition-colors ${
                          active ? ATTENDANCE_STYLE[s].active : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span aria-hidden="true">{ATTENDANCE_STYLE[s].icon}</span>
                        <span className="hidden sm:inline">{mn.attendanceStatus[s]}</span>
                        <span className="sr-only sm:hidden">{mn.attendanceStatus[s]}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => update(r.student_id, { noteOpen: !row.noteOpen })}
                    aria-expanded={row.noteOpen}
                    aria-label={mn.attendance.note}
                    title={mn.attendance.note}
                    className={`min-h-11 min-w-11 rounded-lg border px-2 text-sm ${
                      row.note ? 'border-brand-400 bg-brand-50' : 'border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    💬
                  </button>
                </div>
              </div>
              {row.noteOpen ? (
                <input
                  value={row.note}
                  onChange={(e) => update(r.student_id, { note: e.target.value })}
                  maxLength={300}
                  placeholder={mn.attendance.notePlaceholder}
                  aria-label={`${displayName(r)} — ${mn.attendance.note}`}
                  className="ml-10 mt-2 h-9 w-[calc(100%-2.5rem)] rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
