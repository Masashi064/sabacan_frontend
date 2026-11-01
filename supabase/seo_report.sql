-- Read-only, authorized SQL Editor/linked CLI only. No evidence or user data output.
with statuses as materialized (select reason from public.seo_article_status(null,50000))
select reason,count(*) as videos from statuses group by reason
union all
select 'summary_catalog_total',count(*) from statuses
union all
select 'summary_eligible_candidates',count(*) from statuses where reason='eligible'
union all
select 'summary_excluded_or_pending',count(*) from statuses where reason<>'eligible'
union all
select 'deleted_video_review',count(*) from public.article_seo_reviews r
where not exists(select 1 from public.categories c where c.slug=r.slug)
order by reason;
