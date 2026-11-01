-- Read-only, authorized SQL Editor/linked CLI only. No evidence or user data output.
with statuses as materialized (select reason from public.seo_public_article_inventory)
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
union all
select 'summary_rights_recorded',count(*) from public.categories c
join public.article_seo_reviews r on r.slug=c.slug where r.rights_approved
union all
select 'summary_rights_unverified',count(*) from public.categories c
left join public.article_seo_reviews r on r.slug=c.slug where not coalesce(r.rights_approved,false)
order by reason;
