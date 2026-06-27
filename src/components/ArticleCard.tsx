import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { formatVideoLength } from "@/lib/utils";

export type ArticleCardData = {
  slug: string;
  videoTitle: string;
  channelName?: string | null;
  thumbnailUrl?: string | null;
  assignedCategory?: string | null;
  assignedLevel?: string | null;
  publishedDate?: string | null;
  videoLength?: string | null;
  isCompleted?: boolean;
};

export function ArticleCard({
  article,
  href,
}: {
  article: ArticleCardData;
  href: string;
}) {
  return (
    <Link href={href} className="block h-full">
      <Card
        className={[
          "h-full overflow-hidden cursor-pointer",
          "transition-all duration-200 ease-out",
          "hover:-translate-y-0.5 hover:shadow-md",
          "active:scale-[0.98] active:duration-75 active:shadow-sm",
        ].join(" ")}
      >
        <div className="relative">
          {article.thumbnailUrl ? (
            <img
              src={article.thumbnailUrl}
              alt={article.videoTitle}
              className="h-44 w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-44 w-full bg-muted" />
          )}

          {article.isCompleted ? (
            <Badge
              variant="secondary"
              className="absolute top-2 right-2 bg-emerald-50/95 text-emerald-700 border-emerald-200 backdrop-blur-sm shadow-sm"
            >
              ✅ Completed
            </Badge>
          ) : null}
        </div>

        <CardHeader className="space-y-2">
          <CardTitle className="text-base line-clamp-2">{article.videoTitle}</CardTitle>

          <div className="flex flex-wrap gap-2">
            {article.assignedCategory ? (
              <Badge variant="secondary">{article.assignedCategory}</Badge>
            ) : null}
            {article.assignedLevel ? (
              <Badge variant="outline">{article.assignedLevel}</Badge>
            ) : null}
            {formatVideoLength(article.videoLength) ? (
              <Badge variant="outline" className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatVideoLength(article.videoLength)}
              </Badge>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground truncate min-w-0">
            {article.channelName ?? "Unknown channel"}
            {article.publishedDate ? ` • ${article.publishedDate}` : ""}
          </p>
        </CardHeader>

        <CardContent className="pt-0">
          <span className="text-sm text-muted-foreground">Open quiz &amp; vocabulary →</span>
        </CardContent>
      </Card>
    </Link>
  );
}
