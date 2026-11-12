// Supabase returns at most 1000 rows per request by default. A term of attendance
// for one class can be larger, so long lists are read page by page.

type Page = PromiseLike<{ data: unknown[] | null; error: unknown }>;

/**
 * Reads every row of a query. `build` receives the row range of one page and
 * must return the query with a stable .order(...) and .range(from, to) applied.
 */
export async function fetchAll<T>(build: (from: number, to: number) => Page, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 200_000; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error('query_failed');
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
