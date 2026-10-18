import test from 'node:test';import assert from 'node:assert/strict';
import {createMediaHandler} from '../../server/media/media-http.mjs';
const config={origin:'https://farm.test'};const csrf='c'.repeat(43),id='11111111-1111-4111-8111-111111111111',version='22222222-2222-4222-8222-222222222222';
function request(path,{method='GET',body,headers={}}={}){return new Request(config.origin+path,{method,body,headers:{...(method==='POST'?{Origin:config.origin,'x-csrf-token':csrf,'sec-fetch-site':'same-origin'}:{}),...headers}});}
test('media HTTP routes enforce same-origin bounded upload and serve private previews with no-store headers',async()=>{
 const calls=[],service={list:async()=>[],upload:async(_req,input)=>{calls.push(input);return{state:'ready'};},remove:async(_req,value)=>({removed:value}),preview:async()=>new Uint8Array([1,2,3])},handler=createMediaHandler(config,{service});
 const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
 const uploaded=await handler(request('/admin/api/media',{method:'POST',body:png,headers:{'Content-Type':'image/png'}}));assert.equal(uploaded.status,200);assert.equal(calls[0].contentType,'image/png');assert.deepEqual(calls[0].bytes,png);
 const preview=await handler(request(`/admin/api/media/${id}/${version}/preview`));assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'image/webp');assert.equal(preview.headers.get('cache-control'),'private, no-store, max-age=0');assert.deepEqual(new Uint8Array(await preview.arrayBuffer()),new Uint8Array([1,2,3]));
 const removed=await handler(request(`/admin/api/media/${id}/remove`,{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}}));assert.equal(removed.status,200);
});
test('media HTTP routes reject cross-site, oversized, unsupported and malformed preview requests before service calls',async()=>{
 let count=0;const handler=createMediaHandler(config,{service:{list:async()=>[],upload:async()=>{count++;},remove:async()=>{count++;},preview:async()=>{count++;}}});
 assert.equal((await handler(request('/admin/api/media',{method:'POST',body:new Uint8Array(12),headers:{'Content-Type':'image/svg+xml'}}))).status,415);
 assert.equal((await handler(request('/admin/api/media',{method:'POST',body:new Uint8Array(12),headers:{'Content-Type':'image/png','Content-Length':'10485761'}}))).status,413);
 assert.equal((await handler(request('/admin/api/media',{method:'POST',body:new Uint8Array(12),headers:{'Content-Type':'image/png',Origin:'https://elsewhere.test'}}))).status,403);
 assert.equal((await handler(request('/admin/api/media/not-a-uuid/preview'))).status,404);assert.equal(count,0);
});
