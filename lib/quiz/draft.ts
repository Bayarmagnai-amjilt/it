// The quiz editor's working copy, and its conversion to and from what the
// database stores. Self-contained (relative imports) so the tests can load it.
import type { AnswerKey, PublicQuestion, QuestionContent, QuestionType, TextItem } from './types.ts';

export interface DraftOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface DraftPair {
  leftId: string;
  rightId: string;
  left: string;
  right: string;
}

export interface DraftQuestion {
  /** stable React key; the database id when the question is saved already */
  key: string;
  id?: string;
  type: QuestionType;
  text: string;
  image: string | null;
  timeLimit: number | null;
  points: number;
  explanation: string;
  options: DraftOption[];
  truth: boolean;
  accepted: string[];
  items: TextItem[];
  pairs: DraftPair[];
}

export interface QuizDraft {
  id?: string;
  title: string;
  description: string;
  grade: number | null;
  questions: DraftQuestion[];
}

export const TIME_LIMITS: (number | null)[] = [null, 10, 20, 30, 45, 60, 90, 120];
export const MAX_QUESTIONS = 60;
export const MAX_OPTIONS = 6;

/** Short random id. Random on purpose: ids must not give away an order or a pair. */
export function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const option = (text = '', correct = false): DraftOption => ({ id: randomId(), text, correct });
const pair = (left = '', right = ''): DraftPair => ({ leftId: randomId(), rightId: randomId(), left, right });

export function emptyQuestion(type: QuestionType = 'single_choice'): DraftQuestion {
  return {
    key: randomId(),
    type,
    text: '',
    image: null,
    timeLimit: 30,
    points: 1,
    explanation: '',
    options: [option('', true), option(), option(), option()],
    truth: true,
    accepted: [''],
    items: [
      { id: randomId(), text: '' },
      { id: randomId(), text: '' },
      { id: randomId(), text: '' },
    ],
    pairs: [pair(), pair(), pair()],
  };
}

/** Switching type keeps the question text, picture, time and points. */
export function changeType(q: DraftQuestion, type: QuestionType): DraftQuestion {
  const fresh = emptyQuestion(type);
  const options =
    type === 'single_choice'
      ? q.options.map((o, i) => ({ ...o, correct: i === Math.max(0, q.options.findIndex((x) => x.correct)) }))
      : q.options;
  return { ...fresh, key: q.key, id: q.id, type, text: q.text, image: q.image, timeLimit: q.timeLimit, points: q.points, explanation: q.explanation, options };
}

export function emptyDraft(): QuizDraft {
  return { title: '', description: '', grade: null, questions: [emptyQuestion()] };
}

function shuffled<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // never show the right order (or the right pairing) by chance
  if (out.length > 1 && out.every((x, i) => x === list[i])) out.push(out.shift() as T);
  return out;
}

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

export interface ProblemCode {
  code: 'title' | 'noQuestions' | 'text' | 'options' | 'oneCorrect' | 'someCorrect' | 'accepted' | 'items' | 'pairs';
  n?: number;
}

/** Everything that keeps the quiz from being saved, in order. */
export function problems(draft: QuizDraft): ProblemCode[] {
  const out: ProblemCode[] = [];
  if (!clean(draft.title, 120)) out.push({ code: 'title' });
  if (draft.questions.length === 0) out.push({ code: 'noQuestions' });
  draft.questions.forEach((q, i) => {
    const n = i + 1;
    if (!clean(q.text, 500) && !q.image) out.push({ code: 'text', n });
    const opts = q.options.filter((o) => clean(o.text, 200));
    switch (q.type) {
      case 'single_choice':
        if (opts.length < 2) out.push({ code: 'options', n });
        else if (opts.filter((o) => o.correct).length !== 1) out.push({ code: 'oneCorrect', n });
        break;
      case 'multi_choice':
        if (opts.length < 2) out.push({ code: 'options', n });
        else if (!opts.some((o) => o.correct)) out.push({ code: 'someCorrect', n });
        break;
      case 'short_answer':
        if (!q.accepted.some((a) => clean(a, 200))) out.push({ code: 'accepted', n });
        break;
      case 'ordering':
        if (q.items.filter((t) => clean(t.text, 200)).length < 2) out.push({ code: 'items', n });
        break;
      case 'matching':
        if (q.pairs.filter((p) => clean(p.left, 200) && clean(p.right, 200)).length < 2) out.push({ code: 'pairs', n });
        break;
      default:
        break;
    }
  });
  return out;
}

