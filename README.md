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

Apply `supabase/migrations/20261101090000_seo_sitemap_reviews.sql` using the
verified CLI workflow below before enabling the sitemap in production. It adds
the review table/index, a restricted reader role, and the sitemap RPC. Existing
content tables and RLS are unchanged. SQL Editor is a fallback only.
No videos are seeded or approved automatically. With a successful empty review
query, the XML contains the homepage only (zero videos). A missing migration or
DB failure raises an error, never a successful empty/partial sitemap.

An authorized operator must record explicit public/reuse rights evidence covering
all published learning material, including captions. Automatic eligibility now
uses `rights_approved`, `reviewed_at`, and a content fingerprint; it does not
require a separate manual listing/public/quality approval. `status = 'excluded'`
always prevents listing. Neither pending nor sitemap omission changes article
robots metadata or access permissions. No permission is inferred from YouTube
availability, channel names, caption presence, or page quality.

Review evidence is private: anonymous/authenticated users can read public
URL information only through the RPC, cannot read review states/evidence, and
cannot write reviews. The sitemap uses an anonymous cookie-free client. Its
SECURITY DEFINER RPC is owned by a dedicated NOLOGIN/NOBYPASSRLS role inheriting
only anon content access; it preserves RLS on content tables. The RPC also checks
that a video/title and usable Quiz or latest Vocabulary exist. Transcript bodies
are not downloaded to generate XML.

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

### SEO-only deployment and legacy migrations

Do NOT run a normal `supabase db push` against production in this repository.
The eleven older SQL files were manually executed in SQL Editor, and are not
tracked by the CLI migration history. Their original names and SQL bytes are
preserved, including duplicate legacy version prefixes. Do not re-run them,
repair their history, or use `--include-all` as part of an SEO deployment.

Apply ONLY `20261101090000_seo_sitemap_reviews.sql` through an authenticated DB
connection/SQL Editor, inside an explicit BEGIN/COMMIT transaction. Inspect
`supabase/seo_preflight.sql`, verify target objects are absent, and confirm a
completed physical backup and restore access first. On any SQL error, ROLLBACK.
Never continue partial DDL. After verifying the new objects and permissions,
record ONLY this version with:

```bash
supabase migration repair 20261101090000 --status applied --linked
supabase migration list --linked
```

The expected remote history contains only the SEO version. This deliberately
leaves unrelated historical migration bookkeeping unresolved. No old migration
is being represented as applied by this release. No approval rows are seeded.

The RPC uses SECURITY DEFINER under `sabacan_sitemap_reader`, a dedicated
NOLOGIN/NOBYPASSRLS role inheriting only anon content access. It has read-only
access to approved review projections, not evidence, and cannot create public
objects after setup. General users have no direct access to review states or
evidence. PUBLIC and explicit authenticated EXECUTE are revoked; execution is granted to
anon only. An existing authenticated-to-anon inheritance may still confer EXECUTE,
but the function returns no rows for any non-null auth.uid(). No dynamic SQL is used. Empty search_path and fully
qualified table references prevent object substitution. The query additionally
requires auth.uid() IS NULL; it never changes request JWT settings. Existing content policies and ownership are unchanged.

Security Advisor can flag 0028/0029 for this intentionally public definer RPC;
review the restricted owner, grants, and return fields rather than hiding the
finding. Search-path mutability is explicitly addressed. A cold DB error fails
sitemap generation; successful cached data is never replaced by a partial read.

Recovery: a failed transaction leaves no partial SEO objects. If the app release
fails after DB success, roll the Vercel app back to Phase 1 and retain the new,
additive DB objects and any review evidence. Full physical-backup restoration
requires a maintenance window and may lose changes since the backup (PITR was
not enabled at preflight); it is an emergency option, not a routine rollback.
Never reset production or remove existing content/Auth/RLS for SEO recovery.

### Deferred non-SEO issues

Production `get_recommended_articles(integer)` matches the initial recommendation
function, not the later category/history/reason-label revisions. Its definition
has not been modified by this SEO release. `_ach_unlock` also has anonymous
EXECUTE privileges; review that internal helper's access separately. No write
RPC was invoked to test exploitation and no Coin/Achievement behavior changed.
A complete fresh-environment baseline and legacy migration-history reconciliation
remain separate projects; do not claim the eleven files bootstrap an empty DB.

## SEO Phase 2B: crawlable video pages

`/` serves the first 24 videos; `/?page=2`, `/?page=3`, etc. serve subsequent
24-row windows from the same RLS-scoped query as infinite scroll. Normal
previous/next links work without JavaScript. The grid is resolved before
streaming (the homepage loading boundary was removed), so the cards and
navigation are visible without client script execution. Recommendations remain
independently streamed and their RPC is unchanged.

Ordering uses the selected date with nulls last, then unique slug ascending to
stabilize ties. Infinite scroll starts after the requested SSR page and removes
duplicate slugs on append. No snapshot tables or DB changes were added. As with
ordinary offset pagination, concurrent catalog inserts/deletes can shift later
windows; page requests do not promise a frozen catalog.

