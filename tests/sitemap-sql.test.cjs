/* eslint-disable @typescript-eslint/no-require-imports */
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');let db;
before(async()=>{db=new PGlite();await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create table public.categories(slug text primary key,video_id text,video_title text);
create table public.quiz(id serial primary key,slug text,quiz_json jsonb);
create table public.vocab(id serial primary key,slug text,vocab_json jsonb);
alter table public.categories enable row level security; alter table public.quiz enable row level security; alter table public.vocab enable row level security;
create policy public_categories on public.categories for select to anon,authenticated using(slug <> 'private');
create policy public_quiz on public.quiz for select to anon,authenticated using(true);
create policy public_vocab on public.vocab for select to anon,authenticated using(true);
grant select on public.categories,public.quiz,public.vocab to anon,authenticated;
`);await db.exec(fs.readFileSync('supabase/migrations/20261101_seo_sitemap_reviews.sql','utf8'));
await db.exec(`
insert into public.categories select slug,'abcdefghijk','Public video' from unnest(array['approved','pending','private','no-learning','invalid-video','empty-title','bad-json','latest-empty','duplicate-quiz']) slug;
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
test('RLS protects existing private videos and review evidence; browser writes are denied',async()=>{
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);try{
  assert.equal((await db.query("select slug from public.categories where slug='private'")).rows.length,0);
  assert.equal((await db.query("select slug from public.article_seo_reviews where slug='pending'")).rows.length,0);
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
