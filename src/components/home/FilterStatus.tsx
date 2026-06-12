"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HomeSearchParams } from "@/lib/home/types";

// Mirrors the buildUrl logic in ArticleFilters.tsx — keeps defaults out of the URL.
function buildUrl(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  const defaults: Record<string, string> = {
    sort: "published_date",
    order: "desc",
    completion: "all",
  };

  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    if (k in defaults && v === defaults[k]) continue;
    if (v === "all") continue;
    sp.set(k, v);
  }

  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

type FilterTag = {
  key: keyof HomeSearchParams;
  label: string;
};

function getFilterTags(sp: HomeSearchParams): FilterTag[] {
  const tags: FilterTag[] = [];
  if (sp.q?.trim()) tags.push({ key: "q", label: `"${sp.q.trim()}"` });
  if (sp.channel && sp.channel !== "all") tags.push({ key: "channel", label: sp.channel });
  if (sp.category && sp.category !== "all") tags.push({ key: "category", label: sp.category });
  if (sp.level && sp.level !== "all") tags.push({ key: "level", label: sp.level });
  if (sp.completion === "complete") tags.push({ key: "completion", label: "Completed" });
  if (sp.completion === "incomplete") tags.push({ key: "completion", label: "Incomplete" });
  return tags;
}

export function FilterStatus({
  totalCount,
  searchParams,
}: {
  totalCount: number;
  searchParams: HomeSearchParams;
}) {
  const router = useRouter();
  const tags = getFilterTags(searchParams);
  const hasFilters = tags.length > 0;

  return (
    <div className="space-y-2">
      {/* Count row */}
      <div className="flex items-center justify-between gap-2 flex-wrap min-h-7">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {totalCount.toLocaleString()}
          </span>{" "}
          {totalCount === 1 ? "video" : "videos"} found
        </p>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/")}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Active filter tags */}
      {hasFilters && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag.key}
              type="button"
              onClick={() =>
                router.push(
                  buildUrl({
                    ...searchParams,
                    [tag.key]: tag.key === "q" ? "" : "all",
                  })
                )
              }
              className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              {tag.label}
              <X className="h-3 w-3 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
