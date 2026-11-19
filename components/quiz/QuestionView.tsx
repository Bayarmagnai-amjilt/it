'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/components/ui';
import { isQuizImageUrl } from '@/lib/constants';
import type { AnswerKey, PublicQuestion, Response, TextItem } from '@/lib/quiz/types';
import { mn } from '@/locales/mn';
import { optionColor, optionLetter } from './theme';

export interface Reveal {
  key: AnswerKey;
  response?: Response | null;
}

/**
 * One question, ready to answer. `onSubmit` missing = read-only (the projector);
 * `reveal` = the question is over: show the right answer next to the student's.
 * Give it key={question.id} so a new question starts with a clean slate.
 */
export function QuestionView({
  question,
  onSubmit,
  disabled = false,
  reveal = null,
  big = false,
}: {
  question: PublicQuestion;
  onSubmit?: (response: Response) => void;
  disabled?: boolean;
  reveal?: Reveal | null;
  big?: boolean;
}) {
  const locked = disabled || !onSubmit || Boolean(reveal);
  const submit = (r: Response) => {
    if (!locked) onSubmit?.(r);
  };
  return (
    <div className="space-y-5">
      <Prompt question={question} big={big} />
      {question.type === 'single_choice' || question.type === 'multi_choice' ? (
        <Choices question={question} locked={locked} reveal={reveal} big={big} onSubmit={submit} />
      ) : question.type === 'true_false' ? (
        <TrueFalse locked={locked} reveal={reveal} big={big} onSubmit={submit} />
      ) : question.type === 'short_answer' ? (
        <ShortAnswer locked={locked} reveal={reveal} big={big} onSubmit={submit} />
      ) : question.type === 'ordering' ? (
        <Ordering items={question.content.items ?? []} locked={locked} reveal={reveal} onSubmit={submit} />
      ) : (
        <Matching question={question} locked={locked} reveal={reveal} onSubmit={submit} />
      )}
      {reveal && question.explanation ? (
        <p className="rounded-2xl border-2 border-dashed border-ink-300 bg-sun-50 px-4 py-3 font-semibold text-ink-800">
          <span aria-hidden="true">💡 </span>
          {question.explanation}
        </p>
      ) : null}
    </div>
  );
}

function Prompt({ question, big }: { question: PublicQuestion; big: boolean }) {
  const image = question.prompt?.image;
  return (
    <div className="space-y-4">
      {question.prompt?.text ? (
        <h2 className={cn('font-extrabold leading-snug text-ink-900', big ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl')}>
          {question.prompt.text}
        </h2>
      ) : null}
      {isQuizImageUrl(image) ? (
        // eslint-disable-next-line @next/next/no-img-element -- a Storage picture the teacher uploaded
        <img
          src={image}
          alt=""
          className={cn('mx-auto rounded-2xl border-[3px] border-ink-900 bg-white object-contain', big ? 'max-h-[40vh]' : 'max-h-72')}
        />
      ) : null}
    </div>
  );
}

const SUBMIT_BUTTON =
  'press min-h-14 rounded-2xl border-[3px] border-ink-900 bg-brand-500 px-8 font-heading text-xl font-bold text-white shadow-brut-sm hover:bg-brand-600 disabled:opacity-50';

function Mark({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink-900 text-lg font-black',
        ok ? 'bg-mint-200 text-ink-900' : 'bg-blush-200 text-ink-900',
      )}
      aria-label={ok ? mn.quiz.correct : mn.live.wrong}
    >
      {ok ? '✓' : '✗'}
    </span>
  );
}

function Choices({
  question,
  locked,
  reveal,
  big,
  onSubmit,
}: {
  question: PublicQuestion;
  locked: boolean;
  reveal: Reveal | null;
  big: boolean;
  onSubmit: (r: Response) => void;
}) {
  const multi = question.type === 'multi_choice';
  const [picked, setPicked] = useState<string[]>([]);
  const options = question.content.options ?? [];
  const right = reveal ? (Array.isArray(reveal.key.correct) ? reveal.key.correct : [reveal.key.correct]) : [];
  const mine = reveal?.response
    ? 'choice' in reveal.response
      ? [reveal.response.choice]
      : 'choices' in reveal.response
        ? reveal.response.choices
        : []
    : picked;

  return (
    <div className="space-y-4">
      {multi && !reveal ? <p className="font-bold text-slate-600">{mn.play.pickAll}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o, i) => {
          const chosen = mine.includes(o.id);
          const isRight = right.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              disabled={locked}
              aria-pressed={chosen}
              onClick={() => {
                if (multi) setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]));
                else onSubmit({ choice: o.id });
              }}
              className={cn(
                'press flex items-center gap-3 rounded-2xl border-[3px] border-ink-900 bg-white p-3 text-left font-bold text-ink-900 shadow-brut-sm',
                big ? 'min-h-24 text-2xl sm:text-3xl' : 'min-h-16 text-xl',
                !locked && 'hover:bg-sun-50',
                chosen && !reveal && 'bg-sun-100 ring-4 ring-brand-300',
                reveal && isRight && 'bg-mint-100',
                reveal && chosen && !isRight && 'bg-blush-100',
                reveal && !isRight && !chosen && 'opacity-60',
              )}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 font-heading text-xl text-white"
                style={{ backgroundColor: optionColor(i) }}
                aria-hidden="true"
              >
                {optionLetter(i)}
              </span>
              <span className="min-w-0 break-words">{o.text}</span>
              {reveal && (isRight || chosen) ? <Mark ok={isRight} /> : null}
            </button>
          );
        })}
      </div>
      {multi && !locked ? (
        <button type="button" className={SUBMIT_BUTTON} disabled={picked.length === 0} onClick={() => onSubmit({ choices: picked })}>
          {mn.play.submit}
        </button>
      ) : null}
    </div>
  );
}

