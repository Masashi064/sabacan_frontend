import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getArticlePage } from "@/lib/home/homeService";
import type { HomeSearchParams } from "@/lib/home/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10) || 0);

  const sp: HomeSearchParams = {
    q: url.searchParams.get("q") ?? undefined,
    sort: (url.searchParams.get("sort") as HomeSearchParams["sort"]) ?? undefined,
    order: (url.searchParams.get("order") as HomeSearchParams["order"]) ?? undefined,
    channel: url.searchParams.get("channel") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    completion:
      (url.searchParams.get("completion") as HomeSearchParams["completion"]) ?? undefined,
  };

  const supabase = await supabaseServer();
  const { rows, hasMore, fetchError } = await getArticlePage(supabase, sp, page);

  if (fetchError) {
    return NextResponse.json({ error: fetchError }, { status: 500 });
  }

  const articles = rows.map((row) => ({
    slug: row.slug,
    videoTitle: row.video_title ?? row.slug,
    channelName: row.channel_name,
    thumbnailUrl: row.thumbnail_url,
    assignedCategory: row.assigned_category,
    assignedLevel: row.assigned_level,
    publishedDate: row.published_date,
    videoLength: row.video_length,
  }));

  return NextResponse.json({ rows: articles, hasMore });
}
