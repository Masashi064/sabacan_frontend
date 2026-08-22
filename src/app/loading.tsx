import { RecommendationsSkeleton, HomeContentSkeleton } from "@/components/home/HomeSkeletons";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <RecommendationsSkeleton />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <HomeContentSkeleton />
      </div>
    </main>
  );
}
