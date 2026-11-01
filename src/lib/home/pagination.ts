import type { Metadata } from "next";
import type { HomeSearchParams } from "./types";
import { SITE_URL } from "@/lib/seo/urls";

// Page URLs are one-based; the existing infinite-scroll API stays zero-based.
export function homePageNumber(value: string | undefined): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= Math.floor(2147483647 / 24) ? page : null;
}

export function homePageHref(sp: HomeSearchParams, page: number): string {
  const params = new URLSearchParams();
  for (const key of ["q", "channel", "category", "level"] as const) {
    const value = typeof sp[key] === "string" ? sp[key].trim() : "";
    if (value && (key === "q" || value !== "all")) params.set(key, value);
  }
  if (sp.sort === "created_at") params.set("sort", sp.sort);
  if (sp.order === "asc") params.set("order", sp.order);
  if (sp.completion === "complete" || sp.completion === "incomplete") {
    params.set("completion", sp.completion);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function homeMetadata(sp: HomeSearchParams, page: number): Metadata {
  const canonical = `${SITE_URL}${homePageHref(sp, page)}`;
  const filtered = homePageHref(sp, 1) !== "/";
  const title = page === 1 ? "Sabacan365" : `English Learning Videos - Page ${page} | Sabacan365`;
  return {
    title,
    alternates: { canonical },
    openGraph: { title, url: canonical },
    // Keep the public default sequence indexable; avoid search/filter URL proliferation.
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
  };
}
