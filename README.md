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

An authorized database operator must verify public access, learning quality, and
rights for the currently published material, then record evidence and a review
time before setting `status = 'approved'`, `public_access_confirmed = true`,
`quality_approved = true`, and `rights_approved = true`. Do not approve content
merely because captions exist. Target 20–50 videos only when that many have been
reviewed. `pending` and `excluded` rows are not sitemap entries and do not change
an article's robots metadata or access permissions. Re-review after content or
rights change; publishing/import tools must revoke stale approvals as part of
that workflow. Automated content-change invalidation is not included here.

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

### Phase 2A production migration gate

The original un-applied `20261101_seo_sitemap_reviews.sql` was renamed to
`20261101090000_seo_sitemap_reviews.sql`: its old version collided with the Ask AI
migration. Several older files also share `20260625`. Do not rename or repair
those old files based only on their filenames; compare remote migration history
and actual database objects first. No production migration has been applied by
this implementation.

Use an authenticated Supabase CLI and the verified production connection:

```bash
supabase migration list --db-url "$SUPABASE_DB_URL"
supabase db push --db-url "$SUPABASE_DB_URL" --dry-run
```

These are inspection commands only. Do not run `db push`, `--include-all`,
`db reset`, `migration up`, or history repair until the pending migration list
has been reconciled and the exact execution set reviewed and reported. Expected new execution
set is ONLY `20261101090000_seo_sitemap_reviews.sql`, with no seed approvals.
Use `supabase/seo_preflight.sql` to inspect existing objects, permissions, content
schema/RLS, and the existence of the migration history table. Compare policies
before/after; do not paste connection passwords into chat or commit them.

If SQL Editor is required, run the exact reviewed migration inside one explicit
`BEGIN` / `COMMIT` transaction after checking that its new objects do not already
exist. If statements fail, `ROLLBACK`; do not continue a partial application.
Verify schema, function owner/search_path, permissions, existing content RLS, and
anonymous RPC results before marking ONLY the new version as applied:

```bash
supabase migration repair 20261101090000 --status applied --db-url "$SUPABASE_DB_URL"
supabase migration list --db-url "$SUPABASE_DB_URL"
```

`migration repair` records history; it does not execute the migration. Never mark
other migrations applied without comparing their effects to the live schema. If
history recording fails after manual application, report that split state and do
not rerun CREATE statements or deploy blindly. Confirm database changes and
history before pushing the app commit that enables sitemap generation.

The RPC now uses SECURITY DEFINER under `sabacan_sitemap_reader`, a dedicated
NOLOGIN/NOBYPASSRLS role inheriting only anon content access. It has read-only
access to approved review projections, not evidence, and cannot create public
objects after setup. General users have no table or column access to review
states/evidence. Public EXECUTE is revoked; anon/authenticated receive EXECUTE
only on the fixed, parameterized URL projection. No dynamic SQL is used. The
function has an empty search_path and fully qualified table references. Function-local
JWT claims are fixed to anon (with no user ID) and restored on exit, so even an
authenticated caller cannot widen the public projection via auth.uid(). No
existing content policies or ownership are changed.

Security Advisor may flag 0028/0029 because anon/authenticated can execute this
SECURITY DEFINER function. The intentional public projection must be reviewed
against its restricted owner, return fields, and permissions; do not suppress the
finding without inspection. Search-path mutability (0011) is addressed explicitly.
Run the actual Advisor after deployment; local PostgreSQL tests are not an Advisor
report. An unused-index observation may occur before sitemap traffic starts.

Before approving the first 20–50 videos, verify each exact slug, anonymous HTTP
200 and Canonical, functioning video, quiz/vocabulary accuracy, and permission
for currently published transcript/learning-material reuse. Record concrete
sources/permission evidence and the review date privately. Approve only exact
reviewed slugs, in an administrator transaction: rehearse with ROLLBACK, compare
approved count and RPC projection, then COMMIT the verified batch. Never use an
unqualified UPDATE, blanket channel approval, or a target-count-driven approval.
Do not seed fake approvals in production to test the approved/error cases; use
an isolated test database, and test production approved rows only once genuinely
reviewed material exists. Sitemap omission does not resolve publication rights.
