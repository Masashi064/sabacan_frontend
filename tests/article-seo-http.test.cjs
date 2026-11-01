/* eslint-disable @typescript-eslint/no-require-imports */
// Run against `pnpm start --port 3107`; set SEO_TEST_BASE_URL explicitly for a deployment.
const {test}=require('node:test');const assert=require('node:assert/strict');
const base=process.env.SEO_TEST_BASE_URL||'http://localhost:3107';
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function tags(html,name){return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`,'gi'))].map(match=>Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])])));}
for(const slug of ['1f5744a5','48a537f8','678fa706'])test(`HTTP metadata: ${slug}`,async()=>{
 const response=await fetch(`${base}/articles/${slug}`,{signal:AbortSignal.timeout(45000)});assert.equal(response.status,200);const html=await response.text();
 const h1=decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)[1].replace(/<[^>]*>/g,''));const title=decode(html.match(/<title>([\s\S]*?)<\/title>/i)[1]);
 assert.equal(title,`${h1} | English Listening Practice | Sabacan365`);
 const meta=Object.fromEntries(tags(html,'meta').map(m=>[m.name||m.property,m.content]));const canonical=tags(html,'link').find(l=>l.rel==='canonical')?.href;
 assert.equal(canonical,`https://sabacan365.com/articles/${slug}`);assert.equal(meta['og:url'],canonical);assert.equal(meta['og:title'],title);assert.equal(meta['twitter:title'],title);assert.equal(meta['og:description'],meta.description);assert.match(meta.description,new RegExp(h1.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.equal(meta['twitter:card'],'summary_large_image');assert.match(meta['og:image'],/^https:\/\//);assert.doesNotMatch(meta.robots||'',/noindex/);
 console.log(JSON.stringify({base,slug,status:response.status,title,description:meta.description,canonical,ogURL:meta['og:url']}));
});
for(const agent of ['Mozilla/5.0','Googlebot','Twitterbot'])test(`HTTP missing video: ${agent}`,async()=>{
 const response=await fetch(`${base}/articles/seo-phase1-nonexistent-20261101`,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(45000)});assert.equal(response.status,404);const html=await response.text();const meta=tags(html,'meta');assert.ok(meta.some(m=>m.name==='robots'&&m.content.includes('noindex')));assert.ok(html.includes('This video could not be found.'));console.log(JSON.stringify({base,missing:true,agent,status:response.status,noindex:true}));
});
