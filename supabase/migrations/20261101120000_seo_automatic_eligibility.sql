-- SEO-only. Apply this file atomically, NOT with db push (legacy history is incomplete).
-- No existing content/Auth/RLS changes and no seed approvals.
alter table public.article_seo_reviews add column rights_content_hash text;
alter table public.article_seo_reviews add constraint rights_require_evidence
  check (not rights_approved or (reviewed_at is not null and length(btrim(review_evidence)) > 0));

-- Invoker permissions preserve content RLS. Hashes bind explicit rights evidence
-- to the exact video, learning material and captions; never infer permission.
create function public.seo_content_hash(p_slug text) returns text
language sql stable set search_path = '' as $$
  select md5(jsonb_build_array(c.video_id, c.video_title,
    (select jsonb_agg(q.quiz_json::jsonb order by q.quiz_json::text) from public.quiz q where q.slug=c.slug),
    (select v.vocab_json::jsonb from public.vocab v where v.slug=c.slug order by v.id desc limit 1),
    (select jsonb_agg(jsonb_build_array(t.vtt_text,t.transcript_json) order by t.vtt_text,t.transcript_json::text)
      from public.captions t where t.slug=c.slug))::text)
  from public.categories c where c.slug=p_slug;
$$;
revoke all on function public.seo_content_hash(text) from public,anon,authenticated;
grant execute on function public.seo_content_hash(text) to sabacan_sitemap_reader,service_role;

create function public.seo_capture_rights_snapshot() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not new.rights_approved then
    new.rights_content_hash := null;
  elsif TG_OP = 'INSERT' then
    new.rights_content_hash := public.seo_content_hash(new.slug);
  elsif not old.rights_approved or new.slug is distinct from old.slug
    or new.reviewed_at is distinct from old.reviewed_at
    or new.review_evidence is distinct from old.review_evidence then
    new.rights_content_hash := public.seo_content_hash(new.slug);
  else
    new.rights_content_hash := old.rights_content_hash;
  end if;
  return new;
end;
$$;
revoke all on function public.seo_capture_rights_snapshot() from public,anon,authenticated;
create trigger seo_capture_rights_snapshot before insert or update on public.article_seo_reviews
for each row execute function public.seo_capture_rights_snapshot();

grant select (rights_content_hash) on public.article_seo_reviews to sabacan_sitemap_reader;
alter policy sitemap_function_read on public.article_seo_reviews
using (status in ('pending','approved') and rights_approved and reviewed_at is not null and rights_content_hash is not null);

