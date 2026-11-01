import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { loadSitemap } from "@/lib/seo/sitemap";

// Avoid a build-time dependency on DB availability. Only eligible public URLs
// enter this shared data cache; no cookies or authenticated data are read.
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const getCachedSitemap = unstable_cache(loadSitemap, ["public-default-article-sitemap-v3"], { revalidate: 3600 });

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getCachedSitemap();
}
