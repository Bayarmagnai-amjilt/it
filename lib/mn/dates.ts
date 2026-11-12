// Dates as the school sees them: Ulaanbaatar time, written 2026.11.12.
// Self-contained on purpose (no imports) so tests can load it directly.

export const TIME_ZONE = 'Asia/Ulaanbaatar';

const ISO_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's school day as YYYY-MM-DD, whatever time zone the server runs in. */
export function todayISO(now: Date = new Date()): string {
  return ISO_DAY.format(now);
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 2026-11-12 -> 2026.11.12 */
export function formatDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10).replaceAll('-', '.') : '';
}

/** 2026-11-12 -> 11.12 */
export function formatDayMonth(iso: string): string {
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
}

/** Monday = 1 ... Sunday = 7 */
export function isoWeekday(iso: string): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-11" -> first and last day of that month */
export function monthRange(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

export function isYearMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "08:00:00" -> "08:00" */
export function formatTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

/** Clock time of a timestamp, in Ulaanbaatar: "14:05" */
export function formatClock(timestamp: string | null | undefined): string {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(
    new Date(timestamp),
  );
}

/** File name of an export: 4Б_дүн_2026-11-12.xlsx */
export function exportFileName(className: string, kind: string, now: Date = new Date()): string {
  const safe = className.replace(/[\\/:*?"<>|\s]+/g, '_');
  return `${safe}_${kind}_${todayISO(now)}.xlsx`;
}

/** Percent for display: 85.5, 90, 89.95. Empty string when there is no value. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return String(Math.round(Number(value) * 100) / 100);
}
