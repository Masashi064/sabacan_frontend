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
revoke all on public.article_seo_reviews from anon, authenticated;
-- No browser writes. Approval is performed by an authorized DB operator.
grant all on public.article_seo_reviews to service_role;
grant select (slug, status, public_access_confirmed, quality_approved,
  rights_approved, reviewed_at, content_updated_at)
  on public.article_seo_reviews to anon, authenticated;
create policy sitemap_approved_read on public.article_seo_reviews
  for select to anon, authenticated
  using (status = 'approved' and public_access_confirmed and quality_approved
    and rights_approved and reviewed_at is not null);

-- SECURITY INVOKER preserves RLS on categories, quiz, and vocab. No service-role
-- client or per-user session is used by the sitemap route.
create function public.get_sitemap_articles(p_after_slug text default null, p_limit integer default 1000)
returns table (slug text, last_modified timestamptz)
language sql stable security invoker set search_path = '' as $$
  select r.slug, r.content_updated_at
  from public.article_seo_reviews r
  join public.categories c on c.slug = r.slug
  where r.status = 'approved' and r.public_access_confirmed
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
revoke all on function public.get_sitemap_articles(text, integer) from public;
grant execute on function public.get_sitemap_articles(text, integer) to anon, authenticated;
