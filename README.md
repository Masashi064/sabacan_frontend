This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## SEO Phase 2A: sitemap approvals

Apply `supabase/migrations/20261101_seo_sitemap_reviews.sql` in Supabase SQL Editor
before enabling the new sitemap in production. It adds only `article_seo_reviews`
and the `get_sitemap_articles` RPC; existing content tables and RLS are unchanged.
No videos are seeded or approved automatically. With a successful empty review
query, the XML contains the homepage only (zero videos). A missing migration or
DB failure raises an error, never a successful empty/partial sitemap.

An authorized database operator must verify public access, learning quality, and
rights for the currently published material, then record evidence and a review
time before setting `status = 'approved'`, `public_access_confirmed = true`,
`quality_approved = true`, and `rights_approved = true`. Do not approve content
merely because captions exist. Target 20–50 videos only when that many have been
reviewed. `pending` and `excluded` rows are not sitemap entries and do not change
an article's robots metadata or access permissions. Re-review after content or
rights change; publishing/import tools must revoke stale approvals as part of
that workflow. Automated content-change invalidation is not included here.

Review evidence is private: anonymous/authenticated users can read only the
approved rows' non-sensitive columns and cannot write reviews. The sitemap uses
an anonymous cookie-free client and a SECURITY INVOKER RPC, preserving RLS on
content tables. The RPC also checks that a video/title and usable Quiz or latest
Vocabulary exist. Transcript bodies are not downloaded to generate XML.

Use `content_updated_at` only for a known significant page-content update. Leave
it NULL when unknown; review time, import time, and YouTube publication time are
not substitutes for `lastmod`. Existing article metadata and XML use the same
Canonical helper. No redirects or slug changes are introduced.

The sitemap cache refreshes on the first request after one hour. New approvals,
revocations, and changed content can take until cache refresh to appear. A failed
refresh retains the last good cached data; a cold-cache failure returns an error.
Only complete successful reads are cached. Queries use 1,000-row keyset batches,
a 25-second generation budget, and a 49,999-video safety ceiling (plus homepage).
Split sitemaps before exceeding that ceiling. No API keys or raw DB errors are
included in responses.

`/robots.txt` allows public pages and rendering assets, disallows `/api/`, and
points to `/sitemap.xml`. It is not access control or a noindex directive. No
existing article is newly marked noindex. Sitemap omission also does not stop
indexing or resolve unverified transcript republication/reuse rights.

Run `pnpm test:sitemap` and `pnpm test:sitemap:sql`. After deployment, run
`SEO_TEST_BASE_URL=https://sabacan365.com pnpm test:sitemap:http` to validate XML,
robots, and each listed URL's status and Canonical. This HTTP check does not
itself establish rights or learning quality; those require the review records.
