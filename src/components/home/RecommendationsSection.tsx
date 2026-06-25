import { ArticleCard } from "@/components/ArticleCard";
import { Badge } from "@/components/ui/badge";
import type { RecommendedArticle } from "@/lib/home/recommendations";

export function RecommendationsSection({ items }: { items: RecommendedArticle[] }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Today&apos;s Recommendations</h2>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.slug} className="relative">
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 z-10 bg-background/90 backdrop-blur-sm shadow-sm"
            >
              {item.reason}
            </Badge>
            <ArticleCard article={item} href={`/articles/${item.slug}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
