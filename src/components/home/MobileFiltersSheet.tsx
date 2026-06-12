"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Filter } from "lucide-react";
import { ArticleFilters } from "@/components/ArticleFilters";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function countActiveFilters(sp: URLSearchParams): number {
  let n = 0;
  if (sp.get("q")?.trim()) n++;
  if (sp.get("channel") && sp.get("channel") !== "all") n++;
  if (sp.get("category") && sp.get("category") !== "all") n++;
  if (sp.get("level") && sp.get("level") !== "all") n++;
  const c = sp.get("completion");
  if (c && c !== "all") n++;
  return n;
}

export function MobileFiltersSheet({
  channelOptions,
  categoryOptions,
  levelOptions,
  initialCount,
}: {
  channelOptions: string[];
  categoryOptions: string[];
  levelOptions: string[];
  initialCount: number;
}) {
  const searchParams = useSearchParams();
  const [liveCount, setLiveCount] = useState(initialCount);
  const [fetching, setFetching] = useState(false);
  const isFirstRender = useRef(true);

  const activeCount = countActiveFilters(new URLSearchParams(searchParams.toString()));

  // Skip the initial fetch — initialCount from server is already correct.
  // Re-fetch whenever URL params change after that.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    let cancelled = false;
    setFetching(true);

    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "0");

    fetch(`/api/articles?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { totalCount?: number } | null) => {
        if (!cancelled && json && typeof json.totalCount === "number") {
          setLiveCount(json.totalCount);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <Sheet>
      <div className="flex items-center justify-between">
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
      </div>

      <SheetContent side="bottom" className="p-0 gap-0" hideClose>
        <SheetHeader className="px-6 pt-5 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Filters</SheetTitle>
            {activeCount > 0 && (
              <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                {activeCount} active
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <ArticleFilters
            channelOptions={channelOptions}
            categoryOptions={categoryOptions}
            levelOptions={levelOptions}
          />
        </div>

        {/* Sticky footer: live count + Done button */}
        <SheetFooter className="px-6 py-4 border-t bg-muted/30 gap-0">
          <div className="flex items-center justify-between w-full gap-4">
            <p className="text-sm select-none">
              <span
                className={cn(
                  "font-semibold tabular-nums transition-opacity duration-200",
                  fetching ? "opacity-40" : "opacity-100"
                )}
              >
                {liveCount.toLocaleString()}
              </span>
              <span
                className={cn(
                  "text-muted-foreground transition-opacity duration-200",
                  fetching ? "opacity-40" : "opacity-100"
                )}
              >
                {" "}
                {liveCount === 1 ? "video" : "videos"} found
              </span>
            </p>

            <SheetClose asChild>
              <Button className="gap-1.5 min-w-[100px]">
                <Check className="h-4 w-4" />
                Done
              </Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
