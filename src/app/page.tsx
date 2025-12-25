// src/app/page.tsx
import { supabaseServer } from "@/lib/supabase/server";
import type { ArticleCardData } from "@/components/ArticleCard";
import { ArticleFilters } from "@/components/ArticleFilters";
import { HomeHeader } from "@/components/home/HomeHeader";
import { MobileFiltersSheet } from "@/components/home/MobileFiltersSheet";
import { ArticleGrid } from "@/components/home/ArticleGrid";

import { getHomeData } from "@/lib/home/homeService";
import type { HomeSearchParams } from "@/lib/home/types";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const supabase = await supabaseServer();

  const { channelOptions, categoryOptions, levelOptions, rows, fetchError } =
    await getHomeData(supabase, sp);

  const articles: ArticleCardData[] = rows.map((row) => ({
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
      <HomeHeader />

      {/* ✅ Mobile/Tablet: Filters button only (Sheet) */}
      <div className="lg:hidden">
        <MobileFiltersSheet
          channelOptions={channelOptions}
          categoryOptions={categoryOptions}
          levelOptions={levelOptions}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ✅ Desktop: sidebar filters */}
        <aside className="hidden lg:block lg:sticky lg:top-6 h-fit">
          <ArticleFilters
            channelOptions={channelOptions}
            categoryOptions={categoryOptions}
            levelOptions={levelOptions}
          />
        </aside>

        <div className="space-y-4">
          {fetchError ? (
            <section className="rounded-xl border bg-white p-6">
              <h2 className="text-lg font-semibold">Error</h2>
              <p className="mt-2 text-sm text-muted-foreground">{fetchError}</p>
            </section>
          ) : null}

          <ArticleGrid items={articles} />
        </div>
      </div>
    </main>
  );
}
