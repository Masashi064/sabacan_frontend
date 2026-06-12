"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArticleCard, type ArticleCardData } from "@/components/ArticleCard";
import type { HomeSearchParams } from "@/lib/home/types";

export function ArticleGrid({
  initialItems,
  initialHasMore,
  searchParams,
}: {
  initialItems: ArticleCardData[];
  initialHasMore: boolean;
  searchParams: HomeSearchParams;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const pageRef = useRef(1); // page 0 was already rendered by the server
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchParams.q) params.set("q", searchParams.q);
      if (searchParams.sort) params.set("sort", searchParams.sort);
      if (searchParams.order) params.set("order", searchParams.order);
      if (searchParams.channel) params.set("channel", searchParams.channel);
      if (searchParams.category) params.set("category", searchParams.category);
      if (searchParams.level) params.set("level", searchParams.level);
      if (searchParams.completion) params.set("completion", searchParams.completion);
      params.set("page", String(pageRef.current));

      const res = await fetch(`/api/articles?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { rows: ArticleCardData[]; hasMore: boolean };

      setItems((prev) => [...prev, ...json.rows]);
      setHasMore(json.hasMore);
      pageRef.current += 1;
    } catch (err) {
      console.error("Failed to load more articles:", err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, searchParams]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "300px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (items.length === 0 && !loading) {
    return (
      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">No results</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting filters or clearing the search keyword.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-200">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <ArticleCard key={a.slug} article={a} href={`/articles/${a.slug}`} />
        ))}
      </section>

      <div
        ref={sentinelRef}
        className="flex items-center justify-center py-4 text-sm text-muted-foreground"
      >
        {loading
          ? "Loading…"
          : !hasMore && items.length > 0
          ? "All articles loaded."
          : null}
      </div>
    </div>
  );
}
