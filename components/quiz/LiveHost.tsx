'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Confetti } from '@/components/Confetti';
import { buttonClass, cn } from '@/components/ui';
import { controlLive } from '@/features/quizzes/actions';
import { fill } from '@/lib/errors';
import type { LiveHostState } from '@/lib/quiz/types';
import { mn } from '@/locales/mn';
import { AnswerBars, Leaderboard, Podium } from './LiveCharts';
import { QuestionView } from './QuestionView';
import { Timer } from './Timer';

const BIG_BUTTON = 'press min-h-16 rounded-2xl border-[3px] border-ink-900 px-8 font-heading text-2xl font-bold shadow-brut';

/** The projector screen of a live game. Asks the server for the state every second. */
export function LiveHost({ initial, siteUrl }: { initial: LiveHostState; siteUrl: string }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const revealed = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/${initial.id}`, { cache: 'no-store' });
      if (res.ok) setState((await res.json()) as LiveHostState);
    } catch {
      // a missed tick is fine; the next one catches up
    }
  }, [initial.id]);

  useEffect(() => {
    if (state.state === 'finished') return;
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [refresh, state.state]);

  const act = useCallback(
    (action: 'next' | 'reveal' | 'finish') => {
      startTransition(async () => {
        const result = await controlLive(initial.id, action);
        setError(result.ok ? null : (result.error ?? mn.errors.generic));
        await refresh();
      });
    },
    [initial.id, refresh],
  );

  // the answer appears by itself when time is up or everyone has answered
  const everyone = state.players.length > 0 && state.answered >= state.players.length;
  useEffect(() => {
    if (state.state === 'question' && everyone && revealed.current !== state.position) {
      revealed.current = state.position;
      act('reveal');
    }
  }, [state.state, state.position, everyone, act]);
  const onTimeUp = useCallback(() => {
    if (revealed.current !== state.position) {
      revealed.current = state.position;
      act('reveal');
    }
  }, [state.position, act]);

  const last = state.position !== null && state.position >= state.total;
  const q = state.question;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-sm font-bold uppercase text-slate-500">{state.class_name}</p>
          <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">{state.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {state.state === 'question' || state.state === 'reveal' ? (
            <span className="rounded-xl border-[3px] border-ink-900 bg-white px-4 py-1 font-heading text-2xl font-bold text-ink-900">
              {fill(mn.live.questionOf, { n: state.position ?? 0, total: state.total })}
            </span>
          ) : null}
          {state.state !== 'finished' ? (
            <button
              type="button"
              className={buttonClass('ghost', 'md')}
              disabled={pending}
              onClick={() => {
                if (window.confirm(mn.live.finishConfirm)) act('finish');
              }}
            >
              {mn.live.finish}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="rounded-xl border-2 border-ink-900 bg-blush-100 px-4 py-2 font-bold text-ink-900">{error}</p> : null}

      {state.state === 'lobby' ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <div className="hero-pattern w-full rounded-3xl border-[3px] border-ink-900 p-10 text-white shadow-brut-blush">
            <h2 className="text-4xl font-extrabold sm:text-6xl">{mn.live.lobbyTitle}</h2>
            <p className="mt-4 text-2xl font-bold sm:text-3xl">{fill(mn.live.lobbyHint, { class: state.class_name })}</p>
            <p className="mt-3 font-mono text-2xl font-bold text-sun-200">{siteUrl}</p>
          </div>
          <p className="text-2xl font-extrabold text-ink-900">
            {state.players.length ? fill(mn.live.joined, { n: state.players.length }) : mn.live.waitingPlayers}
          </p>
          <ul className="flex max-w-5xl flex-wrap justify-center gap-3">
            {state.players.map((name, i) => (
              <li key={`${name}-${i}`} className="card-in rounded-2xl border-[3px] border-ink-900 bg-white px-4 py-2 text-xl font-extrabold text-ink-900 shadow-brut-sm">
                {name}
              </li>
            ))}
          </ul>
          <button type="button" className={cn(BIG_BUTTON, 'bg-brand-500 text-white hover:bg-brand-600')} disabled={pending} onClick={() => act('next')}>
            {mn.live.start} ▶
          </button>
        </section>
      ) : null}

      {(state.state === 'question' || state.state === 'reveal') && q ? (
        <section className="grid flex-1 gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6 rounded-3xl border-[3px] border-ink-900 bg-white p-6 shadow-brut">
            {state.state === 'question' && q.time_limit ? (
              <Timer key={state.position} remainingMs={state.remaining_ms ?? 0} limitSec={q.time_limit} onEnd={onTimeUp} big />
            ) : null}
            <QuestionView
              key={`${q.id}-${state.state}`}
              question={q}
              big
              reveal={state.state === 'reveal' && q.answer_key ? { key: q.answer_key } : null}
            />
          </div>
          <aside className="space-y-5">
            {state.state === 'question' ? (
              <>
                <div className="rounded-3xl border-[3px] border-ink-900 bg-sun-100 p-6 text-center shadow-brut">
                  <p className="font-heading text-6xl font-bold tabular-nums text-ink-900">{state.answered}</p>
                  <p className="mt-1 text-xl font-bold text-slate-600">
                    {fill(mn.live.answeredOf, { n: state.answered, total: state.players.length })}
                  </p>
                </div>
                <button type="button" className={cn(BIG_BUTTON, 'w-full bg-sun-400 text-ink-900 hover:bg-sun-500')} disabled={pending} onClick={() => act('reveal')}>
                  {mn.live.reveal}
                </button>
              </>
            ) : (
              <>
                {state.distribution ? (
                  <div className="rounded-3xl border-[3px] border-ink-900 bg-white p-5 shadow-brut">
                    <AnswerBars question={q} distribution={state.distribution} />
                  </div>
                ) : null}
                {state.top?.length ? (
                  <div className="space-y-3">
                    <h2 className="text-xl font-extrabold text-ink-900">🏆 {mn.live.top}</h2>
                    <Leaderboard rows={state.top} />
                  </div>
                ) : null}
                <button type="button" className={cn(BIG_BUTTON, 'w-full bg-brand-500 text-white hover:bg-brand-600')} disabled={pending} onClick={() => act('next')}>
                  {last ? mn.live.showResults : mn.live.next} ▶
                </button>
              </>
            )}
          </aside>
        </section>
      ) : null}

      {state.state === 'finished' ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <Confetti />
          <h2 className="text-4xl font-extrabold text-ink-900 sm:text-5xl">🎉 {mn.live.podium}</h2>
          {state.top?.length ? <Podium rows={state.top} /> : <p className="text-xl font-bold text-slate-600">{mn.live.finished}</p>}
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={`/t/quizzes/results/${state.assignment_id}`} className={buttonClass('primary', 'lg')}>
              {mn.live.openResults}
            </Link>
            <Link href="/t/quizzes" className={buttonClass('secondary', 'lg')}>
              {mn.live.backToQuiz}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
