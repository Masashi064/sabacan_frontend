import Link from "next/link";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatVideoLength } from "@/lib/utils";
import type { ArticleCardData } from "@/components/ArticleCard";

// Deliberately minimal: this is an entry point into "today's reading", not
// a substitute for the full article-grid card (ArticleCard). No category/
// level badges, no follow button — just enough to recognize and open the
// article. Fixed width + fixed-height title area so every card in a
// HorizontalScrollShelf row lines up regardless of title length. Wider/
// shorter than a typical thumbnail card so a 2-line title rarely wraps
// to a 3rd line.
export function CompactArticleCard({
  article,
  href,
}: {
  article: ArticleCardData;
  href: string;
}) {
  const duration = formatVideoLength(article.videoLength);

  return (
    <Link href={href} className="block w-44 sm:w-52 shrink-0 snap-start">
      <Card
        className={[
          "h-full overflow-hidden cursor-pointer",
          "transition-all duration-200 ease-out",
          "hover:-translate-y-0.5 hover:shadow-md",
          "active:scale-[0.98] active:duration-75 active:shadow-sm",
        ].join(" ")}
      >
        <div className="relative aspect-video w-full bg-muted">
          {article.thumbnailUrl ? (
            <img
              src={article.thumbnailUrl}
              alt={article.videoTitle}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>

        <div className="p-1.5 space-y-0.5">
          <p className="text-xs font-medium line-clamp-2 min-h-[2rem]">
            {article.videoTitle}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="truncate">{article.channelName ?? "Unknown channel"}</span>
            {duration ? (
              <span className="flex items-center gap-0.5 shrink-0">
                <Clock className="h-3 w-3" />
                {duration}
              </span>
            ) : null}
          </p>
        </div>
      </Card>
    </Link>
  );
}
