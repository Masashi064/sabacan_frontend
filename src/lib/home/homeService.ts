import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeData, HomeSearchParams, CategoryRow } from "./types";

function uniqSorted(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

async function fetchAllCategoryOptionRows(supabase: SupabaseClient) {
  const pageSize = 1000;
  let from = 0;

  let allRows: Array<{
    channel_name: string | null;
    assigned_category: string | null;
    assigned_level: string | null;
  }> = [];

  while (true) {
    const { data, error } = await supabase
      .from("categories")
      .select("channel_name, assigned_category, assigned_level")
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const rows =
      (data as Array<{
        channel_name: string | null;
        assigned_category: string | null;
        assigned_level: string | null;
      }> | null) ?? [];

    allRows = allRows.concat(rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
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

    if (error) {
      throw error;
    }

    const rows =
      ((data ?? []) as unknown[])
        .filter((r): r is { slug: string } => typeof (r as any)?.slug === "string")
        .map((r) => ({ slug: r.slug })) ?? [];

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

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      if (typeof row?.slug === "string" && row.slug) {
        completed.add(row.slug);
      }
    }
  }

  return completed;
}

export async function getHomeData(
  supabase: SupabaseClient,
  sp: HomeSearchParams
): Promise<HomeData> {
  const q = (sp.q ?? "").trim();
  const sort = (sp.sort ?? "published_date") as "published_date" | "created_at";
  const order = (sp.order ?? "desc") as "asc" | "desc";

  const channel = (sp.channel ?? "all").trim();
  const category = (sp.category ?? "all").trim();
  const level = (sp.level ?? "all").trim();
  const completion = (sp.completion ?? "all") as "all" | "complete" | "incomplete";

  // ---- options ----
  let optRows: Array<{
    channel_name: string | null;
    assigned_category: string | null;
    assigned_level: string | null;
  }> = [];

  try {
    optRows = await fetchAllCategoryOptionRows(supabase);
  } catch (error) {
    console.error("Failed to fetch option rows:", error);
    optRows = [];
  }

  const channelOptions = uniqSorted(optRows.map((r) => r.channel_name));
  const categoryOptions = uniqSorted(optRows.map((r) => r.assigned_category));
  const levelOptions = uniqSorted(optRows.map((r) => r.assigned_level));

  // ---- base query builder ----
  function buildBase(selectClause: string) {
    let qb = supabase.from("categories").select(selectClause);

    if (q) qb = qb.or(`video_title.ilike.%${q}%,channel_name.ilike.%${q}%`);
    if (channel !== "all") qb = qb.eq("channel_name", channel);
    if (category !== "all") qb = qb.eq("assigned_category", category);
    if (level !== "all") qb = qb.eq("assigned_level", level);

    return qb;
  }

  // ---- completion filter (quiz_attempts per user) ----
  let slugFilter: string[] | null = null;

  if (completion !== "all") {
    try {
      const candidates = await fetchAllSlugs(supabase, q, channel, category, level);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;

      if (!user) {
        slugFilter = completion === "complete" ? [] : candidates;
      } else {
        const completedSet = await fetchAllCompletedAttemptSlugs(
          supabase,
          user.id,
          candidates
        );

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

  // ---- fetch categories ----
  let rows: CategoryRow[] = [];
  let fetchError: string | null = null;

  if (slugFilter && slugFilter.length === 0) {
    rows = [];
  } else {
    let qb = buildBase(
      "slug, video_id, assigned_category, assigned_level, published_date, created_at, thumbnail_url, channel_name, video_title, video_length"
    );

    if (slugFilter) qb = qb.in("slug", slugFilter);

    const { data, error } = await qb
      .order(sort, { ascending: order === "asc" })
      .limit(60);

    if (error) {
      fetchError = error.message;
      rows = [];
    } else {
      rows = (data as CategoryRow[]) ?? [];
    }
  }

  return { channelOptions, categoryOptions, levelOptions, rows, fetchError };
}