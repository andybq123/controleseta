import type { PostgrestError } from "@supabase/supabase-js";

type Page<T> = { data: T[] | null; error: PostgrestError | null };

/**
 * Paginates a Supabase query in pages of `pageSize` rows to bypass the
 * default 1000-row PostgREST limit. The callback receives the inclusive
 * `from`/`to` range and must return the awaited result of `.range(from, to)`.
 */
export async function fetchAllPaginated<T>(
  build: (from: number, to: number) => Promise<Page<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}