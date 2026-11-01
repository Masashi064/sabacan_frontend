/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');
const base=process.env.SEO_TEST_BASE_URL||'http://localhost:3110';
const production='https://sabacan365.com';
const decode=value=>value.replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
test('sitemap XML, unique canonical public URLs, no future lastmod, and listed URL HTTP 200',async()=>{
 const response=await fetch(`${base}/sitemap.xml`,{signal:AbortSignal.timeout(45000)});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/xml/);const xml=await response.text();assert.match(xml,/^<\?xml/);assert.match(xml,/<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);assert.match(xml,/<\/urlset>\s*$/);
 const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>decode(m[1]));assert.ok(urls.length>0);assert.equal(urls.length,new Set(urls).size);assert.equal((xml.match(/<url>/g)||[]).length,urls.length);
 for(const match of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)){assert.ok(Number.isFinite(Date.parse(match[1])));assert.ok(Date.parse(match[1])<=Date.now());}
 for(const url of urls){assert.ok(url===production||/^https:\/\/sabacan365\.com\/articles\/[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(url));const path=url.slice(production.length)||'/';const page=await fetch(`${base}${path}`,{signal:AbortSignal.timeout(45000)});assert.equal(page.status,200);const html=await page.text();const tag=[...html.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]).find(t=>/rel="canonical"/.test(t));assert.ok(tag);assert.equal(decode(tag.match(/href="([^"]+)"/)[1]),url);assert.doesNotMatch(html,/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/);}
 console.log(JSON.stringify({base,totalURLs:urls.length,videoURLs:urls.filter(u=>u.includes('/articles/')).length,allHTTP200:true,canonicalMatch:true}));
});
test('robots advertises sitemap and does not block public pages or rendering assets',async()=>{
 const response=await fetch(`${base}/robots.txt`,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/plain/);const text=await response.text();assert.match(text,/User-Agent: \*/i);assert.match(text,/Allow: \/\s/);assert.match(text,/Disallow: \/api\//);assert.match(text,/Sitemap: https:\/\/sabacan365\.com\/sitemap.xml/);assert.doesNotMatch(text,/Disallow: \/(?:articles|_next)/);assert.doesNotMatch(text,/noindex/i);
});
