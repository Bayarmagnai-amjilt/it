'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { ClassLogo } from '@/components/ClassLogo';
import { studentLogin } from '@/features/auth/actions';
import { PICTURE_TILES, pictureLength } from '@/lib/constants';
import { fill } from '@/lib/errors';
import { displayName, firstLetter } from '@/lib/mn/names';
import type { LoginClass, LoginStudent, StudentLoginError } from '@/lib/types';
import { mn } from '@/locales/mn';

const AVATAR_COLORS = ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

type Step = 'pick' | 'confirm' | 'picture';

/**
 * Student login without typing: pick your name, confirm, and (when the teacher
 * turned it on) tap your pictures in order.
 */
export function StudentPicker({
  cls,
  students,
  letters,
  code,
}: {
  cls: LoginClass;
  students: LoginStudent[]; // already in Mongolian alphabet order
  letters: string[];
  code: string | null;
}) {
  const [step, setStep] = useState<Step>('pick');
  const [letter, setLetter] = useState<string | null>(null);
  const [selected, setSelected] = useState<LoginStudent | null>(null);
  const [setup, setSetup] = useState(false);
  const [pictures, setPictures] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [pending, startTransition] = useTransition();

  const needed = pictureLength(cls.grade);
  const visible = useMemo(
    () => (letter ? students.filter((s) => firstLetter(s.first_name) === letter) : students),
    [students, letter],
  );

  function reset() {
    setStep('pick');
    setSelected(null);
    setPictures([]);
    setError(null);
  }

  function describe(reason: StudentLoginError | undefined, attemptsLeft?: number): string {
    switch (reason) {
      case 'wrong_picture':
        return attemptsLeft !== undefined && attemptsLeft <= 2
          ? fill(mn.public.wrongPictureLeft, { n: attemptsLeft })
          : mn.public.wrongPicture;
      case 'too_many_attempts':
        return mn.public.tooManyAttempts;
      case 'locked':
        return mn.public.lockedNow;
      case 'setup_in_class':
        return mn.public.setupInClass;
      case 'not_found':
        return mn.public.notInClass;
      default:
        return mn.public.loginFailed;
    }
  }

  function submit(student: LoginStudent, chosen: string[] | null) {
    setError(null);
    startTransition(async () => {
      const result = await studentLogin({ classId: cls.id, studentId: student.id, pictures: chosen, code });
      if (result.ok) {
        window.location.assign('/s/home');
        return;
      }
      if (result.error === 'picture_required') {
        // the class uses picture passwords: ask for them (or let the student choose)
        setSetup(Boolean(result.setup));
        setPictures([]);
        setStep('picture');
        return;
      }
      setPictures([]);
      setError(describe(result.error, result.attempts_left));
      if (result.error === 'wrong_picture') {
        setShake(true);
        setTimeout(() => setShake(false), 450);
      }
    });
  }

  function confirmYes() {
    if (!selected) return;
    if (cls.picture_password_enabled) {
      setSetup(!selected.has_picture_password);
      setPictures([]);
      setError(null);
      setStep('picture');
    } else {
      submit(selected, null);
    }
  }

  function tapPicture(id: string) {
    if (pending || !selected || pictures.length >= needed) return;
    const next = [...pictures, id];
    setPictures(next);
    setError(null);
    // entering: go as soon as the last picture is tapped; choosing: wait for "Done"
    if (!setup && next.length === needed) submit(selected, next);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="press flex min-h-16 items-center gap-2 rounded-2xl border-[3px] border-ink-900 bg-white px-6 font-heading text-xl font-bold text-ink-900 shadow-brut-sm hover:bg-sun-100"
        >
          <span aria-hidden="true">←</span> {mn.public.backToClasses}
        </Link>
        <div
          className="flex items-center gap-3 rounded-2xl border-[3px] border-ink-900 px-6 py-3 font-heading text-3xl font-bold text-white shadow-brut [text-shadow:0_2px_0_rgb(0_0_0/0.25)]"
          style={{ backgroundColor: cls.color }}
        >
          <ClassLogo icon={cls.animal_icon} />
          {cls.name}
        </div>
      </div>

      <h1 className="text-center text-3xl font-extrabold text-ink-900 sm:text-5xl">{mn.public.pickName}</h1>

      {letters.length > 1 ? (
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={mn.public.letterFilter}>
          <button
            type="button"
            onClick={() => setLetter(null)}
            aria-pressed={letter === null}
            className={`press min-h-16 min-w-16 rounded-2xl border-[3px] border-ink-900 px-4 text-xl font-extrabold shadow-brut-sm ${
              letter === null ? 'bg-sun-400 text-ink-900' : 'bg-white text-ink-900 hover:bg-sun-100'
            }`}
          >
            {mn.common.all}
          </button>
          {letters.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLetter(l === letter ? null : l)}
              aria-pressed={letter === l}
              className={`press min-h-16 min-w-16 rounded-2xl border-[3px] border-ink-900 text-2xl font-extrabold shadow-brut-sm ${
                letter === l ? 'bg-sun-400 text-ink-900' : 'bg-white text-ink-900 hover:bg-sun-100'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      ) : null}

      {students.length === 0 ? (
        <p className="text-center text-xl font-semibold text-slate-600">{mn.public.noStudents}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelected(s);
                setError(null);
                setStep('confirm');
              }}
              className="card-in lift flex min-h-24 items-center gap-3 rounded-2xl border-[3px] border-ink-900 bg-white p-4 text-left shadow-brut focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
              style={{ animationDelay: `${Math.min(i, 30) * 45}ms` }}
            >
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-ink-900 font-heading text-2xl font-bold text-white [text-shadow:0_2px_0_rgb(0_0_0/0.2)]"
                style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                aria-hidden="true"
              >
                {firstLetter(s.first_name)}
              </span>
              <span className="text-2xl font-extrabold leading-tight text-ink-900">{displayName(s)}</span>
            </button>
          ))}
        </div>
      )}

      {step === 'confirm' && selected ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-3xl border-[3px] border-ink-900 bg-white p-8 text-center shadow-brut-lg">
            <div className="bob text-7xl" aria-hidden="true">👋</div>
            <p className="mt-4 text-3xl font-extrabold text-ink-900">
              {fill(mn.public.confirmName, { name: displayName(selected) })}
            </p>
            {error ? <p className="mt-3 text-xl font-bold text-red-600" role="alert">{error}</p> : null}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <button
                type="button"
                disabled={pending}
                onClick={confirmYes}
                className="press min-h-20 rounded-2xl border-[3px] border-ink-900 bg-brand-500 text-3xl font-extrabold text-white shadow-brut hover:bg-brand-600 disabled:opacity-60"
              >
                <span aria-hidden="true">✓ </span>
                {pending ? mn.common.loading : mn.common.yes}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={reset}
                className="press min-h-20 rounded-2xl border-[3px] border-ink-900 bg-white text-3xl font-extrabold text-ink-900 shadow-brut hover:bg-blush-100 disabled:opacity-60"
              >
                <span aria-hidden="true">✗ </span>
                {mn.common.no}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 'picture' && selected ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-ink-950/60 p-4" role="dialog" aria-modal="true">
          <div className={`w-full max-w-xl rounded-3xl border-[3px] border-ink-900 bg-white p-6 text-center shadow-brut-lg ${shake ? 'shake' : ''}`}>
            <p className="text-2xl font-extrabold text-ink-900">{displayName(selected)}</p>
            <p className="mt-1 text-xl font-bold text-slate-600">
              {setup ? fill(mn.public.choosePictures, { n: needed }) : fill(mn.public.enterPictures, { n: needed })}
            </p>

            <div className="mt-4 flex justify-center gap-3" aria-label={mn.public.chosenPictures}>
              {Array.from({ length: needed }, (_, i) => {
                const tile = PICTURE_TILES.find((t) => t.id === pictures[i]);
                return (
                  <span
                    key={i}
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] text-4xl ${
                      tile ? 'border-ink-900 bg-sun-100 shadow-brut-sm' : 'border-dashed border-ink-300 bg-ink-50'
                    }`}
                  >
                    {/* while entering, taps are shown as dots so a neighbour cannot read them */}
                    {tile ? (setup ? tile.emoji : '●') : ''}
                  </span>
                );
              })}
            </div>

            {error ? <p className="mt-3 text-xl font-bold text-red-600" role="alert">{error}</p> : null}

            <div className="mt-5 grid grid-cols-3 gap-3">
              {PICTURE_TILES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={pending}
                  onClick={() => tapPicture(t.id)}
                  className="press flex min-h-24 flex-col items-center justify-center rounded-2xl border-[3px] border-ink-900 bg-brand-50 p-2 shadow-brut-sm hover:bg-brand-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 disabled:opacity-60"
                >
                  <span className="text-5xl" aria-hidden="true">{t.emoji}</span>
                  <span className="mt-1 text-xl font-extrabold text-ink-900">{mn.pictures[t.id]}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={reset}
                className="press min-h-16 rounded-2xl border-[3px] border-ink-900 bg-white text-xl font-extrabold text-ink-900 shadow-brut-sm hover:bg-ink-50"
              >
                {mn.common.back}
              </button>
              <button
                type="button"
                disabled={pending || pictures.length === 0}
                onClick={() => setPictures([])}
                className="press min-h-16 rounded-2xl border-[3px] border-ink-900 bg-white text-xl font-extrabold text-ink-900 shadow-brut-sm hover:bg-ink-50 disabled:opacity-50"
              >
                {mn.public.clearPictures}
              </button>
              {setup ? (
                <button
                  type="button"
                  disabled={pending || pictures.length !== needed}
                  onClick={() => submit(selected, pictures)}
                  className="press min-h-16 rounded-2xl border-[3px] border-ink-900 bg-brand-500 text-xl font-extrabold text-white shadow-brut-sm hover:bg-brand-600 disabled:opacity-50"
                >
                  {pending ? mn.common.loading : mn.public.picturesDone}
                </button>
              ) : (
                <span className="flex min-h-16 items-center justify-center text-xl font-bold text-slate-500">
                  {pending ? mn.common.loading : ''}
                </span>
              )}
            </div>
            {setup ? <p className="mt-4 text-lg text-slate-600">{mn.public.rememberPictures}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
