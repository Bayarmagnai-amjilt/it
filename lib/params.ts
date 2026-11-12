// Helpers for page parameters (Next.js 16 hands them over as Promises).

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** One query-string value: the first one when a key is repeated. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
