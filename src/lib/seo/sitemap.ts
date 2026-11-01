import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL, articleCanonicalUrl } from "./urls";

const PAGE_SIZE = 1000;
// Reserve one URL for the homepage. Split sitemaps before exceeding this limit.
const MAX_ARTICLES = 49999;
type SitemapRow = { slug: string; last_modified: string | null };

export async function loadSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const deadline = Date.now() + 25000;
    // Anonymous public data only: never attach cookies, user history, or a service key.
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(Math.max(1, Math.min(10000, deadline - Date.now()))) }) },
    });
    const entries: MetadataRoute.Sitemap = [{ url: SITE_URL }];
    const seen = new Set<string>();
    let after: string | null = null;
    while (true) {
      if (Date.now() >= deadline) throw new Error("Sitemap read timed out");
      const { data, error } = await supabase.rpc("get_sitemap_articles", { p_after_slug: after, p_limit: PAGE_SIZE });
      if (error || !Array.isArray(data) || data.length > PAGE_SIZE) throw new Error("Sitemap read failed");
      if (data.length === 0) break;
      let previous: string = after ?? "";
      for (const row of data as SitemapRow[]) {
        if (!row || typeof row.slug !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(row.slug)
          || row.slug < previous) throw new Error("Invalid sitemap row");
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
      if (previous === after) throw new Error("Sitemap cursor did not advance");
      after = previous;
      if (data.length < PAGE_SIZE) break;
    }
    return entries;
  } catch {
    // Never turn a DB error/missing migration into a successful homepage-only or
    // partial sitemap. Next's route revalidation retains the last good response.
    throw new Error("Sitemap is temporarily unavailable.");
  }
}
