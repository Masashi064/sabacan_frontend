import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatVideoLength } from "@/lib/utils";
import type { ArticleCardData } from "@/components/ArticleCard";

// Deliberately minimal: this is an entry point into "today's reading", not
// a substitute for the full article-grid card (ArticleCard). No category/
// level badges, no follow button — just enough to recognize and open the
// article. Fixed width + fixed-height title area so every card in a
// HorizontalScrollShelf row lines up regardless of title length.
export function CompactArticleCard({
  article,
  href,
  reason,
}: {
  article: ArticleCardData;
  href: string;
  reason?: string;
}) {
  const duration = formatVideoLength(article.videoLength);

  return (
    <Link href={href} className="block w-32 sm:w-36 shrink-0 snap-start">
      <Card className="h-full overflow-hidden hover:shadow-sm transition-shadow">
        <div className="relative">
          {article.thumbnailUrl ? (
            <img
              src={article.thumbnailUrl}
              alt={article.videoTitle}
              className="h-16 sm:h-20 w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-16 sm:h-20 w-full bg-muted" />
          )}

          {reason ? (
            <Badge
              variant="secondary"
              className="absolute top-1 left-1 bg-background/90 backdrop-blur-sm shadow-sm text-[9px] px-1 py-0.5 leading-tight"
            >
              {reason}
            </Badge>
          ) : null}
        </div>

        <div className="p-2 space-y-0.5">
          <p className="text-xs font-medium line-clamp-2 min-h-[2rem]">
            {article.videoTitle}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {article.channelName ?? "Unknown channel"}
          </p>
          {duration ? (
            <p className="text-[11px] text-muted-foreground">{duration}</p>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
