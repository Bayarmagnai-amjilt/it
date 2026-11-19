'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Confetti } from '@/components/Confetti';
import { Mascot } from '@/components/Mascot';
import { buttonClass, cn } from '@/components/ui';
import { answerLive, joinLive } from '@/features/quizzes/student';
import { fill } from '@/lib/errors';
import type { LiveStudentState, Response } from '@/lib/quiz/types';
import { uuid } from '@/lib/uuid';
import { mn } from '@/locales/mn';
import { Leaderboard, Podium } from './LiveCharts';
import { QuestionView } from './QuestionView';
import { Timer } from './Timer';

const PANEL = 'rounded-3xl border-[3px] border-ink-900 bg-white p-6 shadow-brut sm:p-8';

/** A student's screen during a live game. Joins, then follows the server's state. */
export function LivePlayer({ liveId, studentId }: { liveId: string; studentId: string }) {
  const [state, setState] = useState<LiveStudentState | null>(null);
  const [offline, setOffline] = useState(false);
  const [sentFor, setSentFor] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/s/live/${liveId}/state`, { cache: 'no-store' });
      const data = (await res.json()) as LiveStudentState;
      setState(data);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [liveId]);

  useEffect(() => {
    void joinLive(liveId).then(refresh);
  }, [liveId, refresh]);

  const phase = state?.state;
  const ok = state?.ok;
  useEffect(() => {
    if (phase === 'finished' || ok === false) return;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh, phase, ok]);

  const answer = async (response: Response) => {
    if (!state?.position) return;
    setSentFor(state.position);
    await answerLive(liveId, response, uuid());
    await refresh();
  };

  if (!state) {
    return <p className="text-center text-2xl font-bold text-slate-600">{mn.common.loading}</p>;
  }
  if (!state.ok) {
    return (
      <div className={cn(PANEL, 'space-y-4 text-center')}>
        <p className="text-2xl font-extrabold text-ink-900">{mn.live.notFound}</p>
        <Link href="/s/home" className={buttonClass('primary', 'lg')}>
          {mn.common.home}
        </Link>
      </div>
    );
  }

  const q = state.question;
  const answered = state.answered || sentFor === state.position;
  return (
    <div className="space-y-6">
      {offline ? <p className="rounded-xl border-2 border-ink-900 bg-blush-100 px-4 py-2 font-bold text-ink-900">{mn.live.connection}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-ink-900">{state.title}</h1>
        {state.position && state.state !== 'finished' ? (
          <span className="rounded-xl border-[3px] border-ink-900 bg-white px-4 py-1 font-heading text-xl font-bold text-ink-900">
            {fill(mn.live.questionOf, { n: state.position, total: state.total })}
          </span>
        ) : null}
      </div>

      {state.state === 'lobby' ? (
        <div className={cn(PANEL, 'flex flex-col items-center gap-4 text-center')}>
          <Mascot className="bob h-28 w-28" />
          <p className="text-3xl font-extrabold text-ink-900">{mn.live.yourNameOnScreen}</p>
          <p className="text-xl font-bold text-slate-600">{mn.live.waitStart}</p>
          <p className="font-heading text-lg font-bold text-slate-500">{fill(mn.live.joined, { n: state.players })}</p>
        </div>
      ) : null}

      {state.state === 'question' && q ? (
        answered ? (
          <div className={cn(PANEL, 'flex flex-col items-center gap-4 text-center')}>
            <span className="text-7xl" aria-hidden="true">📨</span>
            <p className="text-3xl font-extrabold text-ink-900">{mn.live.sent}</p>
            <p className="text-xl font-bold text-slate-600">{mn.live.waitReveal}</p>
          </div>
        ) : timeUp === state.position ? (
          <div className={cn(PANEL, 'text-center text-2xl font-extrabold text-ink-900')}>⏰ {mn.live.timeUp}</div>
        ) : (
          <div className={cn(PANEL, 'space-y-5')}>
            {q.time_limit ? (
              <Timer key={state.position} remainingMs={state.remaining_ms ?? 0} limitSec={q.time_limit} onEnd={() => setTimeUp(state.position)} />
            ) : null}
            <QuestionView key={q.id} question={q} onSubmit={answer} />
          </div>
        )
      ) : null}

      {state.state === 'reveal' && q ? (
        <div className="space-y-5">
          <div
            className={cn(
              PANEL,
              'flex flex-wrap items-center justify-between gap-4',
              state.my_correct === true ? 'bg-mint-100' : state.my_correct === false ? 'bg-blush-100' : 'bg-ink-50',
            )}
          >
            <p className="text-4xl font-extrabold text-ink-900">
              {state.my_correct === true ? `🎉 ${mn.live.right}` : state.my_correct === false ? `😕 ${mn.live.wrong}` : mn.live.noAnswer}
            </p>
            <div className="text-right">
              {state.my_points ? <p className="font-heading text-3xl font-bold text-ink-900">{fill(mn.live.gotPoints, { n: state.my_points })}</p> : null}
              <p className="text-lg font-bold text-slate-600">
                {fill(mn.live.yourScore, { n: state.score })}
                {state.rank ? ` · ${fill(mn.live.yourRank, { rank: state.rank })}` : ''}
              </p>
            </div>
          </div>
          <div className={PANEL}>
            <QuestionView
              key={`${q.id}-reveal`}
              question={q}
              reveal={q.answer_key ? { key: q.answer_key, response: state.my_response } : null}
            />
          </div>
        </div>
      ) : null}

      {state.state === 'finished' ? (
        <div className="space-y-8 text-center">
          {state.rank && state.rank <= 3 ? <Confetti /> : null}
          <div className={cn(PANEL, 'space-y-2')}>
            <p className="text-3xl font-extrabold text-ink-900">{mn.live.over}</p>
            <p className="font-heading text-2xl font-bold text-ink-900">{fill(mn.live.yourScore, { n: state.score })}</p>
            {state.rank ? (
              <p className="text-xl font-bold text-slate-600">
                {fill(mn.live.yourRank, { rank: state.rank })} · {fill(mn.live.rankOf, { n: state.players })}
              </p>
            ) : null}
          </div>
          {state.top?.length ? <Podium rows={state.top} /> : null}
          {state.top && state.top.length > 3 ? (
            <div className="mx-auto max-w-xl text-left">
              <Leaderboard rows={state.top} highlight={studentId} />
            </div>
          ) : null}
          <Link href="/s/home" className={buttonClass('primary', 'lg')}>
            {mn.common.home}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