Each default public page has a self Canonical. Search, filter, completion and
alternative-sort variants have noindex/follow and normalized self Canonicals;
this does not apply noindex to individual videos. Filter changes start at page 1.
Only approved videos appear in the sitemap; normal public browsing remains
available for the existing catalog.

Run `pnpm test:pagination` and, against a production build on port 3115,
`pnpm test:pagination:http`. Set `SEO_TEST_BASE_URL` explicitly for production.
The HTTP checks inspect server HTML, three disjoint 24-video windows, bot parity,
sequential hrefs, Canonicals, and filtered noindex variants. Browser checks must
add JavaScript-disabled navigation, responsive layout, infinite scroll from a
non-first page, and existing learning-tab interactions.

## Automatic SEO operation

`20261101120000_seo_automatic_eligibility.sql` is an SEO-only follow-up. Apply it
alone inside BEGIN/COMMIT after checking backups, then record only its own ID;
never use normal db push or repair old migration history. It adds a private
rights fingerprint column/trigger and restricted helpers, and updates only SEO
RPCs/policy. It does not add content-table triggers, change content RLS/Auth, or
seed approvals. Physical restore remains the emergency recovery option; PITR is
disabled. For app rollback, retain SEO objects/evidence; the old URL-only RPC is
preserved. Never replay either SQL file over existing objects.

Routine flow (no Cron, Google API calls, or external service):

1. New public videos are automatically reachable through SSR pages/normal links.
2. Rights-unknown videos are held out of XML, without new article noindex tags.
3. An operator/authorized importer records an actual rights verification once:

```sql
-- Replace placeholders only AFTER checking evidence for the current material.
insert into public.article_seo_reviews
  (slug, rights_approved, reviewed_at, review_evidence)
values ('REVIEWED_SLUG', true, now(), 'ACTUAL_PERMISSION_REFERENCE_AND_SCOPE')
on conflict (slug) do update set rights_approved = true,
  reviewed_at = excluded.reviewed_at, review_evidence = excluded.review_evidence;
```

This is not a recommendation to approve unknown videos. The importer may write
this record only from a verified permission/licence source; no channel-name
allowlist or blanket approval exists. An intentionally excluded row stays
excluded until an operator explicitly removes that exclusion. The trigger binds
rights evidence to the exact video/title, Quiz, latest Vocabulary, and captions.
Any change invalidates that snapshot without changing learning content. Recheck
rights and update evidence/review time to accept changed material. Existing
legacy reviews without snapshots need re-verification, never automatic backfill.

4. The SQL checks public RLS visibility, valid slug/video ID/title, unique source
video, nonduplicated Quiz rows, and usable Quiz/latest Vocabulary. The generator
then checks actual anonymous HTTP 200, exact Canonical and absence of noindex;
only eligible pages enter XML. A valid video ID is a syntactic YouTube URL check,
not a guarantee that YouTube will continue playing it in every country.
5. Deletion/RLS unpublishing, explicit exclusion, revoked rights, changed material,
or failed quality removes eligibility. The one-hour sitemap cache is unchanged.
Transient DB/network/429/5xx failures fail refresh and retain last good XML; cold
failures are errors, not successful empty XML. Cached entries can remain until
successful refresh; use access control for urgent content removal.

Page checks use four concurrent reads, per-page/content-fingerprint cache (one
hour), six-second requests and a two-MB response cap. Generation has a 25-second
budget. Large simultaneous permission imports can require repeated refreshes to
warm per-page checks; an incomplete pass is never published. Keep initial rights
activation in reviewed batches rather than unbounded cold-cache activation.
The SQL/report safety bound is 50,000 catalog rows; split/extend this before the
catalog reaches that size. The existing XML ceiling remains 49,999 videos.

`pnpm seo:report` uses existing linked Supabase CLI authentication and the private
read-only `supabase/seo_report.sql`. It reports counts by reason, never evidence,
user data or credentials. `rights_unverified`, `rights_content_changed`,
`rights_snapshot_missing`, `missing_or_invalid_learning_content`, `duplicate_video`, and
explicit exclusions are distinguishable. Reasons are first-failure categories,
not independent counts. Deleted videos with retained reviews are reported too.
DB `eligible` counts are candidates; the Vercel `[seo-sitemap]` structured log
reports actual included count and HTTP/Canonical/noindex exclusions. The report
is available on demand, not a daily manual SEO task and not a public admin API.

`pnpm seo:audit:crawl` performs an optional read-only full crawl of every public
page and compares it with the anonymous catalog, including final-page links,
unique slugs, Canonicals and robots tags. A stable catalog during the audit is
required (ordinary offset pagination does not freeze concurrent imports).

The existing submitted `https://sabacan365.com/sitemap.xml` URL is retained and
advertised by robots.txt. Do not resubmit it or request indexing for every new
video. Search Console monitoring is optional; discovery/indexing is Google's
decision, not guaranteed by this automation.
