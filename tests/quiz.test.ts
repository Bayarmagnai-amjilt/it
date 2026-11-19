import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyDraft, emptyQuestion, fromQuestion, problems, toPayload, type QuizDraft } from '../lib/quiz/draft.ts';
import type { PublicQuestion } from '../lib/quiz/types.ts';

const anyImage = () => true;

function fullDraft(): QuizDraft {
  const single = { ...emptyQuestion('single_choice'), text: '2 + 2 = ?' };
  single.options = single.options.map((o, i) => ({ ...o, text: ['3', '4', '5', ''][i], correct: i === 1 }));
  const ordering = { ...emptyQuestion('ordering'), text: 'Эрэмбэл' };
  ordering.items = ordering.items.map((t, i) => ({ ...t, text: ['нэг', 'хоёр', 'гурав'][i] }));
  const matching = { ...emptyQuestion('matching'), text: 'Холбо' };
  matching.pairs = matching.pairs.map((p, i) => ({ ...p, left: ['нохой', 'муур', 'үхэр'][i], right: ['хав', 'мяу', 'мөө'][i] }));
  const short = { ...emptyQuestion('short_answer'), text: 'Нийслэл?', accepted: ['Улаанбаатар', ' улаанбаатар ', ''] };
  return { title: '  Тест  ', description: '', grade: 2, questions: [single, ordering, matching, short] };
}

test('a fresh draft lists what is missing', () => {
  const codes = problems(emptyDraft()).map((p) => p.code);
  assert.deepEqual(codes, ['title', 'text', 'options']);
});

test('a filled draft has no problems and keeps the answers apart from the content', () => {
  const draft = fullDraft();
  assert.deepEqual(problems(draft), []);
  const payload = toPayload(draft, anyImage);
  assert.equal(payload.title, 'Тест');
  const [single, ordering, matching, short] = payload.questions;
  assert.equal(single.content.options?.length, 3, 'empty options are dropped');
  assert.equal(single.answer_key.correct, single.content.options?.[1].id);
  // the shown order is never the answer
  assert.notDeepEqual(ordering.content.items?.map((t) => t.id), ordering.answer_key.order);
  const shownRight = matching.content.right?.map((t) => t.id);
  const pairedRight = matching.content.left?.map((l) => matching.answer_key.pairs?.[l.id]);
  assert.notDeepEqual(shownRight, pairedRight);
  assert.deepEqual(short.answer_key.accepted, ['Улаанбаатар', 'улаанбаатар']);
});

test('saving and loading gives the same quiz back', () => {
  const draft = fullDraft();
  const payload = toPayload(draft, anyImage);
  payload.questions.forEach((pq, i) => {
    const back = fromQuestion({ ...pq, id: `q${i}`, position: i + 1 } as PublicQuestion);
    assert.equal(back.type, pq.type);
    if (pq.type === 'ordering') assert.deepEqual(back.items.map((t) => t.text), ['нэг', 'хоёр', 'гурав']);
    if (pq.type === 'matching') assert.deepEqual(back.pairs.map((p) => `${p.left}-${p.right}`), ['нохой-хав', 'муур-мяу', 'үхэр-мөө']);
    if (pq.type === 'single_choice') assert.deepEqual(back.options.map((o) => o.correct), [false, true, false]);
  });
});

test('pictures from elsewhere are dropped', () => {
  const draft = fullDraft();
  draft.questions[0].image = 'https://evil.example/x.png';
  assert.equal(toPayload(draft, (url) => url.startsWith('https://ok/')).questions[0].prompt.image, null);
});
