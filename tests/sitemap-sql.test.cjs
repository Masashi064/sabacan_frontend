/* eslint-disable @typescript-eslint/no-require-imports */
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');let db;let originalPolicies;let originalColumns;
before(async()=>{db=new PGlite();await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
create table public.categories(slug text primary key,video_id text,video_title text);
create table public.quiz(id serial primary key,slug text,quiz_json jsonb);
create table public.vocab(id serial primary key,slug text,vocab_json jsonb);
alter table public.categories enable row level security; alter table public.quiz enable row level security; alter table public.vocab enable row level security;
create policy public_categories on public.categories for select to anon,authenticated using(slug not in ('private','user-only') or (slug='user-only' and auth.uid() is not null));
create policy public_quiz on public.quiz for select to anon,authenticated using(true);
create policy public_vocab on public.vocab for select to anon,authenticated using(true);
grant select on public.categories,public.quiz,public.vocab to anon,authenticated;
`);originalPolicies=(await db.query("select tablename,policyname,roles,cmd,qual,with_check from pg_policies where tablename in ('categories','quiz','vocab') order by tablename,policyname")).rows;originalColumns=(await db.query("select table_name,column_name,data_type from information_schema.columns where table_schema='public' and table_name in ('categories','quiz','vocab') order by table_name,ordinal_position")).rows;await db.exec(fs.readFileSync('supabase/migrations/20261101090000_seo_sitemap_reviews.sql','utf8'));
await db.exec(`
insert into public.categories select slug,'abcdefghijk','Public video' from unnest(array['approved','pending','private','user-only','no-learning','invalid-video','empty-title','bad-json','latest-empty','duplicate-quiz']) slug;
update public.categories set video_id='bad' where slug='invalid-video'; update public.categories set video_title=' ' where slug='empty-title';
insert into public.quiz(slug,quiz_json) select slug,'{"quiz":[{"question":"Q","choices":["A"],"answer":"A"}]}'::jsonb from public.categories where slug not in('no-learning','bad-json','latest-empty');
insert into public.quiz(slug,quiz_json) values('bad-json','{"quiz":{}}'),('duplicate-quiz','{"quiz":[{}]}');
insert into public.vocab(slug,vocab_json) values('latest-empty','{"vocabulary":[{"word":"example"}]}'),('latest-empty','{"vocabulary":[]}');
insert into public.article_seo_reviews(slug,status,public_access_confirmed,quality_approved,rights_approved,reviewed_at,review_evidence) select slug,'approved',true,true,true,now(),'PRIVATE_REVIEW_EVIDENCE' from public.categories where slug <> 'pending';
insert into public.article_seo_reviews(slug) values('pending');
insert into public.article_seo_reviews(slug,status,public_access_confirmed,quality_approved,rights_approved,reviewed_at,review_evidence) values('orphan','approved',true,true,true,now(),'PRIVATE_REVIEW_EVIDENCE');
`);});
after(async()=>{await db.close();});
test('approval constraints prevent unchecked or evidence-free approval',async()=>{
 await assert.rejects(db.exec("insert into public.article_seo_reviews(slug,status) values('unchecked','approved')"));
 await assert.rejects(db.exec("insert into public.article_seo_reviews(slug,status,public_access_confirmed,quality_approved,rights_approved,reviewed_at) values('no-evidence','approved',true,true,true,now())"));
});
test('anonymous RPC includes only reviewed, public, valid videos with learning content',async()=>{
 await db.exec('set role anon');try{const {rows}=await db.query('select * from public.get_sitemap_articles()');assert.deepEqual(rows.map(r=>r.slug),['approved']);assert.equal(rows[0].last_modified,null);}finally{await db.exec('reset role');}
});
test('review states/evidence are entirely private and browser writes/role escalation are denied',async()=>{
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);try{
  assert.equal((await db.query("select slug from public.categories where slug='private'")).rows.length,0);
  await assert.rejects(db.query("select slug,status from public.article_seo_reviews"));
  await assert.rejects(db.query("select status from public.article_seo_reviews where slug='approved'"));
  assert.equal((await db.query("select pg_has_role(current_user, 'sabacan_sitemap_reader', 'USAGE') as allowed")).rows[0].allowed,false);
  await assert.rejects(db.query('select review_evidence from public.article_seo_reviews'));
  await assert.rejects(db.query("update public.article_seo_reviews set status='approved' where slug='pending'"));
  await assert.rejects(db.query("insert into public.article_seo_reviews(slug) values('browser-write')"));
 }finally{await db.exec('reset role');}}
});
test('keyset batches have no duplicate/missing slugs beyond the 1000-row boundary',async()=>{
 await db.exec(`insert into public.categories select 'bulk-'||lpad(n::text,4,'0'),'abcdefghijk','Public video' from generate_series(1,1001) n;
insert into public.quiz(slug,quiz_json) select slug,'{"quiz":[{}]}'::jsonb from public.categories where slug like 'bulk-%';
insert into public.article_seo_reviews(slug,status,public_access_confirmed,quality_approved,rights_approved,reviewed_at,review_evidence) select slug,'approved',true,true,true,now(),'Verified fixture evidence' from public.categories where slug like 'bulk-%';`);
 await db.exec('set role anon');try{
 const first=(await db.query('select * from public.get_sitemap_articles(null,1000)')).rows;
 const second=(await db.query('select * from public.get_sitemap_articles($1,1000)',[first.at(-1).slug])).rows;
 assert.equal(first.length,1000);assert.equal(second.length,2);assert.equal(new Set([...first,...second].map(r=>r.slug)).size,1002);
 }finally{await db.exec('reset role');}
});


test('definer owner cannot log in, bypass RLS, write reviews, or create public objects',async()=>{
 const role=(await db.query("select rolcanlogin,rolbypassrls,rolsuper from pg_roles where rolname='sabacan_sitemap_reader'")).rows[0];
 assert.equal(role.rolcanlogin,false);assert.equal(role.rolbypassrls,false);assert.equal(role.rolsuper,false);
 const fn=(await db.query("select p.prosecdef,p.proconfig,r.rolname from pg_proc p join pg_roles r on r.oid=p.proowner where p.proname='get_sitemap_articles'")).rows[0];assert.equal(fn.prosecdef,true);assert.equal(fn.rolname,'sabacan_sitemap_reader');assert.ok(fn.proconfig.some(c=>c.startsWith('search_path=')));
 await db.exec('set role sabacan_sitemap_reader');try{
  await assert.rejects(db.query('select review_evidence from public.article_seo_reviews'));
  await assert.rejects(db.query("update public.article_seo_reviews set status='excluded'"));
  await assert.rejects(db.query('create table public.reader_cannot_create(id int)'));
 }finally{await db.exec('reset role');}
});


test('existing content table columns and RLS policies are unchanged',async()=>{
 assert.deepEqual((await db.query("select tablename,policyname,roles,cmd,qual,with_check from pg_policies where tablename in ('categories','quiz','vocab') order by tablename,policyname")).rows,originalPolicies);
 assert.deepEqual((await db.query("select table_name,column_name,data_type from information_schema.columns where table_schema='public' and table_name in ('categories','quiz','vocab') order by table_name,ordinal_position")).rows,originalColumns);
});


test('authenticated JWT cannot widen the public RPC; caller claims are restored on exit',async()=>{
 const uid='00000000-0000-0000-0000-000000000001';
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
 await db.exec('set role authenticated');
 try{
  assert.equal((await db.query("select slug from public.categories where slug='user-only'")).rows.length,1);
  const rows=(await db.query('select * from public.get_sitemap_articles()')).rows;
  assert.equal(rows.some(row=>row.slug==='user-only'),false);
  assert.equal((await db.query("select current_setting('request.jwt.claim.sub') as uid")).rows[0].uid,uid);
 }finally{await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)");}
});
