import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyPublicPage } from "./verify-page";
import { SITE_URL, articleCanonicalUrl } from "./urls";

const PAGE_SIZE = 1000;
// Reserve one URL for the homepage. Split sitemaps before exceeding this limit.
const MAX_ARTICLES = 49999;
type SitemapRow = { slug: string; last_modified: string | null; content_hash: string };

export async function loadSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const deadline = Date.now() + 25000;
    // Anonymous public data only: never attach cookies, user history, or a service key.
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(Math.max(1, Math.min(10000, deadline - Date.now()))) }) },
    });
    const entries: MetadataRoute.Sitemap = [{ url: SITE_URL }];
    const candidates: SitemapRow[] = [];
    const seen = new Set<string>();
    let after: string | null = null;
    while (true) {
      if (Date.now() >= deadline) throw new Error("Sitemap read timed out");
      const { data, error } = await supabase.rpc("get_sitemap_candidates", { p_after_slug: after, p_limit: PAGE_SIZE });
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
        if (typeof row.content_hash !== "string" || !/^[a-f0-9]{32}$/.test(row.content_hash)) throw new Error("Invalid fingerprint");
        candidates.push(row);
      }
      if (previous === after) throw new Error("Sitemap cursor did not advance");
      after = previous;
      if (data.length < PAGE_SIZE) break;
    }
    const reasons: Record<string, number> = {};
    // Bounded concurrency avoids a burst of public page requests. A cold cache
    // that cannot complete in budget fails, never publishes a truncated sitemap.
    for (let offset = 0; offset < candidates.length; offset += 4) {
      if (Date.now() >= deadline - 6000) throw new Error("Sitemap verification budget exceeded");
      const batch = candidates.slice(offset, offset + 4);
      const verdicts = await Promise.all(batch.map(row => verifyPublicPage(row.slug, row.content_hash)));
      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const verdict = verdicts[i];
        reasons[verdict] = (reasons[verdict] ?? 0) + 1;
        if (verdict === "eligible") entries.push({ url: articleCanonicalUrl(row.slug),
          ...(row.last_modified ? { lastModified: new Date(row.last_modified) } : {}) });
      }
    }
    console.info("[seo-sitemap]", JSON.stringify({ candidates: candidates.length, includedVideos: entries.length - 1, reasons }));
    return entries;
  } catch {
    // Never turn a DB error/missing migration into a successful homepage-only or
    // partial sitemap. Next's route revalidation retains the last good response.
    throw new Error("Sitemap is temporarily unavailable.");
  }
}
