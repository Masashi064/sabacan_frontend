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

## SEO operation: public videos are automatically eligible

`/sitemap.xml` retains its registered URL and one-hour cache. No per-video SEO
approval, XML editing, Cron or Google indexing API call is required. New videos
become eligible automatically. The sitemap exposes URLs and optional real update
times only: no transcript bodies, private reviews, or new transcript endpoint.
Existing public article UI and Auth/content RLS are unchanged.

Eligibility uses the anonymous content visibility of the restricted NOLOGIN /
NOBYPASSRLS `sabacan_sitemap_reader` role. It checks safe slug, syntactically valid
YouTube ID, title, renderable Quiz/latest Vocabulary, duplicate Quiz errors, and
one URL per source video. The lexicographically first eligible, non-excluded
slug is selected for duplicate videos. Empty learning activities use existing
page fallback messages; missing activities alone no longer require manual review.
YouTube availability by country or future video removal is not guaranteed by an
ID syntax check. Supabase deletion or loss of anonymous RLS visibility removes
eligibility on the next successful refresh.

`article_seo_reviews.seo_listing` is independent of `rights_approved`, evidence,
and rights snapshots. A missing review row or `automatic` means automatic SEO
eligibility; `excluded` always prevents listing. Legacy `status = 'excluded'`
continues to prevent listing too. Existing copyright records are never promoted
or marked verified by this policy. Rights investigation/removal remains separate.
Sitemap omission does not protect private data or resolve transcript reuse rights.

To explicitly exclude a page (authorized SQL Editor/DB operator only):

```sql
insert into public.article_seo_reviews(slug, seo_listing)
values ('ACTUAL_SLUG', 'excluded')
on conflict (slug) do update set seo_listing = 'excluded';
```

This does not change rights evidence or public access. For urgent removal of
content, use real access controls/removal, not only a sitemap cache. To restore
listing, set `seo_listing = 'automatic'` and also clear any legacy excluded status
with `status = 'pending'` after an actual operator decision.

The private `seo_public_article_inventory` view uses `security_invoker=true` to
preserve underlying RLS. Browser roles cannot read the view, review state or
evidence; the public `get_public_sitemap_articles` RPC returns only eligible
slug/update information, with empty search_path and a restricted definer owner.
Authenticated subjects return no rows even if they inherit anon EXECUTE.

The generator and metadata share `articleCanonicalUrl`. Its RPC returns only
eligible entries plus a source cursor; excluded/empty batches still advance.
It uses 1,000-row keyset
batches, a 50-second generation budget, and a 49,999-video ceiling plus homepage (split XML before that limit).
No full-catalog self-HTTP requests run during sitemap generation: this avoids
thousands of requests and cold-cache timeouts on every refresh. DB validation
mirrors renderability of existing pages; the full HTTP audit below checks actual
responses and Canonicals separately. DB errors/deadline failures never publish a
successful empty/partial sitemap. A failed refresh retains the last good cache;
a cold-cache failure is an error. New entries/removals depend on successful cache
refresh; revalidation is request-driven, not a strict one-hour deadline.

`pnpm seo:report` uses existing linked CLI authentication and prints total,
eligible, exclusion-reason and independent rights counts, never private evidence
or credentials. SQL: `supabase/seo_report.sql`. It is an on-demand diagnostic,
not a daily operation. `[seo-sitemap]` Vercel logs record actual included counts.

`pnpm seo:audit:pages` checks every current XML video URL's real HTTP 200,
Canonical, robots tags and learning UI. `-- --catalog` audits the entire public
catalog instead. It can take time; it does not persist page bodies or transcripts,
only slug/verdict results under the system temporary directory. Use
`pnpm seo:audit:pages -- --retry-failed` to recheck failures from that report. Network errors
must be retried and distinguished from definitive invalid pages before excluding
anything. `pnpm seo:audit:crawl` checks the whole SSR pagination chain against the
anonymous catalog; a stable catalog during either full audit is required.

Home `/`, `/?page=2`, etc. retain 24-row SSR pages, ordinary hrefs and infinite
scroll. Public default pages have self Canonicals; search/filter variants remain
noindex/follow. Individual article robots rules are unchanged. Existing URL
structure and recommendations/learning functions are untouched. The already
submitted sitemap URL and robots.txt announcement are sufficient for ordinary
operation; do not request indexing for every new video. Google decides indexing.

### SEO SQL deployment and legacy migration protection

Do NOT run normal `supabase db push` in production. The eleven older migrations
were manually executed and their CLI history is incomplete; do not replay or
repair them for SEO work. Their original names and bytes are unchanged.

The SEO-only migrations are `20261101090000`, `20261101120000`, and
`20261101150000`, in that dependency order. Apply each new file alone through an
authenticated connection, atomically inside BEGIN/COMMIT, after checking object
absence, backup and restore access. Never replay an already applied file. After
verification, register ONLY the specific new version using migration repair.
This release adds an SEO-only column/functions/view and two narrow indexes for
source-video lookup and latest Vocabulary. It does not approve rights, seed
review rows, write learning content or modify content RLS/Auth.

Latest preflight verified completed physical backups; PITR is disabled. Failed
DDL transactions roll back fully. App rollback can retain additive SEO objects;
the previous rights-scoped RPCs are retained for compatibility. A physical restore
is an emergency maintenance operation with possible loss since backup, not a
routine rollback. Never reset production to recover SEO changes.

Run `pnpm test:seo:public`, `pnpm test:sitemap`, `pnpm test:sitemap:sql`,
`pnpm test:seo:auto`, and existing metadata/pagination/learning tests. For deployed
HTTP tests set `SEO_TEST_BASE_URL=https://sabacan365.com` explicitly.

### Deferred non-SEO issues

`get_recommended_articles(integer)` differs from later recommendation migrations;
`_ach_unlock` has anonymous EXECUTE privileges. Neither is modified or invoked
for write testing here. Coin/Achievement behavior and old migration reconciliation
remain separate tasks. Do not claim legacy migrations bootstrap a fresh database.
