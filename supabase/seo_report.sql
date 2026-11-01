-- Read-only, authorized SQL Editor/linked CLI only. No evidence or user data output.
select reason,count(*) as videos from public.seo_article_status(null,50000)
group by reason
union all
select 'deleted_video_review',count(*) from public.article_seo_reviews r
where not exists(select 1 from public.categories c where c.slug=r.slug)
order by reason;
