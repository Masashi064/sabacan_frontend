import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { ArticleCard, type ArticleCardData } from "@/components/ArticleCard";
import { ArticleFilters } from "@/components/ArticleFilters";

export const dynamic = "force-dynamic";

type CategoryRow = {
  slug: string;
  video_id: string | null;
  assigned_category: string | null;
  assigned_level: string | null;
  published_date: string | null;
  created_at: string | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  video_title: string | null;
  video_length: string | null;
};

type QuizRow = { slug: string | null };
type VocabRow = { slug: string | null };

function uniqSorted(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    sort?: "published_date" | "created_at";
    order?: "asc" | "desc";
    channel?: string;
    category?: string;
    level?: string;
    completion?: "all" | "complete" | "incomplete";
  }>;
}) {
  const sp = (await searchParams) ?? {};

  const supabase = supabaseServer();

  const q = (sp.q ?? "").trim();
  const sort = (sp.sort ?? "published_date") as "published_date" | "created_at";
  const order = (sp.order ?? "desc") as "asc" | "desc";

  const channel = (sp.channel ?? "all").trim();
  const category = (sp.category ?? "all").trim();
  const level = (sp.level ?? "all").trim();
  const completion = (sp.completion ?? "all") as
    | "all"
    | "complete"
    | "incomplete";

  // ---- filter options (Channel/Category/Level) ----
  const { data: optRows } = await supabase
    .from("categories")
    .select("channel_name, assigned_category, assigned_level")
    .limit(5000);

  const channelOptions = uniqSorted(
    (optRows ?? []).map((r: any) => r.channel_name)
  );
  const categoryOptions = uniqSorted(
    (optRows ?? []).map((r: any) => r.assigned_category)
  );
  const levelOptions = uniqSorted((optRows ?? []).map((r: any) => r.assigned_level));

  // ---- build base filter (without completion) ----
  function buildBase() {
    let qb = supabase.from("categories").select("*");

    // 1) search / filters FIRST
    if (q) {
      qb = qb.or(`video_title.ilike.%${q}%,channel_name.ilike.%${q}%`);
    }
    if (channel !== "all") qb = qb.eq("channel_name", channel);
    if (category !== "all") qb = qb.eq("assigned_category", category);
    if (level !== "all") qb = qb.eq("assigned_level", level);

    // 2) completion filter（ここに入れる：まだ order/range 前）
    // if (completion === "complete") { ... }
    // if (completion === "incomplete") { ... }

    // 3) sort AFTER filters
    qb = qb.order(sort, { ascending: order === "asc" });

    // 4) paging LAST（使ってるなら）
    // qb = qb.range(from, to);

    return qb;
  }


  // ---- completion filter uses quiz+vocab presence by slug ----
  let slugFilter: string[] | null = null;

  if (completion !== "all") {
    const { data: slugRows, error: slugErr } = await buildBase()
      .select("slug")
      .limit(5000);

    if (!slugErr) {
      const candidates = (slugRows as Array<{ slug: string }>).map((r) => r.slug);

      const [{ data: quizRows }, { data: vocabRows }] = await Promise.all([
        supabase.from("quiz").select("slug").limit(10000),
        supabase.from("vocab").select("slug").limit(10000),
      ]);

      const quizSet = new Set(
        (quizRows as QuizRow[] | null)?.map((r) => r.slug ?? "").filter(Boolean) ?? []
      );
      const vocabSet = new Set(
        (vocabRows as VocabRow[] | null)?.map((r) => r.slug ?? "").filter(Boolean) ?? []
      );

      const completeSet = new Set(
        candidates.filter((s) => quizSet.has(s) && vocabSet.has(s))
      );

      slugFilter =
        completion === "complete"
          ? candidates.filter((s) => completeSet.has(s))
          : candidates.filter((s) => !completeSet.has(s));
    }
  }

  // ---- final query ----
  let query = buildBase()
    .select(
      "slug, video_id, assigned_category, assigned_level, published_date, created_at, thumbnail_url, channel_name, video_title, video_length"
    )
    .order(sort, { ascending: order === "asc" })
    .limit(60);

  if (slugFilter) {
    // no results early
    if (slugFilter.length === 0) {
      return (
        <main className="mx-auto max-w-6xl p-6 space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">Sabacan365</h1>
            <p className="text-sm text-muted-foreground">
              English listening quizzes from real videos.
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="lg:sticky lg:top-6 h-fit">
              <ArticleFilters
                channelOptions={channelOptions}
                categoryOptions={categoryOptions}
                levelOptions={levelOptions}
              />
            </aside>

            <section className="text-sm text-muted-foreground">
              No results.
            </section>
          </div>
        </main>
      );
    }

    query = supabase
      .from("categories")
      .select(
        "slug, video_id, assigned_category, assigned_level, published_date, created_at, thumbnail_url, channel_name, video_title, video_length"
      )
      .in("slug", slugFilter)
      .order(sort, { ascending: order === "asc" })
      .limit(60);
  }

  const { data, error } = await query;

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Sabacan365</h1>
        <pre className="rounded-lg border p-4 text-sm overflow-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
      </main>
    );
  }

  const articles: ArticleCardData[] = (data as CategoryRow[]).map((row) => ({
    slug: row.slug,
    videoTitle: row.video_title ?? row.slug,
    channelName: row.channel_name,
    thumbnailUrl: row.thumbnail_url,
    assignedCategory: row.assigned_category,
    assignedLevel: row.assigned_level,
    publishedDate: row.published_date,
    videoLength: row.video_length,
  }));

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Sabacan365</h1>
        <p className="text-sm text-muted-foreground">
          English listening quizzes from real videos.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-6 h-fit">
          <ArticleFilters
            channelOptions={channelOptions}
            categoryOptions={categoryOptions}
            levelOptions={levelOptions}
          />
        </aside>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.slug} article={a} href={`/articles/${a.slug}`} />
          ))}
        </section>

      </div>
    </main>
  );
}