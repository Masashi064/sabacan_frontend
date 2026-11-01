/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');
const base=process.env.SEO_TEST_BASE_URL||'http://localhost:3115';
const decode=value=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"');
async function read(path,agent='Mozilla/5.0'){
 const response=await fetch(`${base}${path}`,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(60000)});assert.equal(response.status,200);const html=await response.text();
 const grid=html.match(/<section\b[^>]*data-slot="article-grid"[^>]*>([\s\S]*?)<\/section>/);
 assert.ok(grid,'Grid must be present in server HTML');
 const slugs=[...grid[1].matchAll(/href="\/articles\/([^"?]+)"/g)].map(m=>m[1]);
 const canonical=decode(html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)[1]);
 const nav=html.match(/<nav\b[^>]*aria-label="Video pages"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
 return{html,slugs,canonical,nav};
}
test('three SSR pages contain distinct sets of 24 videos and crawlable sequential links',async()=>{
 const all=[];
 for(let page=1;page<=3;page++){
  const path=page===1?'/':`/?page=${page}`;const data=await read(path);assert.equal(data.slugs.length,24);all.push(...data.slugs);
  assert.equal(new URL(data.canonical).href,`https://sabacan365.com${path}`);
  assert.ok(data.nav.includes(`href="/?page=${page+1}"`));
  if(page>1)assert.ok(data.nav.includes(`href="${page===2?'/':`/?page=${page-1}`}"`));
  const bot=await read(path,'Googlebot');assert.deepEqual(bot.slugs,data.slugs);
  console.log(JSON.stringify({base,page,ssrVideos:24,canonical:data.canonical,botMatches:true}));
 }
 assert.equal(new Set(all).size,72,'Adjacent SSR pages must not repeat videos');
});
test('filtered pages preserve search/filter parameters in links and use noindex,follow',async()=>{
 const data=await read('/?category=Business&page=2');assert.equal(data.slugs.length,24);assert.match(data.html,/<meta name="robots" content="noindex, follow"/);
 assert.equal(data.canonical,'https://sabacan365.com/?category=Business&page=2');assert.ok(data.nav.includes('href="/?category=Business&amp;page=3"'));assert.ok(data.nav.includes('href="/?category=Business"'));
});
