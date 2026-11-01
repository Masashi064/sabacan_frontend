/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function compile(file,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URLSearchParams,console,require:name=>{if(!(name in imports))throw Error(`Unexpected import ${name}`);return imports[name];}});return exports;}
const helpers=compile('src/lib/home/pagination.ts',{'@/lib/seo/urls':{SITE_URL:'https://sabacan365.com'}});
const {homePageNumber,homePageHref,homeMetadata}=helpers;
test('strict one-based page numbers reject invalid and overflowing offsets',()=>{
 assert.equal(homePageNumber(),1);assert.equal(homePageNumber('2'),2);
 for(const input of ['0','-1','2.5','2abc','01','','9007199254740991',['2','3']])assert.equal(homePageNumber(input),null);
});
test('page links preserve filters and normalize defaults without tracking parameters',()=>{
 assert.equal(homePageHref({},1),'/');assert.equal(homePageHref({},2),'/?page=2');
 const sp={q:' say tell ',category:'Business',channel:'A & B',sort:'created_at',order:'asc',completion:'incomplete',page:'9',tracking:'bad'};
 const url=new URL(homePageHref(sp,3),'https://sabacan365.com');
 assert.equal(url.searchParams.get('q'),'say tell');assert.equal(url.searchParams.get('channel'),'A & B');assert.equal(url.searchParams.get('completion'),'incomplete');assert.equal(url.searchParams.get('page'),'3');assert.equal(url.searchParams.has('tracking'),false);
 assert.equal(homePageHref({category:'all',level:'all',completion:'all',sort:'published_date',order:'desc'},1),'/');
});
test('each public sequence page has its own canonical, filtered variants noindex/follow',()=>{
 assert.equal(homeMetadata({},1).alternates.canonical,'https://sabacan365.com/');
 const second=homeMetadata({},2);assert.equal(second.alternates.canonical,'https://sabacan365.com/?page=2');assert.equal(second.openGraph.url,second.alternates.canonical);assert.equal(second.robots.index,true);
 for(const sp of [{q:'english'},{category:'Business'},{sort:'created_at'},{completion:'complete'}]){const meta=homeMetadata(sp,2);assert.equal(meta.robots.index,false);assert.equal(meta.robots.follow,true);assert.ok(meta.alternates.canonical.endsWith(homePageHref(sp,2)));}
});
function database(){const calls=[];const rows=Array.from({length:73},(_,i)=>({slug:String(i).padStart(3,'0'),video_title:`Video ${i}`}));
 return{calls,auth:{getUser:async()=>({data:{user:null}})},rpc:async()=>({data:{channels:[],categories:[],levels:[]}}),from:table=>{assert.equal(table,'categories');let range;
 const qb={select:()=>qb,or:value=>{calls.push(['q',value]);return qb;},eq:(...args)=>{calls.push(['filter',...args]);return qb;},order:(...args)=>{calls.push(['order',...args]);return qb;},range:(from,to)=>{range=[from,to];calls.push(['range',...range]);return Promise.resolve({data:rows.slice(from,to+1),count:rows.length,error:null});}};return qb;}};
}
const service=compile('src/lib/home/homeService.ts',{'./pagination':helpers});
test('SSR pages and infinite-scroll API share ordered, disjoint 24-row windows',async()=>{
 const db=database();const first=await service.getHomeData(db,{});const second=await service.getHomeData(db,{page:'2'});const next=await service.getArticlePage(db,{},2);
 assert.equal(first.rows.length,24);assert.equal(second.rows.length,24);assert.equal(next.rows.length,24);assert.equal(new Set([...first.rows,...second.rows,...next.rows].map(x=>x.slug)).size,72);assert.equal(second.totalCount,73);assert.equal(second.hasMore,true);
 assert.deepEqual(db.calls.filter(x=>x[0]==='range'),[['range',0,24],['range',24,48],['range',48,72]]);
 assert.ok(db.calls.some(x=>x[0]==='order'&&x[1]==='slug'&&x[2].ascending===true));
 const final=await service.getHomeData(db,{page:'4',q:'Video',category:'Business'});assert.equal(final.rows.length,1);assert.equal(final.hasMore,false);assert.ok(db.calls.some(x=>x[0]==='filter'&&x[1]==='assigned_category'&&x[2]==='Business'));
});
