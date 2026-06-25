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
  if (error) {
    // PostgrestError is a plain object — wrap in a real Error so it serialises
    // correctly in Next.js Turbopack server→browser log forwarding ({} problem).
    throw new Error(
      [
        "get_filter_options RPC failed.",
        `message : ${error.message ?? "–"}`,
        `code    : ${error.code ?? "–"}`,
        `details : ${error.details ?? "–"}`,
        `hint    : ${error.hint ?? "–"}`,
      ].join("\n")
    );
  }
  const opts = (data ?? {}) as FilterOptionsRpcResult;
  return [opts.channels ?? [], opts.categories ?? [], opts.levels ?? []];
}

// Fallback used when get_filter_options() RPC does not exist yet
// (SQL migration not yet applied). Paginates one column at a time.
async function fetchDistinctColumnFallback(
  supabase: SupabaseClient,
  column: "channel_name" | "assigned_category" | "assigned_level"
): Promise<string[]> {
  const pageSize = 1000;
  const seen = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("categories")
      .select(column)
      .not(column, "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`[fetchDistinctColumnFallback] ${column}: ${error.message}`);
      break;
    }

    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const val = row[column];
      if (typeof val === "string" && val.trim()) seen.add(val.trim());
    }

    if ((data ?? []).length < pageSize) break;
    from += pageSize;
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

// Slugs the user has completed at least once. Not scoped to the current
// q/channel/category/level filters — the result is combined with those
// filters directly in the main `categories` query via .in()/.not("in").
async function fetchCompletedAttemptSlugs(supabase: SupabaseClient, userId: string) {
  const pageSize = 1000;
  let from = 0;
  const completed = new Set<string>();

  while (true) {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("slug")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .range(from, from + pageSize - 1);

    if (error) throw error;

    for (const row of data ?? []) {
      if (typeof row?.slug === "string" && row.slug) completed.add(row.slug);
    }

    if ((data ?? []).length < pageSize) break;
    from += pageSize;
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

  // Completed slugs are always a small subset of the catalog, so we filter
  // by including/excluding that small set rather than enumerating every
  // candidate slug (a giant .in() list times out / exceeds URL limits).
  // Fetched whenever the user is logged in — not just when the completion
  // filter is active — since every card also needs to know whether to
  // show a "✅ Completed" badge.
  let completedSlugs: string[] | null = null;

  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;

    if (user) {
      completedSlugs = Array.from(await fetchCompletedAttemptSlugs(supabase, user.id));
    } else if (completion !== "all") {
      completedSlugs = [];
    }
  } catch (error) {
    console.error("Failed to fetch completed slugs:", error);
    completedSlugs = null;
  }

  if (completion === "complete" && completedSlugs && completedSlugs.length === 0) {
    return { rows: [], hasMore: false, totalCount: 0, fetchError: null };
  }

  // Fetch one extra row to determine whether a next page exists.
  const fetchSize = pageSize + 1;
  const from = page * pageSize;

  let qb = buildBase(
    "slug, video_id, assigned_category, assigned_level, published_date, created_at, thumbnail_url, channel_name, video_title, video_length"
  );

  if (completion !== "all" && completedSlugs && completedSlugs.length > 0) {
    const list = `(${completedSlugs.map((s) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`;
    qb = completion === "complete" ? qb.in("slug", completedSlugs) : qb.not("slug", "in", list);
  }

  const { data, count, error } = await qb
    .order(sort, { ascending: order === "asc" })
    .range(from, from + fetchSize - 1);

  if (error) {
    return { rows: [], hasMore: false, totalCount: 0, fetchError: error.message };
  }

  const completedSet = new Set(completedSlugs ?? []);
  const allRows = ((data as unknown as CategoryRow[]) ?? []).map((row) => ({
    ...row,
    is_completed: completedSet.has(row.slug),
  }));
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
      fetchFilterOptions(supabase).catch(async (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[homeService] fetchFilterOptions failed:\n" + msg);
        console.warn(
          "[homeService] RPC not available — falling back to column queries.\n" +
          "  Fix: run supabase/migrations/20260612_perf_indexes_and_filter_options.sql"
        );
        // Fallback: paginate each column independently (slower, no DB function needed)
        try {
          return await Promise.all([
            fetchDistinctColumnFallback(supabase, "channel_name"),
            fetchDistinctColumnFallback(supabase, "assigned_category"),
            fetchDistinctColumnFallback(supabase, "assigned_level"),
          ]) as [string[], string[], string[]];
        } catch {
          return [[], [], []] as [string[], string[], string[]];
        }
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
