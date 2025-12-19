"use client";

import { ArticleFilters } from "@/components/ArticleFilters";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Filter } from "lucide-react";

export function MobileFiltersSheet({
  channelOptions,
  categoryOptions,
  levelOptions,
}: {
  channelOptions: string[];
  categoryOptions: string[];
  levelOptions: string[];
}) {
  return (
    <Sheet>
      <div className="flex items-center justify-end">
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </SheetTrigger>
      </div>

      <SheetContent side="bottom" className="p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>Search & Filters</SheetTitle>
        </SheetHeader>

        {/* 中身が長いので、ここだけスクロール */}
        <div className="px-6 pb-6 max-h-[75vh] overflow-y-auto">
          <ArticleFilters
            channelOptions={channelOptions}
            categoryOptions={categoryOptions}
            levelOptions={levelOptions}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
