import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

export type ArticleCardData = {
  slug: string;
  videoTitle: string;
  channelName?: string | null;
  thumbnailUrl?: string | null;
  assignedCategory?: string | null;
  assignedLevel?: string | null;
  publishedDate?: string | null;
  videoLength?: string | null;
};

export function ArticleCard({
  article,
  href,
}: {
  article: ArticleCardData;
  href: string;
}) {
  return (
    <Card className="h-full overflow-hidden hover:shadow-sm transition-shadow">
      <Link href={href} className="block">
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
      </Link>

      <CardHeader className="space-y-2">
        <CardTitle className="text-base line-clamp-2">
          <Link href={href} className="hover:underline">
            {article.videoTitle}
          </Link>
        </CardTitle>

        <div className="flex flex-wrap gap-2">
          {article.assignedCategory ? (
            <Badge variant="secondary">{article.assignedCategory}</Badge>
          ) : null}
          {article.assignedLevel ? (
            <Badge variant="outline">{article.assignedLevel}</Badge>
          ) : null}
          {article.videoLength ? (
            <Badge variant="outline" className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {article.videoLength}
            </Badge>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground line-clamp-1">
          {article.channelName ?? "Unknown channel"}
          {article.publishedDate ? ` • ${article.publishedDate}` : ""}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <Link href={href} className="text-sm text-muted-foreground hover:underline">
          Open quiz &amp; vocabulary →
        </Link>
      </CardContent>
    </Card>
  );
}
