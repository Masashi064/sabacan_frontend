import { Skeleton } from "@/components/ui/skeleton";

export function RecommendationsSkeleton() {
  return (
    <section className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-56 shrink-0 rounded-xl" />
        ))}
      </div>
    </section>
  );
}

export function HomeContentSkeleton() {
  return (
    <>
      <aside className="hidden lg:block lg:sticky lg:top-6 h-fit">
        <Skeleton className="h-96 w-full rounded-xl" />
      </aside>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-xl" />
          ))}
        </div>
      </div>
    </>
  );
}
