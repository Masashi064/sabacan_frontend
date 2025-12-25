import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeData, HomeSearchParams, CategoryRow } from "./types";

function uniqSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
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
  const { data: optRows } = await supabase
    .from("categories")
    .select("channel_name, assigned_category, assigned_level")
    .limit(5000);

  const channelOptions = uniqSorted((optRows ?? []).map((r: any) => r.channel_name));
  const categoryOptions = uniqSorted((optRows ?? []).map((r: any) => r.assigned_category));
  const levelOptions = uniqSorted((optRows ?? []).map((r: any) => r.assigned_level));

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
    const { data: slugRows, error: slugErr } = await buildBase("slug").limit(5000);

    if (!slugErr) {
      const candidates = ((slugRows ?? []) as unknown[])
        .filter((r): r is { slug: string } => typeof (r as any)?.slug === "string")
        .map((r) => r.slug);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;

      if (!user) {
        slugFilter = completion === "complete" ? [] : candidates;
      } else {
        const { data: attemptRows, error: attemptErr } = await supabase
          .from("quiz_attempts")
          .select("slug")
          .eq("user_id", user.id)
          .in("slug", candidates)
          .not("completed_at", "is", null)
          .limit(10000);

        if (attemptErr) {
          slugFilter = null;
        } else {
          const completedSet = new Set(
            (attemptRows ?? [])
              .map((r: any) => (typeof r?.slug === "string" ? r.slug : ""))
              .filter(Boolean)
          );

          slugFilter =
            completion === "complete"
              ? candidates.filter((s) => completedSet.has(s))
              : candidates.filter((s) => !completedSet.has(s));
        }
      }
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

    const { data, error } = await qb.order(sort, { ascending: order === "asc" }).limit(60);

    if (error) {
      fetchError = error.message;
      rows = [];
    } else {
      rows = (data as unknown as CategoryRow[]) ?? [];
    }
  }

  return { channelOptions, categoryOptions, levelOptions, rows, fetchError };
}
