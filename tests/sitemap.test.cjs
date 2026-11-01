/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const vm=require('node:vm');
function compile(file,imports,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Set,Date,AbortSignal,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://public.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-anon'}},require:name=>{if(!(name in imports))throw Error(`Unexpected import ${name}`);return imports[name];},...globals});return exports;}
const urls=compile('src/lib/seo/urls.ts',{});
function loader(pages){let calls=[];let options;const {loadSitemap}=compile('src/lib/seo/sitemap.ts',{'./urls':urls,'@supabase/supabase-js':{createClient:(url,key,config)=>{assert.equal(key,'public-anon');options=config;return{rpc:async(name,args)=>{assert.equal(name,'get_sitemap_articles');calls.push(args);const page=pages[calls.length-1];if(page instanceof Error)throw page;return page??{data:[],error:null};}};}}});return{load:loadSitemap,calls,options:()=>options};}
test('successful zero approvals yields homepage only; missing table/errors never masquerade as zero',async()=>{
 const a=loader([{data:[],error:null}]);const entries=await a.load();assert.equal(entries.length,1);assert.equal(entries[0].url,urls.SITE_URL);assert.equal(a.options().auth.persistSession,false);assert.equal(a.options().auth.autoRefreshToken,false);
 for(const page of [{data:null,error:{message:'secret DB detail'}},{data:null,error:null},new Error('secret timeout')])await assert.rejects(loader([page]).load(),e=>e.message==='Sitemap is temporarily unavailable.'&&!e.message.includes('secret'));
});
test('uses shared Canonical, removes duplicate URLs, and omits unknown lastmod',async()=>{
 const entries=await loader([{data:[{slug:'a',last_modified:null},{slug:'a',last_modified:null},{slug:'b',last_modified:'2026-01-01T00:00:00Z'}],error:null}]).load();assert.equal(entries.length,3);assert.equal(entries[1].url,urls.articleCanonicalUrl('a'));assert.equal('lastModified' in entries[1],false);assert.equal(entries[2].lastModified.toISOString(),'2026-01-01T00:00:00.000Z');
});
test('keyset pagination covers >1000 approvals and rejects failed partial reads',async()=>{
 const first=Array.from({length:1000},(_,i)=>({slug:`video-${String(i).padStart(4,'0')}`,last_modified:null}));const a=loader([{data:first,error:null},{data:[{slug:'video-1000',last_modified:null}],error:null}]);assert.equal((await a.load()).length,1002);assert.equal(a.calls[0].p_after_slug,null);assert.equal(a.calls[1].p_after_slug,'video-0999');assert.equal(a.calls[1].p_limit,1000);
 await assert.rejects(loader([{data:first,error:null},{data:null,error:{message:'second page failed'}}]).load());
 await assert.rejects(loader([{data:first,error:null},{data:first,error:null}]).load());
});
test('rejects unsafe paths, invalid timestamps, and unordered rows rather than publishing bad XML',async()=>{
 for(const row of [{slug:'../private',last_modified:null},{slug:'a?token=secret',last_modified:null},{slug:'a',last_modified:'invalid'},{slug:'a',last_modified:'9999-01-01T00:00:00Z'}])await assert.rejects(loader([{data:[row],error:null}]).load());
 await assert.rejects(loader([{data:[{slug:'z',last_modified:null},{slug:'a',last_modified:null}],error:null}]).load());
});
test('robots allows articles/assets, excludes API crawling, and advertises the production sitemap',()=>{
 const {default:robots}=compile('src/app/robots.ts',{'@/lib/seo/urls':urls});const result=robots();assert.equal(result.sitemap,'https://sabacan365.com/sitemap.xml');assert.equal(result.rules.allow,'/');assert.equal(result.rules.disallow,'/api/');
});
test('sitemap route uses only successful public data cache and remains runtime-rendered',async()=>{
 let config;let count=0;const route=compile('src/app/sitemap.ts',{'next/cache':{unstable_cache:(fn,keys,options)=>{config={keys,options};return fn;}},'@/lib/seo/sitemap':{loadSitemap:async()=>{count++;return[{url:urls.SITE_URL}];}}});assert.equal(route.dynamic,'force-dynamic');assert.equal(config.options.revalidate,3600);assert.equal((await route.default()).length,1);assert.equal(count,1);
});
