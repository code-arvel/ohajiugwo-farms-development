import test from 'node:test';import assert from 'node:assert/strict';
import {createContentHandler} from '../../server/content/content-http.mjs';
import {AuthError} from '../../server/auth/sessions.mjs';

const config={origin:'https://farm.example.test'};
const id='11111111-1111-4111-8111-111111111111';
function setup(){const calls=[],service={list:async()=>{calls.push(['list']);return[];},listTrash:async()=>{calls.push(['listTrash']);return[];},read:async(_r,value)=>{calls.push(['read',value]);return null;},history:async(_r,value)=>{calls.push(['history',value]);return[];},save:async(_r,value)=>{calls.push(['save',value]);return{id,revision:1};},restore:async(_r,value,body)=>{calls.push(['restore',value,body]);return{id,revision:2};},trash:async(_r,value,baseRevision)=>{calls.push(['trash',value,baseRevision]);return{trashed:true};},untrash:async(_r,value,baseRevision)=>{calls.push(['untrash',value,baseRevision]);return{id,revision:4};}};return{calls,handler:createContentHandler(config,{service})};}
const request=(method,path,body,extra={})=>new Request(config.origin+path,{method,headers:{...(method==='POST'?{origin:config.origin,'content-type':'application/json','x-csrf-token':'a'.repeat(43)}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
test('content HTTP routes list, read history, save, restore and trash with strict same-origin inputs',async()=>{
 const h=setup();await h.handler(request('GET','/admin/api/content'));await h.handler(request('GET','/admin/api/content/trash'));await h.handler(request('GET',`/admin/api/content/${id}/history`));await h.handler(request('POST','/admin/api/content',{id:null,kind:'post',baseRevision:null,payload:{title:'draft'}}));await h.handler(request('POST',`/admin/api/content/${id}/restore`,{revision:1,baseRevision:2}));await h.handler(request('POST',`/admin/api/content/${id}/trash`,{baseRevision:2}));await h.handler(request('POST',`/admin/api/content/${id}/untrash`,{baseRevision:2}));
 assert.deepEqual(h.calls.map(call=>call[0]),['list','listTrash','history','save','restore','trash','untrash']);assert.equal(h.calls.at(-1)[2],2);
});
test('content HTTP rejects cross-origin, missing CSRF, extra keys, oversized and stale mutations without service access',async()=>{
 const h=setup();
 for(const [requestValue,status] of [[request('GET','/admin/api/content',undefined,{origin:'https://attacker.test'}),403],[request('POST','/admin/api/content',{}, {'x-csrf-token':''}),403],[request('POST','/admin/api/content',{id:null,kind:'post',baseRevision:null,payload:{},extra:true}),400],[request('GET','/admin/api/content?draft=1'),400],[request('POST','/admin/api/content','x'.repeat(1_100_010)),413]])assert.equal((await h.handler(requestValue)).status,status);
 assert.deepEqual(h.calls,[]);
});
test('content HTTP maps compare-and-swap conflicts to an actionable 409',async()=>{
 const h=setup();h.handler= createContentHandler(config,{service:{save:async()=>{throw new AuthError('private SQL detail',409);}}});
 const response=await h.handler(request('POST','/admin/api/content',{id:null,kind:'post',baseRevision:null,payload:{}}));assert.equal(response.status,409);assert.match((await response.json()).error,/changed elsewhere/);
});
