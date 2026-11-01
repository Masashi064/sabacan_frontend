import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL, articleCanonicalUrl } from "./urls";

const PAGE_SIZE = 1000;
// Reserve one URL for the homepage. Split sitemaps before exceeding this limit.
const MAX_ARTICLES = 49999;
type SitemapBatch = { articles: unknown; has_more: unknown; next_after_slug: unknown };
type SitemapRow = { slug: string; last_modified: string | null };

export async function loadSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const deadline = Date.now() + 50000;
    // Anonymous public data only: never attach cookies, user history, or a service key.
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(Math.max(1, Math.min(10000, deadline - Date.now()))) }) },
    });
    // Explicit boundary avoids coupling PostgREST generic inference to the loop cursor.
    const readBatch = async (cursor: string | null): Promise<{ data: SitemapBatch | null; error: unknown }> =>
      supabase.rpc("get_public_sitemap_articles", { p_after_slug: cursor, p_limit: PAGE_SIZE });
    const entries: MetadataRoute.Sitemap = [{ url: SITE_URL }];
    const seen = new Set<string>();
    let after: string | null = null;
    while (true) {
      if (Date.now() >= deadline) throw new Error("Sitemap read timed out");
      const response = await readBatch(after);
      const data: SitemapBatch | null = response.data;
      const error: unknown = response.error;
      if (error || !data || !Array.isArray(data.articles) || data.articles.length > PAGE_SIZE
        || typeof data.has_more !== "boolean") throw new Error("Sitemap read failed");
      const rows = data.articles as SitemapRow[];
      const cursor: unknown = data.next_after_slug;
      if (cursor === null) {
        if (rows.length || data.has_more) throw new Error("Invalid empty sitemap batch");
        break;
      }
      if (typeof cursor !== "string" || !cursor || (after !== null && cursor <= after)) throw new Error("Invalid sitemap cursor");
      let previous: string = after ?? "";
      for (const row of rows) {
        if (!row || typeof row.slug !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(row.slug)
          || row.slug < previous || row.slug > cursor) throw new Error("Invalid sitemap row");
        previous = row.slug;
        const url = articleCanonicalUrl(row.slug);
        if (seen.has(url)) continue;
        seen.add(url);
        if (seen.size > MAX_ARTICLES) throw new Error("Split sitemap required");
        const modified = row.last_modified;
        if (modified !== null && (typeof modified !== "string" || !Number.isFinite(Date.parse(modified))
          || Date.parse(modified) > Date.now())) throw new Error("Invalid sitemap timestamp");
        entries.push({ url, ...(modified ? { lastModified: new Date(modified) } : {}) });
      }
      after = cursor;
      if (!data.has_more) break;
    }
    console.info("[seo-sitemap]", JSON.stringify({ includedVideos: entries.length - 1, policy: "public-default" }));
    return entries;
  } catch {
    // Never turn a DB error/missing migration into a successful homepage-only or
    // partial sitemap. Next's route revalidation retains the last good response.
    throw new Error("Sitemap is temporarily unavailable.");
  }
}
