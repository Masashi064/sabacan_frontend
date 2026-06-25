import { CompactArticleCard } from "@/components/home/CompactArticleCard";
import { HorizontalScrollShelf } from "@/components/home/HorizontalScrollShelf";
import type { RecommendedArticle } from "@/lib/home/recommendations";

export function RecommendationsSection({ items }: { items: RecommendedArticle[] }) {
  if (items.length === 0) return null;

  return (
    <HorizontalScrollShelf title="Today's Recommendations">
      {items.map((item) => (
        <CompactArticleCard
          key={item.slug}
          article={item}
          href={`/articles/${item.slug}`}
          reason={item.reason}
        />
      ))}
    </HorizontalScrollShelf>
  );
}
