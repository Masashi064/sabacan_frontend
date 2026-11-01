-- No seed approvals: rights/quality cannot be inferred from available captions.
-- Existing tables, their policies, and article indexability are unchanged.
create table public.article_seo_reviews (
  slug text primary key check (slug ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'excluded')),
  public_access_confirmed boolean not null default false,
  quality_approved boolean not null default false,
  rights_approved boolean not null default false,
  reviewed_at timestamptz,
  -- Private evidence must cover the currently published learning material,
  -- including transcript republication/reuse where applicable.
  review_evidence text not null default '',
  -- A real significant page-content update time, not approval/import time.
  content_updated_at timestamptz,
  constraint approval_requires_review check (
    status <> 'approved' or (
      public_access_confirmed and quality_approved and rights_approved
      and reviewed_at is not null and length(btrim(review_evidence)) > 0
    )
  )
);
create index article_seo_reviews_approved_slug
  on public.article_seo_reviews (slug collate "C")
  where status = 'approved' and public_access_confirmed and quality_approved
    and rights_approved and reviewed_at is not null;
alter table public.article_seo_reviews enable row level security;
revoke all on public.article_seo_reviews from public, anon, authenticated;
grant all on public.article_seo_reviews to service_role;

-- A dedicated function owner can read approved review projections and the same
-- content as anon, but cannot log in, bypass RLS, write reviews, or create objects.
-- Do not grant this role to anon/authenticated (membership is one-way).
create role sabacan_sitemap_reader nologin inherit nobypassrls;
grant anon to sabacan_sitemap_reader;
grant usage on schema public to sabacan_sitemap_reader;
grant select (slug, status, public_access_confirmed, quality_approved,
  rights_approved, reviewed_at, content_updated_at)
  on public.article_seo_reviews to sabacan_sitemap_reader;
create policy sitemap_function_read on public.article_seo_reviews
  for select to sabacan_sitemap_reader
  using (status = 'approved' and public_access_confirmed and quality_approved
    and rights_approved and reviewed_at is not null);

-- Temporarily allow assigning ownership to the non-login reader role. Remove
-- both grants immediately after ownership transfer in this same transaction.
grant sabacan_sitemap_reader to current_user;
grant create on schema public to sabacan_sitemap_reader;

-- SECURITY DEFINER reads the private review projection using a restricted,
-- non-bypass owner. Content-table RLS still applies through inherited anon.
create function public.get_sitemap_articles(p_after_slug text default null, p_limit integer default 1000)
returns table (slug text, last_modified timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select r.slug, r.content_updated_at
  from public.article_seo_reviews r
  join public.categories c on c.slug = r.slug
  where auth.uid() is null and r.status = 'approved' and r.public_access_confirmed
    and r.quality_approved and r.rights_approved and r.reviewed_at is not null
    and c.video_id ~ '^[A-Za-z0-9_-]{11}$'
    and length(btrim(c.video_title)) > 0
    and (p_after_slug is null or r.slug collate "C" > p_after_slug collate "C")
    and (select count(*) from public.quiz q0 where q0.slug = c.slug) <= 1
    and (
      exists (
        select 1 from public.quiz q where q.slug = c.slug
        and case when jsonb_typeof(q.quiz_json::jsonb -> 'quiz') = 'array'
          then jsonb_array_length(q.quiz_json::jsonb -> 'quiz') > 0 else false end
      )
      or exists (
        select 1 from public.vocab v where v.slug = c.slug
        -- Match the latest vocabulary row used by the actual article page.
        and v.id = (select max(v2.id) from public.vocab v2 where v2.slug = c.slug)
        and case when jsonb_typeof(v.vocab_json::jsonb -> 'vocabulary') = 'array'
          then jsonb_array_length(v.vocab_json::jsonb -> 'vocabulary') > 0 else false end
      )
    )
  order by r.slug collate "C"
  limit least(greatest(p_limit, 1), 1000);
$$;
alter function public.get_sitemap_articles(text, integer) owner to sabacan_sitemap_reader;
revoke create on schema public from sabacan_sitemap_reader;
revoke sabacan_sitemap_reader from current_user;
revoke all on function public.get_sitemap_articles(text, integer) from public, anon, authenticated;
grant execute on function public.get_sitemap_articles(text, integer) to anon;

-- Fail safely if inherited/default privileges differ from the expected model.
-- Run the migration atomically (CLI transaction or explicit SQL Editor BEGIN).
do $$
begin
  if pg_catalog.has_schema_privilege('sabacan_sitemap_reader', 'public', 'CREATE')
    or pg_catalog.pg_has_role('anon', 'sabacan_sitemap_reader', 'USAGE')
    or pg_catalog.pg_has_role('authenticated', 'sabacan_sitemap_reader', 'USAGE')
    or pg_catalog.has_column_privilege('anon', 'public.article_seo_reviews', 'status', 'SELECT')
    or pg_catalog.has_column_privilege('authenticated', 'public.article_seo_reviews', 'status', 'SELECT')
  then
    raise exception 'Unexpected inherited privileges; stop and review before deploying the sitemap.';
  end if;
end;
$$;
