import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ArticleCardData } from "@/components/ArticleCard";

// Deliberately minimal: this is an entry point into "today's reading", not
// a substitute for the full article-grid card (ArticleCard). No category/
// level/duration badges, no follow button — just enough to recognize and
// open the article. Fixed width so it sits in a HorizontalScrollShelf row.
export function CompactArticleCard({
  article,
  href,
  reason,
}: {
  article: ArticleCardData;
  href: string;
  reason?: string;
}) {
  return (
    <Link href={href} className="block w-44 sm:w-52 shrink-0 snap-start">
      <Card className="h-full overflow-hidden hover:shadow-sm transition-shadow">
        <div className="relative">
          {article.thumbnailUrl ? (
            <img
              src={article.thumbnailUrl}
              alt={article.videoTitle}
              className="h-24 w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-24 w-full bg-muted" />
          )}

          {reason ? (
            <Badge
              variant="secondary"
              className="absolute top-1.5 left-1.5 bg-background/90 backdrop-blur-sm shadow-sm text-[10px] px-1.5 py-0.5"
            >
              {reason}
            </Badge>
          ) : null}
        </div>

        <div className="p-2.5 space-y-1">
          <p className="text-sm font-medium line-clamp-2">{article.videoTitle}</p>
          <p className="text-xs text-muted-foreground truncate">
            {article.channelName ?? "Unknown channel"}
          </p>
        </div>
      </Card>
    </Link>
  );
}
