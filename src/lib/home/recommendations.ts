import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArticleCardData } from "@/components/ArticleCard";

export type RecommendedArticle = ArticleCardData & { reason: string };

type RecommendedArticleRow = {
  slug: string;
  video_id: string | null;
  assigned_category: string | null;
  assigned_level: string | null;
  published_date: string | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  video_title: string | null;
  video_length: string | null;
  reason: string;
  score: number;
};

// Failures here must never break the rest of the home page — recommendations
// are an enhancement, not a hard dependency.
export async function getRecommendedArticles(
  supabase: SupabaseClient,
  limit = 20
): Promise<RecommendedArticle[]> {
  const { data, error } = await supabase.rpc("get_recommended_articles", {
    p_limit: limit,
  });

  if (error) {
    console.error("[recommendations] get_recommended_articles RPC failed:", error.message);
    return [];
  }

  return ((data ?? []) as RecommendedArticleRow[]).map((row) => ({
    slug: row.slug,
    videoTitle: row.video_title ?? row.slug,
    channelName: row.channel_name,
    thumbnailUrl: row.thumbnail_url,
    assignedCategory: row.assigned_category,
    assignedLevel: row.assigned_level,
    publishedDate: row.published_date,
    videoLength: row.video_length,
    reason: row.reason,
  }));
}
