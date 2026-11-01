-- SEO-only, apply atomically and alone. Never use normal db push in this repo.
-- Listing defaults to automatic. Rights/evidence/snapshots are never modified.
alter table public.article_seo_reviews add column seo_listing text not null default 'automatic'
  check (seo_listing in ('automatic','excluded'));
-- Narrow indexes keep per-page canonical/learning checks bounded.
create index idx_categories_seo_source_slug on public.categories(video_id,slug);
create index idx_vocab_seo_slug_latest on public.vocab(slug,id desc);
grant select (seo_listing) on public.article_seo_reviews to sabacan_sitemap_reader;
-- Restricted internal role must see exclusions regardless of rights state.
-- Browser roles still have no direct SELECT or membership in this NOLOGIN role.
alter policy sitemap_function_read on public.article_seo_reviews using (true);

-- Match what the existing UI can render. Empty activities render existing
-- fallback messages; malformed objects that crash React are not publishable.
create function public.seo_page_data_valid(p_quiz jsonb,p_vocab jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb; choice jsonb; quizzes jsonb; words jsonb; field text;
begin
  quizzes := case when jsonb_typeof(p_quiz->'quiz')='array' then p_quiz->'quiz' else '[]'::jsonb end;
  words := case when jsonb_typeof(p_vocab->'vocabulary')='array' then p_vocab->'vocabulary' else '[]'::jsonb end;
  for item in select value from jsonb_array_elements(quizzes) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'question') is distinct from 'string'
      or jsonb_typeof(item->'answer') is distinct from 'string'
      or jsonb_typeof(item->'choices') is distinct from 'array' then return false; end if;
    for choice in select value from jsonb_array_elements(item->'choices') loop
      if jsonb_typeof(choice) is distinct from 'string' then return false; end if;
    end loop;
    if item ? 'explanation' and jsonb_typeof(item->'explanation') not in ('string','null') then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(words) loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'word') is distinct from 'string' then return false; end if;
    foreach field in array array['pronunciation','definition','example'] loop
      if item ? field and jsonb_typeof(item->field) not in ('string','null') then return false; end if;
    end loop;
  end loop;
  return true;
end $$;
revoke all on function public.seo_page_data_valid(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.seo_page_data_valid(jsonb,jsonb) to sabacan_sitemap_reader,service_role;

-- SECURITY INVOKER is essential: visibility comes from the requesting internal
-- reader's inherited anonymous content RLS, not from the view owner.
create view public.seo_public_article_inventory with (security_invoker = true) as
with quiz_rows as (
  select q.slug,count(*) as quiz_count,(jsonb_agg(q.quiz_json::jsonb)->0) as quiz_json
  from public.quiz q group by q.slug
), latest_vocab as (
  select distinct on (v.slug) v.slug,v.vocab_json::jsonb as vocab_json
  from public.vocab v order by v.slug,v.id desc
), checked as materialized (
  select c.slug,c.video_id,r.content_updated_at as last_modified,
    case
      when r.seo_listing='excluded' or r.status='excluded' then 'explicitly_excluded'
      when c.slug !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$' then 'invalid_slug'
      when c.video_id is null or c.video_id !~ '^[A-Za-z0-9_-]{11}$' then 'invalid_video_url'
      when c.video_title is null or length(btrim(c.video_title))=0 then 'missing_title'
      when q.quiz_count>1 then 'duplicate_quiz'
      when not public.seo_page_data_valid(q.quiz_json,v.vocab_json) then 'invalid_learning_data'
      else 'eligible'
    end as base_reason
  from public.categories c left join public.article_seo_reviews r on r.slug=c.slug
  left join quiz_rows q on q.slug=c.slug left join latest_vocab v on v.slug=c.slug
), ranked as (
  select checked.*,row_number() over(partition by video_id
    order by (base_reason='eligible') desc,slug collate "C") as source_rank
  from checked
)
select slug,video_id,last_modified,
  case when base_reason='eligible' and source_rank>1 then 'duplicate_video' else base_reason end as reason
from ranked;
revoke all on public.seo_public_article_inventory from public,anon,authenticated;
grant select on public.seo_public_article_inventory to sabacan_sitemap_reader,service_role;

-- New projection leaves the previous rights-scoped RPC untouched for rollback.
grant sabacan_sitemap_reader to current_user;
grant create on schema public to sabacan_sitemap_reader;
create function public.get_public_sitemap_articles(p_after_slug text default null,p_limit integer default 1000)
returns jsonb language sql stable security definer set search_path = '' as $$
  with page as materialized (
    select c.slug,c.video_id,c.video_title,r.content_updated_at as last_modified,
      r.seo_listing,r.status
    from public.categories c left join public.article_seo_reviews r on r.slug=c.slug
    where auth.uid() is null and (p_after_slug is null or c.slug collate "C">p_after_slug collate "C")
    order by c.slug collate "C" limit least(greatest(p_limit,1),1000)
  ), eligible as (
    select c.slug,c.last_modified from page c
    where c.slug ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$'
      and c.video_id ~ '^[A-Za-z0-9_-]{11}$' and length(btrim(c.video_title))>0
      and coalesce(c.seo_listing,'automatic')<>'excluded' and coalesce(c.status,'pending')<>'excluded'
      and (select count(*) from public.quiz q where q.slug=c.slug)<=1
      and public.seo_page_data_valid(
        (select q.quiz_json::jsonb from public.quiz q where q.slug=c.slug limit 1),
        (select v.vocab_json::jsonb from public.vocab v where v.slug=c.slug order by v.id desc limit 1))
      and not exists (
        select 1 from public.categories d left join public.article_seo_reviews r on r.slug=d.slug
        where d.video_id=c.video_id and d.slug collate "C"<c.slug collate "C"
          and d.slug ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$' and length(btrim(d.video_title))>0
          and coalesce(r.seo_listing,'automatic')<>'excluded' and coalesce(r.status,'pending')<>'excluded'
          and (select count(*) from public.quiz q where q.slug=d.slug)<=1
          and public.seo_page_data_valid(
            (select q.quiz_json::jsonb from public.quiz q where q.slug=d.slug limit 1),
            (select v.vocab_json::jsonb from public.vocab v where v.slug=d.slug order by v.id desc limit 1))
      )
  )
  select jsonb_build_object(
    'articles',coalesce((select jsonb_agg(jsonb_build_object('slug',slug,'last_modified',last_modified) order by slug collate "C") from eligible),'[]'::jsonb),
    'next_after_slug',(select max(slug collate "C") from page),
    'has_more',(select count(*) from page)=least(greatest(p_limit,1),1000));
$$;
alter function public.get_public_sitemap_articles(text,integer) owner to sabacan_sitemap_reader;
revoke create on schema public from sabacan_sitemap_reader;
revoke sabacan_sitemap_reader from current_user;
revoke all on function public.get_public_sitemap_articles(text,integer) from public,anon,authenticated;
grant execute on function public.get_public_sitemap_articles(text,integer) to anon;
do $$ begin
  if pg_catalog.has_schema_privilege('sabacan_sitemap_reader','public','CREATE')
    or pg_catalog.pg_has_role('anon','sabacan_sitemap_reader','USAGE')
    or pg_catalog.pg_has_role('authenticated','sabacan_sitemap_reader','USAGE')
    or pg_catalog.has_column_privilege('anon','public.article_seo_reviews','seo_listing','SELECT')
    or pg_catalog.has_table_privilege('anon','public.seo_public_article_inventory','SELECT')
  then raise exception 'Unexpected SEO permissions'; end if;
end $$;
