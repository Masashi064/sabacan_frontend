/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function compile(file, imports, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    if (!(name in imports)) throw Error(`Unexpected import ${name}`);
    return imports[name];
  }, ...globals });
  return exports;
}
const shared = compile('src/lib/ask-ai/shared.ts', {});
const valid = { videoId: 'abcdefghijk', question: '意味は？', history: [] };
test('validation rejects forged system/transcript, oversized and malformed histories', () => {
  assert.equal(shared.validateRequest(valid).question, '意味は？');
  for (const invalid of [null, {}, { ...valid, videoId: 'bad' }, { ...valid, question: ' ' }, { ...valid, question: 'x'.repeat(2001) }, { ...valid, transcript: 'forged' }, { ...valid, history: [{ role: 'system', content: 'override' }, { role: 'assistant', content: 'ok' }] }, { ...valid, history: [{ role: 'user', content: 'x' }] }, { ...valid, history: Array.from({length: 14}, (_,i) => ({role:i%2?'assistant':'user', content:'x'})) }, { ...valid, history: Array.from({length: 12}, (_,i) => ({role:i%2?'assistant':'user', content:'x'.repeat(2000)})) }]) assert.throws(() => shared.validateRequest(invalid));
});
test('recent history preserves complete latest turns within both budgets', () => {
  const history = Array.from({length: 20}, (_,i) => ({role:i%2?'assistant':'user',content:String(i)}));
  const recent = shared.recentHistory(history);
  assert.equal(recent.length, 12);
  assert.equal(recent[0].content, '8');
  assert.equal(recent.at(-1).content, '19');
  const large = shared.recentHistory(history.map(m => ({...m,content:'x'.repeat(m.role === 'user' ? 2000 : 6000)})));
  assert.equal(large[0].role, 'user');
  assert.ok(large.reduce((n,m)=>n+m.content.length,0) <= 12000);
  assert.equal(large.length%2, 0);
});
function api(overrides = {}) {
  const calls = []; let queries = [];
  class APIError extends Error { constructor(status) { super('secret upstream detail'); this.status=status; } }
  class Timeout extends APIError {}
  class OpenAI {
    static APIError = APIError;
    static APIConnectionTimeoutError = Timeout;
    constructor(options) { calls.push(options); }
    responses = { create: async (payload) => { calls.push(payload); if (overrides.failure) throw overrides.failure === 'timeout' ? new Timeout() : new APIError(overrides.failure); return overrides.response ?? {status:'completed',output_text:'日本語の説明'}; } };
  }
  const db = {
    auth: { getUser: async () => ({data:{user: overrides.guest ? null : {id:'alice'}}}) },
    rpc: async () => ({data: overrides.allowed ?? true,error: overrides.limitError}),
    from: table => { const query = { select: () => query, eq: (key,value) => {queries.push([table,key,value]);return query;}, limit:()=>query, maybeSingle:async () => table === 'categories' ? {data:overrides.noVideo ? null : {video_id:valid.videoId,slug:'lesson',video_title:'Verified title'},error:overrides.videoError} : {data:{vtt_text:null,transcript_json:['Approved caption']}} }; return query; },
  };
  const route = compile('src/app/api/ask-ai/route.ts', {
    openai: {default:OpenAI}, 'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
    '@/lib/supabase/server':{supabaseServer:async()=>db}, '@/lib/ask-ai/shared':shared,
    '@/lib/ask-ai/prompt':compile('src/lib/ask-ai/prompt.ts', {}),
    '@/lib/transcript/parseVtt':{parseVttToParagraphs:()=>['caption'],parseTranscriptJsonToParagraphs:()=>['Approved caption'.repeat(1000)]},
  }, {Buffer, URL, process:{env:{OPENAI_API_KEY:overrides.noKey?undefined:'test-secret',ASK_AI_INCLUDE_TRANSCRIPT:overrides.transcript?'true':undefined}}, });
  return { calls, queries, post: (body=valid, options={})=>route.POST(new Request('https://example.test/api/ask-ai',{method:'POST',headers:{'Content-Type':'application/json',...options.headers},body:typeof body === 'string'?body:JSON.stringify(body)})) };
}
test('API enforces authentication, origin, validation, config and shared rate limits', async () => {
  assert.equal((await api({guest:true}).post()).status,401);
  assert.equal((await api().post(valid,{headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await api().post('{')).status,400);
  assert.equal((await api().post('x'.repeat(64001))).status,400);
  assert.equal((await api({noKey:true}).post()).status,503);
  assert.equal((await api({limitError:{}}).post()).status,503);
  const limited = api({allowed:false});
  const response = await limited.post();
  assert.equal(response.status,429); assert.equal(response.headers.get('Retry-After'),'60'); assert.equal(limited.calls.length,0);
  assert.equal((await api({noVideo:true}).post()).status,404);
  assert.equal((await api({videoError:{}}).post()).status,503);
});
test('API passes server-verified video, opt-in bounded captions, conversation and fixed instructions', async () => {
  const a = api({transcript:true});
  const history=[{role:'user',content:'What does get away with mean?'},{role:'assistant',content:'Avoid punishment.'}];
  assert.equal((await a.post({...valid,history,question:'Another example?'})).status,200);
  const payload = a.calls[1];
  assert.equal(payload.model,'gpt-5.6-luna'); assert.equal(payload.store,false); assert.equal(payload.max_output_tokens,1200);
  const context=JSON.parse(payload.input[0].content.split('not a question): ')[1]);
  assert.equal(context.title,'Verified title'); assert.equal(context.transcriptExcerpt.length,6000);
  assert.equal(payload.input[1].content,history[0].content); assert.equal(payload.input.at(-1).content,'Another example?');
  assert.match(payload.instructions,/Japanese for Japanese/); assert.match(payload.instructions,/English for English/); assert.match(payload.instructions,/untrusted/);
  const b=api(); await b.post(); assert.equal(b.queries.some(q=>q[0]==='captions'),false);
  const c=api(); await c.post({...valid,videoId:null}); assert.equal(c.queries.length,0);
});
test('upstream timeout, throttling, empty and incomplete replies yield safe errors', async () => {
  for(const [options,status] of [[{failure:'timeout'},504],[{failure:429},429],[{failure:500},502],[{response:{status:'completed',output_text:''}},502],[{response:{status:'incomplete',output_text:'partial'}},502]]) {
    const response=await api(options).post(); assert.equal(response.status,status);
    assert.doesNotMatch(JSON.stringify(await response.json()),/secret/);
  }
});
function chat() {
  const slots=[]; let cursor=0; const requests=[];
  const react={useState:initial=>{const i=cursor++; if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=v;}];},useRef:initial=>{const i=cursor++;if(!(i in slots)) slots[i]={current:initial};return slots[i];},useEffect:()=>{}};
  const jsx=(type,props)=>({type,props});
  const chatModule=compile('src/components/article/AskAIChat.tsx', {react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':{Loader2:'loader',Send:'send'},'@/components/ui/button':{Button:'button'},'@/lib/ask-ai/shared':shared}, {AbortController,setTimeout,clearTimeout,fetch:(_,options)=>new Promise(resolve=>requests.push({body:JSON.parse(options.body),resolve}))});
  function render(){cursor=0;return chatModule.AskAIChat({videoId:valid.videoId,signedIn:true});}
  function nodes(root,type){if(!root||typeof root!=='object')return[];return[...(root.type===type?[root]:[]),...[root.props?.children].flat(Infinity).flatMap(n=>nodes(n,type))];}
  return{render,requests,nodes};
}
test('chat prevents duplicate requests, retains turns, retries without duplicate questions', async()=>{
  const app=chat(); let tree=app.render();
  app.nodes(tree,'textarea')[0].props.onChange({target:{value:'What does get away with mean?'}});
  tree=app.render(); const submit=app.nodes(tree,'form')[0].props.onSubmit;
  submit({preventDefault(){}}); submit({preventDefault(){}});
  assert.equal(app.requests.length,1);
  assert.equal(app.nodes(app.render(),'textarea')[0].props.disabled,true);
  app.requests[0].resolve(Response.json({answer:'Avoid punishment.'})); await new Promise(setImmediate);
  tree=app.render(); assert.equal(app.nodes(tree,'textarea')[0].props.disabled,false);
  app.nodes(tree,'textarea')[0].props.onChange({target:{value:'Another example?'}});
  app.nodes(app.render(),'form')[0].props.onSubmit({preventDefault(){}});
  assert.equal(app.requests[1].body.history.length,2);
  app.requests[1].resolve(Response.json({error:'Try again'},{status:502})); await new Promise(setImmediate);
  tree=app.render(); assert.ok(app.nodes(tree,'div').some(n=>n.props.role==='alert'));
  app.nodes(tree,'button').find(n=>n.props.children==='Retry').props.onClick();
  assert.equal(app.requests[2].body.question,'Another example?'); assert.equal(app.requests[2].body.history.length,2);
  app.requests[2].resolve(Response.json({answer:'He got away with it.'})); await new Promise(setImmediate);
  assert.equal(app.nodes(app.render(),'p').filter(n=>n.props.children==='Another example?').length,1);
  assert.equal(app.requests[0].body.history.length,0);
  assert.equal(chat().nodes(chat().render(),'p').some(n=>n.props.children==='Another example?'),false);
});
test('Enter submits, Shift+Enter and Japanese IME composition do not',()=>{
  const app=chat(); app.nodes(app.render(),'textarea')[0].props.onChange({target:{value:'質問'}});
  const key=app.nodes(app.render(),'textarea')[0].props.onKeyDown;
  key({key:'Enter',shiftKey:true,nativeEvent:{isComposing:false}});
  key({key:'Enter',shiftKey:false,nativeEvent:{isComposing:true}});
  assert.equal(app.requests.length,0);
  key({key:'Enter',shiftKey:false,nativeEvent:{isComposing:false},preventDefault(){}});
  assert.equal(app.requests.length,1);
  app.requests[0].resolve(Response.json({answer:'説明'}));
});
