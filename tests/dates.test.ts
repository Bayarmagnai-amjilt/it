import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays, exportFileName, formatDate, formatDayMonth, formatPercent, formatTime, isISODate, isoWeekday,
  isYearMonth, monthRange, shiftMonth, todayISO,
} from '../lib/mn/dates.ts';

test('today is the Ulaanbaatar day, not the server day', () => {
  // 2026-11-11 18:30 UTC is already 02:30 on the 12th in Ulaanbaatar (UTC+8)
  assert.equal(todayISO(new Date('2026-11-11T18:30:00Z')), '2026-11-12');
  assert.equal(todayISO(new Date('2026-11-12T15:59:00Z')), '2026-11-12');
  assert.equal(todayISO(new Date('2026-11-12T16:00:00Z')), '2026-11-13');
});

test('dates are written 2026.11.12', () => {
  assert.equal(formatDate('2026-11-12'), '2026.11.12');
  assert.equal(formatDate('2026-11-12T03:04:05+00:00'), '2026.11.12');
  assert.equal(formatDate(null), '');
  assert.equal(formatDayMonth('2026-11-02'), '11.02');
  assert.equal(formatTime('08:00:00'), '08:00');
});

test('weekday: Monday is 1, Sunday is 7', () => {
  assert.equal(isoWeekday('2026-11-12'), 4); // Thursday
  assert.equal(isoWeekday('2026-11-09'), 1);
  assert.equal(isoWeekday('2026-11-15'), 7);
});

test('date helpers', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.deepEqual(monthRange('2026-11'), { from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(monthRange('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.ok(isISODate('2026-11-12'));
  assert.ok(!isISODate('2026-02-30'));
  assert.ok(!isISODate('12.11.2026'));
  assert.ok(isYearMonth('2026-11') && !isYearMonth('2026-13'));
});

test('export file name follows the prompt: 4Б_дүн_2026-11-12.xlsx', () => {
  assert.equal(exportFileName('4Б', 'дүн', new Date('2026-11-12T05:00:00Z')), '4Б_дүн_2026-11-12.xlsx');
  assert.equal(exportFileName('Бүх анги', 'дүн', new Date('2026-11-12T05:00:00Z')), 'Бүх_анги_дүн_2026-11-12.xlsx');
});

test('percent display trims needless zeros', () => {
  assert.equal(formatPercent(85.5), '85.5');
  assert.equal(formatPercent(90), '90');
  assert.equal(formatPercent(89.947), '89.95');
  assert.equal(formatPercent(null), '');
});
