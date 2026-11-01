/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');
const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');
function compile(file,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,require:name=>{if(!(name in imports))throw Error(`Unexpected import ${name}`);return imports[name];}});return exports;}
const {buildArticleMetadata}=compile('src/lib/articles/metadata.ts',{'@/lib/seo/urls':compile('src/lib/seo/urls.ts',{})});
const category={slug:'lesson-1',video_id:'abcdefghijk',video_title:'Real video title',channel_name:'Real channel',assigned_category:'Business',assigned_level:'intermediate',thumbnail_url:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',published_date:'2026-10-31',video_length:'1:47'};
const article={category,quizList:[{question:'Q',choices:['A'],answer:'A'}],vocabItems:[{word:'word'}],transcriptParagraphs:['Transcript.']};
test('video metadata is unique, canonical, factual and overrides social metadata',()=>{
 const a=buildArticleMetadata(article);const b=buildArticleMetadata({...article,category:{...category,slug:'lesson-2',video_title:'Another real title'}});
 assert.equal(a.title,'Real video title | English Listening Practice | Sabacan365');
 assert.notEqual(a.title,b.title);assert.notEqual(a.description,b.description);
 assert.match(a.description,/Real channel/);assert.match(a.description,/Business/);assert.match(a.description,/intermediate/);assert.match(a.description,/quiz, vocabulary, transcript/);
 assert.equal(a.alternates.canonical,'https://sabacan365.com/articles/lesson-1');assert.equal(a.openGraph.url,a.alternates.canonical);assert.equal(a.openGraph.title,a.title);assert.equal(a.twitter.title,a.title);assert.equal(a.twitter.card,'summary_large_image');assert.equal(a.openGraph.images[0].url,category.thumbnail_url);
});
test('metadata never advertises missing learning content and safely handles absent or invalid thumbnails',()=>{
 for(const thumbnail_url of [null,'javascript:alert(1)','not a URL']){
  const metadata=buildArticleMetadata({...article,category:{...category,thumbnail_url},quizList:[],vocabItems:[],transcriptParagraphs:[]});
  assert.doesNotMatch(metadata.description,/Includes|quiz|vocabulary|transcript/);assert.equal(metadata.openGraph.images[0].url,'https://sabacan365.com/toppage.png');
 }
 const metadata=buildArticleMetadata({...article,category:{...category,slug:'space slug',video_title:null,channel_name:null,assigned_category:null,assigned_level:null}});
 assert.equal(metadata.alternates.canonical,'https://sabacan365.com/articles/space%20slug');assert.match(metadata.description,/space slug/);assert.doesNotMatch(metadata.description,/null|undefined/);
});
function loader(options={}){
 const reads=[];let clients=0;const cached=new Map();
 const db={from:table=>{reads.push(table);let selected;const query={select:fields=>{selected=fields;assert.notEqual(fields,'*');return query;},eq:(key,value)=>{assert.equal(key,'slug');assert.equal(value,'lesson-1');return query;},order:()=>query,limit:()=>query,maybeSingle:async()=>{
  assert.ok(selected);if(options.rejection===table)throw Error('secret network detail');
  if(options.error===table)return{data:null,error:{message:'secret SQL error'}};
  return{data:table==='categories'?(options.missing?null:category):table==='quiz'?{quiz_json:{quiz:article.quizList}}:table==='vocab'?{vocab_json:{vocabulary:article.vocabItems}}:{vtt_text:'Transcript.',transcript_json:null},error:null};}};return query;}};
 const get=compile('src/lib/articles/getArticleData.ts',{'react':{cache:fn=>(slug)=>{if(!cached.has(slug))cached.set(slug,fn(slug));return cached.get(slug);}},'@/lib/supabase/server':{supabaseServer:async()=>{clients++;return db;}},'@/lib/transcript/parseVtt':{parseVttToParagraphs:text=>[text],parseTranscriptJsonToParagraphs:()=>[]}}).getArticleData;
 return{get,reads,clients:()=>clients};
}
test('shared loader uses four explicit queries and preserves learning data',async()=>{
 const a=loader();const [first,second]=await Promise.all([a.get('lesson-1'),a.get('lesson-1')]);assert.equal(first,second);assert.equal(a.reads.length,4);assert.equal(a.clients(),1);assert.equal(first.quizList[0].question,'Q');assert.equal(first.vocabItems[0].word,'word');assert.equal(first.transcriptParagraphs[0],'Transcript.');
 const separate=loader();await separate.get('lesson-1');assert.equal(separate.clients(),1);assert.notEqual(await separate.get('lesson-1'),first);
});
test('missing video is distinct from database failures; errors never expose details',async()=>{
 assert.equal(await loader({missing:true}).get('lesson-1'),null);
 for(const table of ['categories','quiz','vocab'])for(const mode of ['error','rejection']){
  await assert.rejects(loader({[mode]:table}).get('lesson-1'),e=>e.message==='Unable to load this video. Please try again later.'&&!e.message.includes('secret'));
 }
 assert.equal((await loader({rejection:'captions'}).get('lesson-1')).transcriptParagraphs.length,0);
});
function page(data,fail=false){const notFoundError=Error('NEXT_HTTP_ERROR_FALLBACK;404');
 return{notFoundError,...compile('src/app/articles/[slug]/page.tsx',{
 'next/link':{default:'a'},'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
 '@/components/learning/StudyStartMarker':{default:'study'},'@/components/article/LearningTabs':{LearningTabs:'tabs'},'@/components/article/ReportIssueSection':{ReportIssueSection:'report'},'@/lib/utils':{formatVideoLength:()=>null},'next/navigation':{notFound:()=>{throw notFoundError;}},'@/lib/articles/getArticleData':{getArticleData:async()=>{if(fail)throw Error('Unable to load this video. Please try again later.');return data;}},'@/lib/articles/metadata':{buildArticleMetadata},
 })};}
test('metadata and page use notFound for missing videos, never for upstream errors',async()=>{
 const missing=page(null);for(const fn of [missing.generateMetadata,missing.default])await assert.rejects(fn({params:Promise.resolve({slug:'missing'})}),e=>e===missing.notFoundError);
 const failed=page(null,true);const metadata=await failed.generateMetadata({params:Promise.resolve({slug:'lesson-1'})});assert.equal(metadata.robots.index,false);await assert.rejects(failed.default({params:Promise.resolve({slug:'lesson-1'})}),e=>e!==failed.notFoundError);
 const valid=page(article);assert.equal((await valid.generateMetadata({params:Promise.resolve({slug:'lesson-1'})})).title,buildArticleMetadata(article).title);assert.ok(await valid.default({params:Promise.resolve({slug:'lesson-1'})}));
});
