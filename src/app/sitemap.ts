import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { loadSitemap } from "@/lib/seo/sitemap";

// Avoid a build-time dependency on DB availability. Only public, reviewed URLs
// enter this shared data cache; no cookies or authenticated data are read.
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const getCachedSitemap = unstable_cache(loadSitemap, ["approved-article-sitemap-v1"], { revalidate: 3600 });

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getCachedSitemap();
}
