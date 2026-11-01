import Link from "next/link";
import { homePageHref } from "@/lib/home/pagination";
import type { HomeSearchParams } from "@/lib/home/types";

export function Pagination({ page, totalPages, searchParams }: {
  page: number;
  totalPages: number;
  searchParams: HomeSearchParams;
}) {
  if (totalPages <= 1) return null;
  const linkClass = "rounded-md border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <nav aria-label="Video pages" className="flex flex-wrap items-center justify-center gap-3">
      {page > 1 ? (
        <Link prefetch={false} href={homePageHref(searchParams, page - 1)} rel="prev" className={linkClass}>
          Previous
        </Link>
      ) : null}
      <span className="text-sm text-muted-foreground" aria-current="page">Page {page} of {totalPages}</span>
      {page < totalPages ? (
        <Link prefetch={false} href={homePageHref(searchParams, page + 1)} rel="next" className={linkClass}>
          Next
        </Link>
      ) : null}
      {page > 2 ? <Link prefetch={false} href={homePageHref(searchParams, 1)} className={linkClass}>First page</Link> : null}
    </nav>
  );
}
