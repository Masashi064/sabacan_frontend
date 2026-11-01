-- READ ONLY. Run before authorizing any production migration.
-- Keep the outputs; compare with the same checks after application.
select current_user as migration_operator;
select rolcreaterole, rolsuper from pg_catalog.pg_roles where rolname = current_user;

select to_regclass('supabase_migrations.schema_migrations') as migration_history_table;
-- If the table above is absent, report that fact rather than inventing history.
-- Run this next query only when the history table exists:
-- select version, name from supabase_migrations.schema_migrations order by version;

select to_regclass('public.article_seo_reviews') as review_table,
  to_regprocedure('public.get_sitemap_articles(text,integer)') as sitemap_rpc;
select rolname, rolcanlogin, rolbypassrls, rolsuper
from pg_catalog.pg_roles where rolname = 'sabacan_sitemap_reader';

select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('categories','quiz','vocab');

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and (
  (table_name = 'categories' and column_name in ('slug','video_id','video_title'))
  or (table_name = 'quiz' and column_name in ('slug','quiz_json'))
  or (table_name = 'vocab' and column_name in ('id','slug','vocab_json'))
)
order by table_name, ordinal_position;

select tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename in ('categories','quiz','vocab')
order by tablename, policyname;
