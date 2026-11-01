import { unstable_cache } from "next/cache";
import { articleCanonicalUrl } from "./urls";

export type PageVerdict = "eligible" | "http_not_200" | "canonical_mismatch" | "noindex" | "invalid_page_content";
const decode = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'");

export async function inspectPublicPage(slug: string): Promise<PageVerdict> {
  const canonical = articleCanonicalUrl(slug);
  // Fixed production origin, validated slug, no cookies/credentials and no redirects.
  const response = await fetch(canonical, {
    cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(6000),
    headers: { "User-Agent": "Sabacan365-SEO/1.0" },
  });
  // An outage must fail the refresh, not erase entries as if they were excluded.
  if (response.status >= 500 || response.status === 429 || response.status === 401 || response.status === 403) {
    throw new Error("Public page verification unavailable");
  }
  if (response.status !== 200) { await response.body?.cancel(); return "http_not_200"; }
  if (!response.headers.get("content-type")?.includes("text/html")) throw new Error("Unexpected page response");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty page response");
  let html = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 2 * 1024 * 1024) throw new Error("Page verification size limit");
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
  } finally { await reader.cancel(); }
  const tags = (name: string) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map(match =>
    Object.fromEntries([...match[0].matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map(attr => [attr[1].toLowerCase(), decode(attr[2])])));
  const links = tags("link").filter(tag => tag.rel === "canonical");
  if (links.length !== 1 || links[0].href !== canonical) return "canonical_mismatch";
  if (/\bnoindex\b/i.test(response.headers.get("x-robots-tag") ?? "") || tags("meta").some(tag =>
    /^(robots|googlebot)$/i.test(tag.name ?? "") && /\b(noindex|none)\b/i.test(tag.content ?? ""))) return "noindex";
  if (!/<main\b[^>]*class="[^"]*article-study-page/.test(html) || !/role="tablist"/.test(html)) return "invalid_page_content";
  return "eligible";
}

// Content fingerprint avoids carrying verification over to changed material.
// Stable key across deployments; cache per page, not thousands of HTTP reads per refresh.
export const verifyPublicPage = unstable_cache(
  async (slug: string, contentHash: string): Promise<PageVerdict> => {
    if (!/^[a-f0-9]{32}$/.test(contentHash)) throw new Error("Invalid content fingerprint");
    return inspectPublicPage(slug);
  }, ["seo-public-page-v1"], { revalidate: 3600 },
);
