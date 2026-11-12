import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attendancePercent, countStatuses } from '../lib/attendance.ts';

// The same numbers as supabase/tests/phase1a.sql, so the page and the database agree.
const twenty = countStatuses([
  ...Array(16).fill('present'), 'late', 'late', 'absent', 'excused',
] as const);

test('counts by status', () => {
  assert.deepEqual(twenty, { present: 16, late: 2, absent: 1, excused: 1, sick: 0 });
  assert.deepEqual(countStatuses([undefined, null, 'sick']), { present: 0, late: 0, absent: 0, excused: 0, sick: 1 });
});

test('excused lessons left out of the total: 17 / 19 = 89.47', () => {
  assert.equal(attendancePercent(twenty, 0.5, 'exclude'), 89.47);
});

test('excused lessons counted as present: 18 / 20 = 90', () => {
  assert.equal(attendancePercent(twenty, 0.5, 'count_present'), 90);
});

test('late coefficient 1: 19 / 20 = 95', () => {
  assert.equal(attendancePercent(twenty, 1, 'count_present'), 95);
});

test('no counted lesson gives no percent', () => {
  assert.equal(attendancePercent(countStatuses([]), 0.5, 'exclude'), null);
  assert.equal(attendancePercent(countStatuses(['excused', 'sick']), 0.5, 'exclude'), null);
  assert.equal(attendancePercent(countStatuses(['excused', 'sick']), 0.5, 'count_present'), 100);
});
