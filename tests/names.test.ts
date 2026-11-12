// Run with: npm test   (Node 22.18+ runs TypeScript test files directly)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareNames, displayName, firstLetter, letterIndex, parseStudentLines, sortByName } from '../lib/mn/names.ts';

test('displayName adds the family initial when there is one', () => {
  assert.equal(displayName({ first_name: 'Тэмүүлэн', family_initial: 'Б' }), 'Б. Тэмүүлэн');
  assert.equal(displayName({ first_name: 'Номин', family_initial: null }), 'Номин');
});

test('names sort in Mongolian alphabet order: Ө after О, Ү after У', () => {
  const names = ['Яргуй', 'Өлзий', 'Оюун', 'Үүрээ', 'Уянга', 'Пүрэв', 'Хулан'].map((first_name) => ({ first_name }));
  assert.deepEqual(
    sortByName(names).map((n) => n.first_name),
    ['Оюун', 'Өлзий', 'Пүрэв', 'Уянга', 'Үүрээ', 'Хулан', 'Яргуй'],
  );
});

test('namesakes are ordered by family initial', () => {
  const a = { first_name: 'Тэмүүлэн', family_initial: 'Д' };
  const b = { first_name: 'Тэмүүлэн', family_initial: 'Б' };
  assert.ok(compareNames(b, a) < 0);
  assert.deepEqual(sortByName([a, b]).map(displayName), ['Б. Тэмүүлэн', 'Д. Тэмүүлэн']);
});

test('letter filter lists each first letter once, in alphabet order', () => {
  const list = ['Үүрээ', 'Оюун', 'Өлзий', 'одгэрэл', 'Уянга'].map((first_name) => ({ first_name }));
  assert.deepEqual(letterIndex(list), ['О', 'Ө', 'У', 'Ү']);
  assert.equal(firstLetter(' өлзий'), 'Ө');
});

test('pasted lines: the usual ways of writing a name', () => {
  assert.deepEqual(parseStudentLines('Тэмүүлэн\nБ. Тэмүүлэн\nД.Номин\nӨлзий Г\nБат Ананд\n\n  '), [
    { first_name: 'Тэмүүлэн', family_initial: null, gender: null },
    { first_name: 'Тэмүүлэн', family_initial: 'Б', gender: null },
    { first_name: 'Номин', family_initial: 'Д', gender: null },
    { first_name: 'Өлзий', family_initial: 'Г', gender: null },
    { first_name: 'Ананд', family_initial: 'Б', gender: null },
  ]);
});

test('pasted lines: rows copied from Excel with a header, numbers and gender', () => {
  const text = '№\tОвгийн эхний үсэг\tНэр\tХүйс\n1\tБ\tтэмүүлэн\tэр\n2\tД\tНомин\tЭмэгтэй\n3\t\tҮүрээ\t';
  assert.deepEqual(parseStudentLines(text), [
    { first_name: 'Тэмүүлэн', family_initial: 'Б', gender: 'male' },
    { first_name: 'Номин', family_initial: 'Д', gender: 'female' },
    { first_name: 'Үүрээ', family_initial: null, gender: null },
  ]);
});

test('pasted lines: "Овог | Нэр" columns and numbered single lines', () => {
  assert.deepEqual(parseStudentLines('Бат\tТэмүүлэн\nДорж\tНомин'), [
    { first_name: 'Тэмүүлэн', family_initial: 'Б', gender: null },
    { first_name: 'Номин', family_initial: 'Д', gender: null },
  ]);
  assert.deepEqual(parseStudentLines('1. Г. Өлзий\n2) Хулан'), [
    { first_name: 'Өлзий', family_initial: 'Г', gender: null },
    { first_name: 'Хулан', family_initial: null, gender: null },
  ]);
});

test('hyphenated names stay whole', () => {
  assert.deepEqual(parseStudentLines('М. Мөнх-Эрдэнэ'), [{ first_name: 'Мөнх-Эрдэнэ', family_initial: 'М', gender: null }]);
});