export interface QuestionPayload {
  id?: string;
  type: QuestionType;
  prompt: { text: string; image: string | null };
  content: QuestionContent;
  answer_key: AnswerKey;
  explanation: string;
  time_limit: number | null;
  points: number;
}

export interface QuizPayload {
  title: string;
  description: string;
  grade: number | null;
  questions: QuestionPayload[];
}

/** What save_quiz() receives. `allowImage` filters picture URLs to our own bucket. */
export function toPayload(draft: QuizDraft, allowImage: (url: string) => boolean): QuizPayload {
  return {
    title: clean(draft.title, 120),
    description: clean(draft.description, 500),
    grade: draft.grade && draft.grade >= 1 && draft.grade <= 5 ? draft.grade : null,
    questions: draft.questions.slice(0, MAX_QUESTIONS).map((q) => {
      let content: QuestionContent = {};
      let key: AnswerKey = {};
      if (q.type === 'single_choice' || q.type === 'multi_choice') {
        const opts = q.options.filter((o) => clean(o.text, 200)).slice(0, MAX_OPTIONS);
        content = { options: opts.map((o) => ({ id: o.id, text: clean(o.text, 200) })) };
        const right = opts.filter((o) => o.correct).map((o) => o.id);
        key = { correct: q.type === 'single_choice' ? right[0] : right };
      } else if (q.type === 'true_false') {
        key = { correct: q.truth };
      } else if (q.type === 'short_answer') {
        key = { accepted: [...new Set(q.accepted.map((a) => clean(a, 200)).filter(Boolean))] };
      } else if (q.type === 'ordering') {
        const items = q.items.filter((t) => clean(t.text, 200)).map((t) => ({ id: t.id, text: clean(t.text, 200) }));
        content = { items: shuffled(items) };
        key = { order: items.map((t) => t.id) };
      } else if (q.type === 'matching') {
        const pairs = q.pairs.filter((p) => clean(p.left, 200) && clean(p.right, 200));
        content = {
          left: pairs.map((p) => ({ id: p.leftId, text: clean(p.left, 200) })),
          right: shuffled(pairs.map((p) => ({ id: p.rightId, text: clean(p.right, 200) }))),
        };
        key = { pairs: Object.fromEntries(pairs.map((p) => [p.leftId, p.rightId])) };
      }
      const limit = TIME_LIMITS.includes(q.timeLimit) ? q.timeLimit : 30;
      return {
        id: q.id,
        type: q.type,
        prompt: { text: clean(q.text, 500), image: q.image && allowImage(q.image) ? q.image : null },
        content,
        answer_key: key,
        explanation: clean(q.explanation, 1000),
        time_limit: limit,
        points: Math.min(100, Math.max(0, Math.round(Number(q.points) || 0))),
      };
    }),
  };
}

/** Back from the database (with the answer key) into the editor. */
export function fromQuestion(pq: PublicQuestion): DraftQuestion {
  const q = emptyQuestion(pq.type);
  const key = pq.answer_key ?? {};
  const byId = (list: TextItem[] | undefined) => new Map((list ?? []).map((t) => [t.id, t.text]));
  q.key = pq.id;
  q.id = pq.id;
  q.text = pq.prompt?.text ?? '';
  q.image = pq.prompt?.image ?? null;
  q.timeLimit = pq.time_limit;
  q.points = Number(pq.points);
  q.explanation = pq.explanation ?? '';
  if (pq.type === 'single_choice' || pq.type === 'multi_choice') {
    const right = Array.isArray(key.correct) ? key.correct : [key.correct];
    q.options = (pq.content.options ?? []).map((o) => ({ id: o.id, text: o.text, correct: right.includes(o.id) }));
  } else if (pq.type === 'true_false') {
    q.truth = key.correct === true;
  } else if (pq.type === 'short_answer') {
    q.accepted = key.accepted?.length ? [...key.accepted] : [''];
  } else if (pq.type === 'ordering') {
    const text = byId(pq.content.items);
    q.items = (key.order ?? []).map((id) => ({ id, text: text.get(id) ?? '' }));
  } else if (pq.type === 'matching') {
    const right = byId(pq.content.right);
    q.pairs = (pq.content.left ?? []).map((l) => {
      const rightId = key.pairs?.[l.id] ?? randomId();
      return { leftId: l.id, rightId, left: l.text, right: right.get(rightId) ?? '' };
    });
  }
  return q;
}
