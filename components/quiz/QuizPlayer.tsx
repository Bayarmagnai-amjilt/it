'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Confetti } from '@/components/Confetti';
import { buttonClass, cn } from '@/components/ui';
import { nextQuestion, startAttempt, submitAnswer } from '@/features/quizzes/student';
import { fill } from '@/lib/errors';
import type { AnswerResult, AttemptStep, Response } from '@/lib/quiz/types';
import { uuid } from '@/lib/uuid';
import { mn } from '@/locales/mn';
import { QuestionView } from './QuestionView';
import { Timer } from './Timer';

const PANEL = 'rounded-3xl border-[3px] border-ink-900 bg-white p-6 shadow-brut sm:p-8';
const errorText = (code: string) => (mn.play.errors as Record<string, string>)[code] ?? mn.play.errors.generic;

type Shown = Extract<AttemptStep, { done: false }>;
type Done = Extract<AttemptStep, { done: true }>;

/** A quiz the student takes at their own pace: one question at a time. */
export function QuizPlayer({ assignmentId }: { assignmentId: string }) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [step, setStep] = useState<Shown | Done | null>(null);
  const [feedback, setFeedback] = useState<{ result: AnswerResult; response: Response } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const answering = useRef(false);

  const load = useCallback(async (id: string) => {
    const next = await nextQuestion(id);
    if (!next.ok) {
      setError(errorText(next.error));
      return;
    }
    setFeedback(null);
    setStep(next);
  }, []);

  const begin = useCallback(async () => {
    setBusy(true);
    setError(null);
    const started = await startAttempt(assignmentId);
    if (!started.ok) setError(errorText(started.error));
    else {
      setAttemptId(started.attempt_id);
      await load(started.attempt_id);
    }
    setBusy(false);
  }, [assignmentId, load]);

  useEffect(() => {
    void begin();
  }, [begin]);

  const answer = async (response: Response) => {
    if (!attemptId || !step || step.done || answering.current) return;
    answering.current = true;
    setBusy(true);
    const result = await submitAnswer(attemptId, step.question.id, response, uuid());
    setBusy(false);
    answering.current = false;
    if (!result.ok) {
      if (result.error === 'stale') await load(attemptId);
      else setError(errorText(result.error ?? 'generic'));
      return;
    }
    // with the answer shown after each question the student reads it first;
    // otherwise the next question comes straight away
    if (result.answer_key) setFeedback({ result, response });
    else await load(attemptId);
  };

  if (error) {
    return (
      <div className={cn(PANEL, 'space-y-4 text-center')}>
        <p className="text-2xl font-extrabold text-ink-900">{error}</p>
        <Link href="/s/home" className={buttonClass('primary', 'lg')}>
          {mn.common.home}
        </Link>
      </div>
    );
  }
  if (!step) return <p className="text-center text-2xl font-bold text-slate-600">{mn.common.loading}</p>;

  if (step.done) {
    const perfect = step.max_score > 0 && Number(step.score) >= Number(step.max_score);
    return (
      <div className="space-y-6">
        {perfect ? <Confetti /> : null}
        <div className={cn(PANEL, 'space-y-3 text-center')}>
          <p className="text-4xl font-extrabold text-ink-900">🎉 {mn.play.done}</p>
          <p className="font-heading text-3xl font-bold text-ink-900">
            {fill(mn.play.scoreLine, { score: Number(step.score), max: Number(step.max_score) })}
          </p>
          <p className="text-xl font-bold text-slate-600">{fill(mn.play.correctLine, { n: step.correct, total: step.total })}</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/s/home" className={buttonClass('primary', 'lg')}>
              {mn.common.home}
            </Link>
            <button
              type="button"
              className={buttonClass('secondary', 'lg')}
              disabled={busy}
              onClick={() => {
                setStep(null);
                void begin();
              }}
            >
              {mn.play.again}
            </button>
          </div>
        </div>
        {step.review?.length ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-extrabold text-ink-900">{mn.play.review}</h2>
            {step.review.map((r) => (
              <div key={r.question.id} className={cn(PANEL, r.correct ? 'bg-mint-100/40' : 'bg-blush-100/40')}>
                <QuestionView question={r.question} reveal={r.question.answer_key ? { key: r.question.answer_key, response: r.response } : null} />
              </div>
            ))}
          </section>
        ) : null}
      </div>
    );
  }

  const q = step.question;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-ink-900">{step.title}</h1>
        <span className="rounded-xl border-[3px] border-ink-900 bg-white px-4 py-1 font-heading text-xl font-bold text-ink-900">
          {fill(mn.play.question, { n: step.index, total: step.total })}
        </span>
      </div>
      <div className={cn(PANEL, 'space-y-5')}>
        {feedback ? (
          <>
            <p className={cn('text-3xl font-extrabold text-ink-900')}>
              {feedback.result.correct ? `🎉 ${mn.live.right}` : `😕 ${mn.live.wrong}`}
            </p>
            {feedback.result.late ? <p className="font-bold text-slate-600">{mn.play.late}</p> : null}
            <QuestionView
              key={`${q.id}-fb`}
              question={{ ...q, explanation: feedback.result.explanation ?? null }}
              reveal={feedback.result.answer_key ? { key: feedback.result.answer_key, response: feedback.response } : null}
            />
            <button type="button" className={buttonClass('primary', 'lg')} onClick={() => attemptId && void load(attemptId)}>
              {mn.play.next} ▶
            </button>
          </>
        ) : (
          <>
            {q.time_limit && step.remaining_ms !== null ? (
              <Timer key={q.id} remainingMs={step.remaining_ms} limitSec={q.time_limit} onEnd={() => void answer({ text: '' })} />
            ) : null}
            <QuestionView key={q.id} question={q} onSubmit={answer} disabled={busy} />
          </>
        )}
      </div>
    </div>
  );
}
