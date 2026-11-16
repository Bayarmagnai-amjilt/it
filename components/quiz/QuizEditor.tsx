'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ChangeEvent, type ReactNode } from 'react';
import { Alert, Button, buttonClass, cn, Field, fieldClass, Input, Select } from '@/components/ui';
import { saveQuiz, uploadQuizImage } from '@/features/quizzes/actions';
import { isQuizImageUrl, QUIZ_IMAGE_PIXELS } from '@/lib/constants';
import { fill } from '@/lib/errors';
import { changeType, emptyQuestion, MAX_OPTIONS, MAX_QUESTIONS, randomId, TIME_LIMITS, type DraftQuestion, type QuizDraft } from '@/lib/quiz/draft';
import { QUESTION_TYPES, type QuestionType } from '@/lib/quiz/types';
import { shrinkImage } from '@/lib/shrink-image';
import { mn } from '@/locales/mn';
import { optionColor, optionLetter } from './theme';

const SMALL_ICON_BUTTON = 'press flex h-9 w-9 items-center justify-center rounded-lg border-2 border-ink-900 bg-white text-sm font-bold disabled:opacity-30';

/** Write or change a quiz: its title and up to 60 questions of six kinds. */
export function QuizEditor({ initial, answered = false }: { initial: QuizDraft; answered?: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuizDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [newType, setNewType] = useState<QuestionType>('single_choice');

  const setQuestion = (index: number, change: (q: DraftQuestion) => DraftQuestion) =>
    setDraft((d) => ({ ...d, questions: d.questions.map((q, i) => (i === index ? change(q) : q)) }));
  const moveQuestion = (from: number, to: number) =>
    setDraft((d) => {
      if (to < 0 || to >= d.questions.length) return d;
      const list = [...d.questions];
      const [q] = list.splice(from, 1);
      list.splice(to, 0, q);
      return { ...d, questions: list };
    });

  const save = () =>
    startSaving(async () => {
      const result = await saveQuiz(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      router.push(`/t/quizzes/${result.id}?ok=saved`);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {answered ? <Alert tone="warning">{mn.quiz.editWarning}</Alert> : null}
      <section className="grid gap-4 rounded-2xl border-[3px] border-ink-900 bg-white p-5 shadow-brut sm:grid-cols-[1fr_10rem]">
        <Field label={mn.quiz.title}>
          <Input value={draft.title} maxLength={120} placeholder={mn.quiz.titlePlaceholder} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <Field label={mn.quiz.grade}>
          <Select value={draft.grade ?? ''} onChange={(e) => setDraft({ ...draft, grade: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{mn.quiz.anyGrade}</option>
            {[1, 2, 3, 4, 5].map((g) => (
              <option key={g} value={g}>
                {fill(mn.quiz.gradeOption, { grade: g })}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={mn.quiz.description}>
            <Input value={draft.description} maxLength={500} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
        </div>
      </section>

      <ol className="space-y-5">
        {draft.questions.map((q, i) => (
          <li key={q.key}>
            <QuestionCard
              q={q}
              index={i}
              count={draft.questions.length}
              onChange={(change) => setQuestion(i, change)}
              onMove={(to) => moveQuestion(i, to)}
              onDuplicate={() =>
                setDraft((d) => {
                  const copy = structuredClone(d.questions[i]);
                  copy.key = randomId();
                  delete copy.id;
                  copy.options = copy.options.map((o) => ({ ...o, id: randomId() }));
                  copy.items = copy.items.map((t) => ({ ...t, id: randomId() }));
                  copy.pairs = copy.pairs.map((p) => ({ ...p, leftId: randomId(), rightId: randomId() }));
                  const list = [...d.questions];
                  list.splice(i + 1, 0, copy);
                  return { ...d, questions: list.slice(0, MAX_QUESTIONS) };
                })
              }
              onRemove={() => setDraft((d) => ({ ...d, questions: d.questions.filter((_, j) => j !== i) }))}
            />
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border-[3px] border-dashed border-ink-300 p-4">
        <Field label={mn.quiz.type}>
          <Select value={newType} onChange={(e) => setNewType(e.target.value as QuestionType)}>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {mn.quiz.types[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          type="button"
          variant="secondary"
          disabled={draft.questions.length >= MAX_QUESTIONS}
          onClick={() => setDraft((d) => ({ ...d, questions: [...d.questions, emptyQuestion(newType)] }))}
        >
          + {mn.quiz.addQuestion}
        </Button>
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t-[3px] border-ink-900 bg-ink-50/95 px-1 py-3 backdrop-blur">
        <Button type="button" size="lg" disabled={saving} onClick={save}>
          {saving ? mn.quiz.saving : mn.quiz.saveQuiz}
        </Button>
        {error ? <p className="font-bold text-red-700" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  index,
  count,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  q: DraftQuestion;
  index: number;
  count: number;
  onChange: (change: (q: DraftQuestion) => DraftQuestion) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<DraftQuestion>) => onChange((x) => ({ ...x, ...patch }));
  return (
    <section className="space-y-4 rounded-2xl border-[3px] border-ink-900 bg-white p-5 shadow-brut">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-lg font-extrabold text-ink-900">{fill(mn.quiz.questionN, { n: index + 1 })}</h3>
        <button type="button" className={SMALL_ICON_BUTTON} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={mn.quiz.moveUp}>
          ↑
        </button>
        <button type="button" className={SMALL_ICON_BUTTON} disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={mn.quiz.moveDown}>
          ↓
        </button>
        <button type="button" className={buttonClass('ghost', 'sm')} onClick={onDuplicate}>
          {mn.quiz.duplicate}
        </button>
        <button type="button" className={buttonClass('danger', 'sm')} disabled={count === 1} onClick={onRemove}>
          {mn.quiz.removeQuestion}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_6rem]">
        <Field label={mn.quiz.type}>
          <Select value={q.type} onChange={(e) => onChange((x) => changeType(x, e.target.value as QuestionType))}>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {mn.quiz.types[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={mn.quiz.timeLimit}>
          <Select value={q.timeLimit ?? ''} onChange={(e) => set({ timeLimit: e.target.value ? Number(e.target.value) : null })}>
            {TIME_LIMITS.map((t) => (
              <option key={t ?? 'none'} value={t ?? ''}>
                {t === null ? mn.quiz.noLimit : fill(mn.quiz.seconds, { n: t })}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={mn.quiz.points}>
          <Input type="number" min={0} max={100} value={q.points} onChange={(e) => set({ points: Number(e.target.value) })} />
        </Field>
      </div>

      <Field label={mn.quiz.questionText}>
        <textarea
          value={q.text}
          maxLength={500}
          rows={2}
          placeholder={mn.quiz.questionPlaceholder}
          onChange={(e) => set({ text: e.target.value })}
          className={fieldClass('w-full py-2')}
        />
      </Field>
      <ImageInput value={q.image} onChange={(image) => set({ image })} />

      <p className="text-sm font-semibold text-slate-500">{mn.quiz.typeHints[q.type]}</p>
      {q.type === 'single_choice' || q.type === 'multi_choice' ? <OptionsEditor q={q} onChange={onChange} /> : null}
      {q.type === 'true_false' ? (
        <div className="flex gap-3">
          {[true, false].map((v) => (
            <label key={String(v)} className={cn('press flex cursor-pointer items-center gap-2 rounded-xl border-2 border-ink-900 px-4 py-2 font-bold', q.truth === v ? 'bg-mint-200' : 'bg-white')}>
              <input type="radio" checked={q.truth === v} onChange={() => set({ truth: v })} />
              {v ? mn.quiz.trueLabel : mn.quiz.falseLabel}
            </label>
          ))}
        </div>
      ) : null}
      {q.type === 'short_answer' ? (
        <ListEditor
          values={q.accepted}
          label={() => mn.quiz.accepted}
          addLabel={mn.quiz.addAccepted}
          onChange={(accepted) => set({ accepted })}
          min={1}
        />
      ) : null}
      {q.type === 'ordering' ? (
        <ListEditor
          values={q.items.map((t) => t.text)}
          label={(i) => fill(mn.quiz.item, { n: i + 1 })}
          addLabel={mn.quiz.addItem}
          min={2}
          numbered
          onChange={(texts) =>
            set({ items: texts.map((text, i) => ({ id: q.items[i]?.id ?? randomId(), text })) })
          }
          onMove={(from, to) => {
            const items = [...q.items];
            const [x] = items.splice(from, 1);
            items.splice(to, 0, x);
            set({ items });
          }}
        />
      ) : null}
      {q.type === 'matching' ? <PairsEditor q={q} onChange={onChange} /> : null}

      <Field label={mn.quiz.explanation}>
        <Input value={q.explanation} maxLength={1000} onChange={(e) => set({ explanation: e.target.value })} />
      </Field>
    </section>
  );
}

function OptionsEditor({ q, onChange }: { q: DraftQuestion; onChange: (change: (q: DraftQuestion) => DraftQuestion) => void }) {
  const single = q.type === 'single_choice';
  const setOptions = (options: DraftQuestion['options']) => onChange((x) => ({ ...x, options }));
  return (
    <div className="space-y-2">
      {q.options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-ink-900 font-heading text-white"
            style={{ backgroundColor: optionColor(i) }}
            aria-hidden="true"
          >
            {optionLetter(i)}
          </span>
          <Input
            value={o.text}
            maxLength={200}
            placeholder={fill(mn.quiz.option, { n: i + 1 })}
            className="flex-1"
            onChange={(e) => setOptions(q.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
          />
          <label className={cn('press flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-2 border-ink-900 px-2 py-1.5 text-sm font-bold', o.correct ? 'bg-mint-200' : 'bg-white')}>
            <input
              type={single ? 'radio' : 'checkbox'}
              checked={o.correct}
              onChange={() =>
                setOptions(q.options.map((x, j) => (single ? { ...x, correct: j === i } : j === i ? { ...x, correct: !x.correct } : x)))
              }
            />
            {mn.quiz.correct}
          </label>
          <button type="button" className={SMALL_ICON_BUTTON} disabled={q.options.length <= 2} onClick={() => setOptions(q.options.filter((_, j) => j !== i))} aria-label={mn.quiz.remove}>
            ✕
          </button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={q.options.length >= MAX_OPTIONS}
        onClick={() => setOptions([...q.options, { id: randomId(), text: '', correct: false }])}
      >
        + {mn.quiz.addOption}
      </Button>
    </div>
  );
}

function ListEditor({
  values,
  label,
  addLabel,
  onChange,
  onMove,
  min,
  numbered = false,
}: {
  values: string[];
  label: (i: number) => string;
  addLabel: string;
  onChange: (values: string[]) => void;
  onMove?: (from: number, to: number) => void;
  min: number;
  numbered?: boolean;
}) {
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          {numbered ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink-900 bg-ink-50 font-heading">{i + 1}</span>
          ) : null}
          <Input value={v} maxLength={200} placeholder={label(i)} className="flex-1" onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
          {onMove ? (
            <>
              <button type="button" className={SMALL_ICON_BUTTON} disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label={mn.quiz.moveUp}>
                ↑
              </button>
              <button type="button" className={SMALL_ICON_BUTTON} disabled={i === values.length - 1} onClick={() => onMove(i, i + 1)} aria-label={mn.quiz.moveDown}>
                ↓
              </button>
            </>
          ) : null}
          <button type="button" className={SMALL_ICON_BUTTON} disabled={values.length <= min} onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label={mn.quiz.remove}>
            ✕
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" disabled={values.length >= 10} onClick={() => onChange([...values, ''])}>
        + {addLabel}
      </Button>
    </div>
  );
}

function PairsEditor({ q, onChange }: { q: DraftQuestion; onChange: (change: (q: DraftQuestion) => DraftQuestion) => void }) {
  const setPairs = (pairs: DraftQuestion['pairs']) => onChange((x) => ({ ...x, pairs }));
  return (
    <div className="space-y-2">
      {q.pairs.map((p, i) => (
        <div key={p.leftId} className="flex items-center gap-2">
          <Input value={p.left} maxLength={200} placeholder={mn.quiz.left} className="flex-1" onChange={(e) => setPairs(q.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))} />
          <span aria-hidden="true" className="font-bold">↔</span>
          <Input value={p.right} maxLength={200} placeholder={mn.quiz.right} className="flex-1" onChange={(e) => setPairs(q.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} />
          <button type="button" className={SMALL_ICON_BUTTON} disabled={q.pairs.length <= 2} onClick={() => setPairs(q.pairs.filter((_, j) => j !== i))} aria-label={mn.quiz.remove}>
            ✕
          </button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={q.pairs.length >= 8}
        onClick={() => setPairs([...q.pairs, { leftId: randomId(), rightId: randomId(), left: '', right: '' }])}
      >
        + {mn.quiz.addPair}
      </Button>
    </div>
  );
}

function ImageInput({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const picked = input.files?.[0];
    input.value = '';
    if (!picked) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set('image', await shrinkImage(picked, QUIZ_IMAGE_PIXELS));
    const result = await uploadQuizImage(fd);
    setBusy(false);
    if (result.ok) onChange(result.url);
    else setError(result.error);
  };
  let body: ReactNode = null;
  if (isQuizImageUrl(value)) {
    body = (
      <div className="flex items-end gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- a Storage picture the teacher uploaded */}
        <img src={value} alt="" className="max-h-40 rounded-xl border-2 border-ink-900 object-contain" />
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
          {mn.quiz.removeImage}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {body}
      {!value ? (
        <label className={buttonClass('secondary', 'sm', 'cursor-pointer focus-within:ring-4 focus-within:ring-brand-200')}>
          <span aria-hidden="true">🖼️</span> {busy ? mn.quiz.uploading : mn.quiz.addImage}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={busy} onChange={pick} />
        </label>
      ) : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
