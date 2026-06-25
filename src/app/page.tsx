// src/app/page.tsx
import { supabaseServer } from "@/lib/supabase/server";
import type { ArticleCardData } from "@/components/ArticleCard";
import { ArticleFilters } from "@/components/ArticleFilters";
import { MobileFiltersSheet } from "@/components/home/MobileFiltersSheet";
import { ArticleGrid } from "@/components/home/ArticleGrid";
import { FilterStatus } from "@/components/home/FilterStatus";

import { getHomeData } from "@/lib/home/homeService";
import { getRecommendedArticles } from "@/lib/home/recommendations";
import { RecommendationsSection } from "@/components/home/RecommendationsSection";
import type { HomeSearchParams } from "@/lib/home/types";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const supabase = await supabaseServer();

  const [
    { channelOptions, categoryOptions, levelOptions, rows, hasMore, totalCount, fetchError },
    recommendations,
  ] = await Promise.all([getHomeData(supabase, sp), getRecommendedArticles(supabase, 20)]);

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
      <RecommendationsSection items={recommendations} />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Desktop: sidebar filters */}
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

          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">🎬 Videos</h2>

            {/* Mobile/Tablet: Filters button only (Sheet) */}
            <div className="lg:hidden">
              <MobileFiltersSheet
                channelOptions={channelOptions}
                categoryOptions={categoryOptions}
                levelOptions={levelOptions}
                initialCount={totalCount}
              />
            </div>
          </div>

          <FilterStatus totalCount={totalCount} searchParams={sp} />

          {/* key causes remount (state reset) whenever filter params change */}
          <ArticleGrid
            key={JSON.stringify(sp)}
            initialItems={articles}
            initialHasMore={hasMore}
            searchParams={sp}
          />
        </div>
      </div>
    </main>
  );
}
