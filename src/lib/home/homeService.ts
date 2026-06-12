import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeData, HomeSearchParams, CategoryRow } from "./types";

export const PAGE_SIZE = 24;

type FilterOptionsRpcResult = {
  channels: string[] | null;
  categories: string[] | null;
  levels: string[] | null;
};

// Fetches distinct filter options in a single DB round-trip via the
// get_filter_options() PostgreSQL function defined in:
//   supabase/migrations/20260612_perf_indexes_and_filter_options.sql
async function fetchFilterOptions(
  supabase: SupabaseClient
): Promise<[string[], string[], string[]]> {
  const { data, error } = await supabase.rpc("get_filter_options");
  if (error) throw error;
  const opts = (data ?? {}) as FilterOptionsRpcResult;
  return [opts.channels ?? [], opts.categories ?? [], opts.levels ?? []];
}

async function fetchAllSlugs(
  supabase: SupabaseClient,
  q: string,
  channel: string,
  category: string,
  level: string
) {
  const pageSize = 1000;
  let from = 0;
  let allRows: Array<{ slug: string }> = [];

  while (true) {
    let qb = supabase.from("categories").select("slug");

    if (q) qb = qb.or(`video_title.ilike.%${q}%,channel_name.ilike.%${q}%`);
    if (channel !== "all") qb = qb.eq("channel_name", channel);
    if (category !== "all") qb = qb.eq("assigned_category", category);
    if (level !== "all") qb = qb.eq("assigned_level", level);

    const { data, error } = await qb.range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = ((data ?? []) as unknown[])
      .filter((r): r is { slug: string } => typeof (r as any)?.slug === "string")
      .map((r) => ({ slug: r.slug }));

    allRows = allRows.concat(rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allRows.map((r) => r.slug);
}

async function fetchAllCompletedAttemptSlugs(
  supabase: SupabaseClient,
  userId: string,
  candidates: string[]
) {
  if (candidates.length === 0) return new Set<string>();

  const chunkSize = 500;
  const completed = new Set<string>();

  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);

    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("slug")
      .eq("user_id", userId)
      .in("slug", chunk)
      .not("completed_at", "is", null);

    if (error) throw error;

    for (const row of data ?? []) {
      if (typeof row?.slug === "string" && row.slug) {
        completed.add(row.slug);
      }
    }
  }

  return completed;
}

// Core row-fetching logic shared between the server page and the API route.
async function fetchArticleRows(
  supabase: SupabaseClient,
  sp: HomeSearchParams,
  page: number,
  pageSize: number
): Promise<{ rows: CategoryRow[]; hasMore: boolean; totalCount: number; fetchError: string | null }> {
  const q = (sp.q ?? "").trim();
  const sort = (sp.sort ?? "published_date") as "published_date" | "created_at";
  const order = (sp.order ?? "desc") as "asc" | "desc";
  const channel = (sp.channel ?? "all").trim();
  const category = (sp.category ?? "all").trim();
  const level = (sp.level ?? "all").trim();
  const completion = (sp.completion ?? "all") as "all" | "complete" | "incomplete";

  // { count: "exact" } tells PostgREST to return the total row count in Content-Range.
  // The count reflects all matching rows regardless of the .range() window.
  function buildBase(selectClause: string) {
    let qb = supabase.from("categories").select(selectClause, { count: "exact" });
    if (q) qb = qb.or(`video_title.ilike.%${q}%,channel_name.ilike.%${q}%`);
    if (channel !== "all") qb = qb.eq("channel_name", channel);
    if (category !== "all") qb = qb.eq("assigned_category", category);
    if (level !== "all") qb = qb.eq("assigned_level", level);
    return qb;
  }

  let slugFilter: string[] | null = null;

  if (completion !== "all") {
    try {
      const candidates = await fetchAllSlugs(supabase, q, channel, category, level);
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;

      if (!user) {
        slugFilter = completion === "complete" ? [] : candidates;
      } else {
        const completedSet = await fetchAllCompletedAttemptSlugs(supabase, user.id, candidates);
        slugFilter =
          completion === "complete"
            ? candidates.filter((s) => completedSet.has(s))
            : candidates.filter((s) => !completedSet.has(s));
      }
    } catch (error) {
      console.error("Failed to build completion filter:", error);
      slugFilter = null;
    }
  }

  if (slugFilter && slugFilter.length === 0) {
    return { rows: [], hasMore: false, totalCount: 0, fetchError: null };
  }

  // Fetch one extra row to determine whether a next page exists.
  const fetchSize = pageSize + 1;
  const from = page * pageSize;

  let qb = buildBase(
    "slug, video_id, assigned_category, assigned_level, published_date, created_at, thumbnail_url, channel_name, video_title, video_length"
  );

  if (slugFilter) qb = qb.in("slug", slugFilter);

  const { data, count, error } = await qb
    .order(sort, { ascending: order === "asc" })
    .range(from, from + fetchSize - 1);

  if (error) {
    return { rows: [], hasMore: false, totalCount: 0, fetchError: error.message };
  }

  const allRows = (data as unknown as CategoryRow[]) ?? [];
  const hasMore = allRows.length > pageSize;
  const rows = hasMore ? allRows.slice(0, pageSize) : allRows;
  const totalCount = count ?? 0;

  return { rows, hasMore, totalCount, fetchError: null };
}

// Used by the home page server component: fetches filter options + first page in parallel.
export async function getHomeData(
  supabase: SupabaseClient,
  sp: HomeSearchParams
): Promise<HomeData> {
  const [[channelOptions, categoryOptions, levelOptions], { rows, hasMore, totalCount, fetchError }] =
    await Promise.all([
      fetchFilterOptions(supabase).catch((err) => {
        console.error("Failed to fetch filter options:", err);
        return [[], [], []] as [string[], string[], string[]];
      }),
      fetchArticleRows(supabase, sp, 0, PAGE_SIZE),
    ]);

  return { channelOptions, categoryOptions, levelOptions, rows, hasMore, totalCount, fetchError };
}

// Used by the /api/articles route for subsequent infinite-scroll pages.
export async function getArticlePage(
  supabase: SupabaseClient,
  sp: HomeSearchParams,
  page: number,
  pageSize: number = PAGE_SIZE
) {
  return fetchArticleRows(supabase, sp, page, pageSize);
}
