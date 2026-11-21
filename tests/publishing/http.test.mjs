import test from 'node:test';
import assert from 'node:assert/strict';
import {createReleaseHandler} from '../../server/publishing/http.mjs';
import {createReleaseService} from '../../server/publishing/service.mjs';
const origin='https://farm.example',id='11111111-1111-4111-8111-111111111111';
const selection={requestId:id,baseReleaseId:null,selections:[{id,revision:2}],withdrawals:[]};
const request=(body=selection,headers={})=>new Request(origin+'/admin/api/releases',{method:'POST',headers:{origin,'x-csrf-token':'a'.repeat(43),'content-type':'application/json',...headers},body:JSON.stringify(body)});
test('release HTTP is disabled by default, rejects cross-site/oversized requests and marks every result private',async()=>{
 let calls=0;const service={prepare:async()=>{calls++;return{id};}};
 assert.equal((await createReleaseHandler({origin},{service})(request())).status,503);
 const handle=createReleaseHandler({origin,releaseEnabled:true},{service});
 assert.equal((await handle(request(selection,{origin:'https://elsewhere.example'}))).status,403);
 assert.equal((await handle(request(selection,{'x-csrf-token':'bad'}))).status,403);
 assert.equal((await handle(request('x'.repeat(100001)))).status,413);
 assert.equal(calls,0);
 const response=await handle(request());assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(calls,1);
});
test('prepare crosses active membership, CSRF and recent-password boundary using only authenticated user RPC',async()=>{
 let authenticated,params,token;const service=createReleaseService({auth:{authenticate:async(req,options)=>{authenticated=options;return{accessToken:'dummy-user-token'};}},provider:{userRpc:async(name,input,access)=>{params={name,input};token=access;return{id};}}});
 await service.prepare(request(),selection);assert.deepEqual(authenticated,{requireMutation:true,requireRecent:true});assert.equal(params.name,'farm_release_prepare');assert.equal(token,'dummy-user-token');assert.deepEqual(params.input.p_selections,selection.selections);
 await assert.rejects(()=>service.prepare(request(),{...selection,selections:[{id,revision:0}]}),e=>e.status===400);
});
test('provider conflict and ambiguous failure preserve safe retry guidance without exposing secrets',async()=>{
 for(const [error,status] of [[{code:'PT409'},409],[{code:'42501'},428],[Error('secret-provider-token'),503]]){
  const service=createReleaseService({auth:{authenticate:async()=>({accessToken:'dummy'})},provider:{userRpc:async()=>{throw error;}}});
  const response=await createReleaseHandler({origin,releaseEnabled:true},{service})(request());assert.equal(response.status,status);const text=await response.text();assert.doesNotMatch(text,/secret-provider-token/);assert.match(text,/Reload|Confirm/);
 }
});
