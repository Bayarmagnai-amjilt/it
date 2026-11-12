import { mn } from '@/locales/mn';

type DbError = { message?: string; code?: string } | null | undefined;

/**
 * After a form is submitted the server redirects back with ?ok=<code> or
 * ?error=<code>. Only codes travel in the address; the text shown always comes
 * from locales/mn.ts, so a crafted link cannot put its own words on the page.
 */
export function flashUrl(path: string, kind: 'ok' | 'error', code: string): string {
  const url = new URL(path, 'http://local');
  url.searchParams.delete('ok');
  url.searchParams.delete('error');
  url.searchParams.set(kind, code);
  return url.pathname + url.search;
}

/** Short code for a database error: one of the keys of mn.errors. */
export function errorCode(error: DbError): string {
  const key = (error?.message ?? '').trim();
  if (key && key in mn.errors) return key;
  if (error?.code === '42501') return 'not_allowed';
  if (error?.code === '23505') return 'duplicate';
  if (error?.code === '23514' || error?.code === '22P02' || error?.code === '23502') return 'invalid';
  return 'generic';
}

export function flashMessage(
  params: Record<string, string | string[] | undefined>,
): { tone: 'success' | 'error'; text: string } | null {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const error = pick(params.error);
  if (error) {
    const known = mn.errors as Record<string, string>;
    return { tone: 'error', text: known[error] ?? mn.errors.generic };
  }
  const ok = pick(params.ok);
  if (ok) {
    const known = mn.flash as Record<string, string>;
    return { tone: 'success', text: known[ok] ?? mn.flash.saved };
  }
  return null;
}

/** Only in-app teacher paths are accepted as a "return to" target. */
export function safeReturnTo(value: FormDataEntryValue | null, fallback: string): string {
  const v = typeof value === 'string' ? value : '';
  return v.startsWith('/t/') && !v.includes('//') && !v.includes('\\') ? v : fallback;
}