-- Validate renderable, useful learning items rather than accepting [null] or [{}].
create function public.seo_learning_valid(p_quiz jsonb,p_vocab jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb; choice jsonb; quizzes jsonb; words jsonb; field text;
begin
  quizzes := case when jsonb_typeof(p_quiz->'quiz')='array' then p_quiz->'quiz' else '[]'::jsonb end;
  words := case when jsonb_typeof(p_vocab->'vocabulary')='array' then p_vocab->'vocabulary' else '[]'::jsonb end;
  if jsonb_array_length(quizzes)+jsonb_array_length(words)=0 then return false; end if;
  for item in select value from jsonb_array_elements(quizzes) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'question') is distinct from 'string' or length(btrim(item->>'question'))=0
      or jsonb_typeof(item->'answer') is distinct from 'string'
      or jsonb_typeof(item->'choices') is distinct from 'array' then return false; end if;
    if jsonb_array_length(item->'choices')<2 or not (item->'choices' @> jsonb_build_array(item->>'answer')) then return false; end if;
    for choice in select value from jsonb_array_elements(item->'choices') loop
      if jsonb_typeof(choice) is distinct from 'string' or length(btrim(choice#>>'{}'))=0 then return false; end if;
    end loop;
    if item ? 'explanation' and jsonb_typeof(item->'explanation') not in ('string','null') then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(words) loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'word') is distinct from 'string'
      or length(btrim(item->>'word'))=0 then return false; end if;
    foreach field in array array['pronunciation','definition','example'] loop
      if item ? field and jsonb_typeof(item->field) not in ('string','null') then return false; end if;
    end loop;
    if coalesce(length(btrim(item->>'definition')),0)=0 and coalesce(length(btrim(item->>'example')),0)=0 then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function public.seo_learning_valid(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.seo_learning_valid(jsonb,jsonb) to sabacan_sitemap_reader,service_role;

-- Private operator report/helper. Browser roles cannot execute it or read reviews.
create function public.seo_article_status(p_after_slug text default null, p_limit integer default 1000)
returns table(slug text,last_modified timestamptz,content_hash text,reason text)
language sql stable set search_path = '' as $$
  select c.slug,r.content_updated_at,
    case when r.rights_approved then public.seo_content_hash(c.slug) else null end,
    case
      when c.slug !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$' then 'invalid_slug'
      when c.video_id is null or c.video_id !~ '^[A-Za-z0-9_-]{11}$' then 'invalid_video_url'
      when c.video_title is null or length(btrim(c.video_title))=0 then 'missing_title'
      when r.status='excluded' then 'excluded_by_review'
      when not coalesce(r.rights_approved,false) or r.reviewed_at is null then 'rights_unverified'
      when r.rights_content_hash is null then 'rights_snapshot_missing'
      when r.rights_content_hash is distinct from public.seo_content_hash(c.slug) then 'rights_content_changed'
      when exists(select 1 from public.categories d where d.video_id=c.video_id and d.slug collate "C" < c.slug collate "C") then 'duplicate_video'
      when (select count(*) from public.quiz q where q.slug=c.slug)>1 then 'duplicate_quiz'
      when not public.seo_learning_valid(
        (select q.quiz_json::jsonb from public.quiz q where q.slug=c.slug limit 1),
        (select v.vocab_json::jsonb from public.vocab v where v.slug=c.slug order by v.id desc limit 1)
      ) then 'missing_or_invalid_learning_content'
      else 'eligible'
    end
  from public.categories c left join public.article_seo_reviews r on r.slug=c.slug
  where p_after_slug is null or c.slug collate "C">p_after_slug collate "C"
  order by c.slug collate "C" limit least(greatest(p_limit,1),50000);
$$;
revoke all on function public.seo_article_status(text,integer) from public,anon,authenticated;
grant execute on function public.seo_article_status(text,integer) to sabacan_sitemap_reader,service_role;

grant sabacan_sitemap_reader to current_user;
grant create on schema public to sabacan_sitemap_reader;
create function public.get_sitemap_candidates(p_after_slug text default null,p_limit integer default 1000)
returns table(slug text,last_modified timestamptz,content_hash text)
language sql stable security definer set search_path = '' as $$
  -- Filter before limiting so unreviewed catalog rows cannot hide later candidates.
  select s.slug,s.last_modified,s.content_hash from public.seo_article_status(p_after_slug,50000) s
  where auth.uid() is null and s.reason='eligible'
  order by s.slug collate "C" limit least(greatest(p_limit,1),1000);
$$;
alter function public.get_sitemap_candidates(text,integer) owner to sabacan_sitemap_reader;
-- Retain the existing URL-only public API for integrations/diagnostics.
create or replace function public.get_sitemap_articles(p_after_slug text default null,p_limit integer default 1000)
returns table(slug text,last_modified timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.slug,c.last_modified from public.get_sitemap_candidates(p_after_slug,p_limit) c where auth.uid() is null;
$$;
revoke create on schema public from sabacan_sitemap_reader;
revoke sabacan_sitemap_reader from current_user;
revoke all on function public.get_sitemap_candidates(text,integer) from public,anon,authenticated;
grant execute on function public.get_sitemap_candidates(text,integer) to anon;
-- Owner must be able to call its public projection; no helper is public.
do $$ begin
  if pg_catalog.has_schema_privilege('sabacan_sitemap_reader','public','CREATE')
    or pg_catalog.pg_has_role('anon','sabacan_sitemap_reader','USAGE')
    or pg_catalog.has_column_privilege('anon','public.article_seo_reviews','rights_content_hash','SELECT')
  then raise exception 'Unexpected SEO privileges'; end if;
end $$;
