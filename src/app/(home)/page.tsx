// src/app/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { homeMetadata, homePageNumber } from "@/lib/home/pagination";
import { Pagination } from "@/components/home/Pagination";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import type { ArticleCardData } from "@/components/ArticleCard";
import { ArticleFilters } from "@/components/ArticleFilters";
import { MobileFiltersSheet } from "@/components/home/MobileFiltersSheet";
import { ArticleGrid } from "@/components/home/ArticleGrid";
import { FilterStatus } from "@/components/home/FilterStatus";
import { RecommendationsSkeleton } from "@/components/home/HomeSkeletons";

import { getHomeData } from "@/lib/home/homeService";
import { getRecommendedArticles } from "@/lib/home/recommendations";
import { RecommendationsSection } from "@/components/home/RecommendationsSection";
import type { HomeSearchParams } from "@/lib/home/types";

export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams?: Promise<HomeSearchParams> }): Promise<Metadata> {
  const sp = (await searchParams) ?? {};
  const page = homePageNumber(sp.page);
  if (page === null) notFound();
  return homeMetadata(sp, page);
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  if (homePageNumber(sp.page) === null) notFound();
  const supabase = await supabaseServer();
  // Resolve the grid before streaming so it and its links are visible without JS.
  const content = await HomeContent({ supabase, sp });

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Streamed independently so a slow recommendations RPC never blocks the article grid. */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations supabase={supabase} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {content}
      </div>
    </main>
  );
}

async function Recommendations({ supabase }: { supabase: SupabaseClient }) {
  const recommendations = await getRecommendedArticles(supabase, 20);
  return <RecommendationsSection items={recommendations} />;
}

async function HomeContent({
  supabase,
  sp,
}: {
  supabase: SupabaseClient;
  sp: HomeSearchParams;
}) {
  const { channelOptions, categoryOptions, levelOptions, rows, hasMore, totalCount, fetchError } =
    await getHomeData(supabase, sp);

  const page = homePageNumber(sp.page) ?? 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / 24));
  if (!fetchError && page > totalPages) notFound();

  const articles: ArticleCardData[] = rows.map((row) => ({
    slug: row.slug,
    videoTitle: row.video_title ?? row.slug,
    channelName: row.channel_name,
    thumbnailUrl: row.thumbnail_url,
    assignedCategory: row.assigned_category,
    assignedLevel: row.assigned_level,
    publishedDate: row.published_date,
    videoLength: row.video_length,
    isCompleted: row.is_completed,
  }));

  return (
    <>
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
          initialPage={page}
          searchParams={sp}
        />
        {!fetchError ? <Pagination page={page} totalPages={totalPages} searchParams={sp} /> : null}
      </div>
    </>
  );
}