function TrueFalse({
  locked,
  reveal,
  big,
  onSubmit,
}: {
  locked: boolean;
  reveal: Reveal | null;
  big: boolean;
  onSubmit: (r: Response) => void;
}) {
  const mine = reveal?.response && 'value' in reveal.response ? reveal.response.value : null;
  return (
    <div className="grid grid-cols-2 gap-4">
      {[true, false].map((value) => {
        const isRight = reveal ? reveal.key.correct === value : false;
        const chosen = mine === value;
        return (
          <button
            key={String(value)}
            type="button"
            disabled={locked}
            onClick={() => onSubmit({ value })}
            className={cn(
              'press flex items-center justify-center gap-3 rounded-2xl border-[3px] border-ink-900 font-heading font-bold text-white shadow-brut',
              big ? 'min-h-32 text-4xl' : 'min-h-24 text-3xl',
              value ? 'bg-mint-500' : 'bg-blush-400',
              reveal && !isRight && !chosen && 'opacity-50',
            )}
          >
            <span aria-hidden="true">{value ? '👍' : '👎'}</span>
            {value ? mn.quiz.trueLabel : mn.quiz.falseLabel}
            {reveal && (isRight || chosen) ? <Mark ok={isRight} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function ShortAnswer({
  locked,
  reveal,
  big,
  onSubmit,
}: {
  locked: boolean;
  reveal: Reveal | null;
  big: boolean;
  onSubmit: (r: Response) => void;
}) {
  const [text, setText] = useState('');
  if (reveal) {
    const mine = reveal.response && 'text' in reveal.response ? reveal.response.text : '';
    return (
      <div className={cn('space-y-2 font-bold', big ? 'text-3xl' : 'text-xl')}>
        <p className="text-ink-900">
          <span className="text-slate-500">{mn.play.correctAnswer} </span>
          {(reveal.key.accepted ?? []).join(' / ')}
        </p>
        {mine ? (
          <p className="text-ink-900">
            <span className="text-slate-500">{mn.play.yourAnswer} </span>
            {mine}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSubmit({ text: text.trim() });
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={locked}
        maxLength={200}
        placeholder={mn.play.typeAnswer}
        autoComplete="off"
        className="min-h-14 flex-1 rounded-2xl border-[3px] border-ink-900 bg-white px-4 text-2xl font-bold text-ink-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-200"
      />
      {!locked ? (
        <button type="submit" className={SUBMIT_BUTTON} disabled={!text.trim()}>
          {mn.play.submit}
        </button>
      ) : null}
    </form>
  );
}

/** Drag a row (mouse or finger) or use the arrows to put the steps in order. */
function Ordering({
  items,
  locked,
  reveal,
  onSubmit,
}: {
  items: TextItem[];
  locked: boolean;
  reveal: Reveal | null;
  onSubmit: (r: Response) => void;
}) {
  const [order, setOrder] = useState<TextItem[]>(items);
  const drag = useRef<{ index: number; startY: number; step: number } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  if (reveal) {
    const text = new Map(items.map((t) => [t.id, t.text]));
    const mine = reveal.response && 'order' in reveal.response ? reveal.response.order : [];
    return (
      <ol className="space-y-2">
        {(reveal.key.order ?? []).map((id, i) => (
          <li key={id} className="flex items-center gap-3 rounded-2xl border-[3px] border-ink-900 bg-mint-100 p-3 text-xl font-bold text-ink-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink-900 bg-white font-heading">{i + 1}</span>
            {text.get(id)}
            {mine.length ? <Mark ok={mine[i] === id} /> : null}
          </li>
        ))}
      </ol>
    );
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((list) => {
      const next = [...list];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  };
  const onDown = (e: ReactPointerEvent<HTMLElement>, index: number) => {
    if (locked) return;
    const row = e.currentTarget.closest('li');
    const step = (row?.getBoundingClientRect().height ?? 60) + 8;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { index, startY: e.clientY, step };
    setDragging(index);
  };
  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const shift = Math.round((e.clientY - d.startY) / d.step);
    const to = Math.max(0, Math.min(order.length - 1, d.index + shift));
    if (to !== d.index) {
      move(d.index, to);
      drag.current = { ...d, index: to, startY: d.startY + (to - d.index) * d.step };
      setDragging(to);
    }
  };
  const onUp = () => {
    drag.current = null;
    setDragging(null);
  };

  return (
    <div className="space-y-4">
      <p className="font-bold text-slate-600">{mn.play.dragHint}</p>
      <ol className="space-y-2">
        {order.map((t, i) => (
          <li
            key={t.id}
            className={cn(
              'flex items-center gap-3 rounded-2xl border-[3px] border-ink-900 bg-white p-2 pr-3 text-xl font-bold text-ink-900 shadow-brut-sm',
              dragging === i && 'bg-sun-100 ring-4 ring-brand-300',
            )}
          >
            <span
              onPointerDown={(e) => onDown(e, i)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className={cn('flex h-11 w-11 shrink-0 touch-none select-none items-center justify-center rounded-xl border-2 border-ink-900 bg-ink-50 font-heading text-lg', !locked && 'cursor-grab')}
              aria-hidden="true"
            >
              ⠿
            </span>
            <span className="min-w-0 flex-1 break-words">{t.text}</span>
            <span className="flex gap-1">
              <button type="button" disabled={locked || i === 0} onClick={() => move(i, i - 1)} className="press h-10 w-10 rounded-xl border-2 border-ink-900 bg-white disabled:opacity-30" aria-label={mn.quiz.moveUp}>
                ↑
              </button>
              <button
                type="button"
                disabled={locked || i === order.length - 1}
                onClick={() => move(i, i + 1)}
                className="press h-10 w-10 rounded-xl border-2 border-ink-900 bg-white disabled:opacity-30"
                aria-label={mn.quiz.moveDown}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      {!locked ? (
        <button type="button" className={SUBMIT_BUTTON} onClick={() => onSubmit({ order: order.map((t) => t.id) })}>
          {mn.play.submit}
        </button>
      ) : null}
    </div>
  );
}

/** Tap a left item, then the right item that goes with it. */
function Matching({
  question,
  locked,
  reveal,
  onSubmit,
}: {
  question: PublicQuestion;
  locked: boolean;
  reveal: Reveal | null;
  onSubmit: (r: Response) => void;
}) {
  const left = question.content.left ?? [];
  const right = question.content.right ?? [];
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);

  if (reveal) {
    const text = new Map(right.map((t) => [t.id, t.text]));
    const mine = reveal.response && 'pairs' in reveal.response ? reveal.response.pairs : {};
    return (
      <ul className="space-y-2">
        {left.map((l) => {
          const id = reveal.key.pairs?.[l.id] ?? '';
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-[3px] border-ink-900 bg-mint-100 p-3 text-xl font-bold text-ink-900">
              <span>{l.text}</span>
              <span aria-hidden="true">→</span>
              <span>{text.get(id)}</span>
              {Object.keys(mine).length ? <Mark ok={mine[l.id] === id} /> : null}
            </li>
          );
        })}
      </ul>
    );
  }

  const number = (leftId: string) => left.findIndex((l) => l.id === leftId);
  const pairedLeft = (rightId: string) => Object.keys(pairs).find((k) => pairs[k] === rightId);
  const pickRight = (rightId: string) => {
    if (locked || !active) return;
    setPairs((p) => {
      const next = { ...p };
      for (const k of Object.keys(next)) if (next[k] === rightId) delete next[k];
      next[active] = rightId;
      return next;
    });
    setActive(null);
  };
  const tile = 'press flex min-h-16 w-full items-center gap-3 rounded-2xl border-[3px] border-ink-900 bg-white p-3 text-left text-xl font-bold text-ink-900 shadow-brut-sm';
  const badge = (i: number) => (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink-900 font-heading text-white"
      style={{ backgroundColor: optionColor(i) }}
    >
      {i + 1}
    </span>
  );

  return (
    <div className="space-y-4">
      <p className="font-bold text-slate-600">{mn.play.matchHint}</p>
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        <div className="space-y-2">
          {left.map((l, i) => (
            <button
              key={l.id}
              type="button"
              disabled={locked}
              onClick={() => setActive(active === l.id ? null : l.id)}
              className={cn(tile, active === l.id && 'bg-sun-100 ring-4 ring-brand-300')}
            >
              {pairs[l.id] ? badge(i) : <span className="h-9 w-9 shrink-0 rounded-full border-2 border-dashed border-ink-300" />}
              <span className="min-w-0 break-words">{l.text}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {right.map((r) => {
            const owner = pairedLeft(r.id);
            return (
              <button key={r.id} type="button" disabled={locked} onClick={() => pickRight(r.id)} className={cn(tile, active && !locked && 'hover:bg-sun-50')}>
                {owner ? badge(number(owner)) : <span className="h-9 w-9 shrink-0 rounded-full border-2 border-dashed border-ink-300" />}
                <span className="min-w-0 break-words">{r.text}</span>
              </button>
            );
          })}
        </div>
      </div>
      {!locked ? (
        <button type="button" className={SUBMIT_BUTTON} disabled={Object.keys(pairs).length < left.length} onClick={() => onSubmit({ pairs })}>
          {mn.play.submit}
        </button>
      ) : null}
    </div>
  );
}
