import { mn } from '@/locales/mn';

type DbError = { message?: string; code?: string; details?: string | null } | null | undefined;

/**
 * Turns a database error into a Mongolian sentence for the teacher.
 * The functions in supabase/migrations raise short codes such as
 * 'weights_must_sum_100'; anything unknown becomes the generic message.
 */
export function errorMessage(error: DbError): string {
  if (!error) return mn.errors.generic;
  const known = mn.errors as Record<string, string>;
  const key = (error.message ?? '').trim();
  if (key in known) return known[key];
  if (error.code === '42501') return mn.errors.not_allowed;
  if (error.code === '23505') return mn.errors.duplicate;
  if (error.code === '23514' || error.code === '22P02' || error.code === '23502') return mn.errors.invalid;
  return mn.errors.generic;
}

/** Replaces {name} placeholders: fill('Сайн уу, {name}!', { name: 'Номин' }) */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}
