export const SITE_URL = "https://sabacan365.com";

// Shared by article metadata and sitemap; keep existing slugs and URL structure.
export function articleCanonicalUrl(slug: string): string {
  return `${SITE_URL}/articles/${encodeURIComponent(slug)}`;
}
