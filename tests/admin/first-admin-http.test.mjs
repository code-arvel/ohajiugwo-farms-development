import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/first-admin.mjs';
import {createFirstAdminService} from '../../server/auth/first-admin.mjs';
const module=await import('../../server/auth/first-admin-http.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('first-admin acceptance handler contract exists',()=>assert.equal(typeof module.createFirstAdminHandler,'function'));
async function setup(){
 const h=fixture(),service=createFirstAdminService(h.config,{provider:h.provider,rpc:h.rpc,now:h.clock});
 const pending=await service.prepare('owner@example.test');await service.issue(pending.id);
 const handler=module.createFirstAdminHandler(h.config,{service,now:h.clock,getClientIp:()=> '127.0.0.1'});
 const response=await handler(new Request(h.config.origin+'/admin/accept'));
 const cookie=response.headers.get('set-cookie').split(';')[0],{csrfToken}=await response.json();
 const input=await h.inputs();
 const post=(body=input,headers={})=>new Request(h.config.origin+'/admin/accept',{method:'POST',headers:{cookie,origin:h.config.origin,'content-type':'application/json','x-csrf-token':csrfToken,...headers},body:typeof body==='string'?body:JSON.stringify(body)});
 return {h,handler,post,cookie,csrfToken,input};
}
test('GET never consumes invitation material; explicit POST completes setup without leaking credentials',async()=>{
 const {h,handler,post,input}=await setup();assert.ok(!h.calls.includes('verifyInvite'));assert.equal(h.active,0);
 const response=await handler(post());assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('referrer-policy'),/no-referrer/);
 const text=await response.text();for(const secret of [input.nonce,input.tokenHash,input.password,'private-invitation','private-password'])assert.ok(!text.includes(secret));
 assert.deepEqual(JSON.parse(text),{activated:true,signInRequired:true,providerCleanupPending:false});
 assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
 const replay=await handler(post());assert.notEqual(replay.status,200);assert.equal(h.active,1);
});
test('cross-origin, missing/forged CSRF, duplicate cookies and expired CSRF never call the provider',async()=>{
 for(const mode of ['origin','csrf','cookie','duplicate','expired']){
  const {h,handler,post,cookie}=await setup();const headers={};
  if(mode==='origin')headers.origin='https://attacker.test';if(mode==='csrf')headers['x-csrf-token']='z'.repeat(43);
  if(mode==='cookie')headers.cookie='';if(mode==='duplicate')headers.cookie=cookie+'; '+cookie;
  if(mode==='expired')h.advance(600001);
  const response=await handler(post(undefined,headers));assert.equal(response.status,403);assert.equal(h.active,0);assert.ok(!h.calls.includes('verifyInvite'));
 }
});
test('bounded JSON only; URL tokens, extra fields and setup endpoints are refused',async()=>{
 const {h,handler,post,input}=await setup();
 for(const request of [post('x'.repeat(4097)),post('{'),post(input,{'content-type':'text/plain'}),post({...input,clientIp:'attacker-controlled'}),new Request(h.config.origin+'/admin/accept?token=PRIVATE'),new Request(h.config.origin+'/admin/setup',{method:'POST'})]){
  const response=await handler(request);assert.ok([400,404,413,415].includes(response.status));assert.ok(!(await response.text()).includes('PRIVATE'));
 }
 assert.ok(!h.calls.includes('verifyInvite'));
});
test('throttling returns safe 429 before provider verification',async()=>{
 const {h,handler,post}=await setup(),original=h.rpc;
 // Exercise the real service with only the external abuse-counter result denied.
 const service=createFirstAdminService(h.config,{provider:h.provider,rpc:(name,p)=>name==='farm_auth_attempt'?false:original(name,p),now:h.clock});
 const limited=module.createFirstAdminHandler(h.config,{service,now:h.clock});
 const response=await limited(post());assert.equal(response.status,429);assert.ok(!h.calls.includes('verifyInvite'));
});
test('same-browser completion receipt is invitation-bound, expiring and grants no application session',async()=>{
 const {h,handler,post,input}=await setup();const response=await handler(post());
 const cookies=response.headers.getSetCookie();assert.equal(cookies.length,2);
 const receipt=cookies.find(x=>x.startsWith('ohajiugwo_first_admin_receipt_local='));assert.ok(receipt);assert.match(receipt,/HttpOnly/);assert.match(receipt,/Max-Age=300/);
 assert.ok(!receipt.includes(input.nonce));assert.ok(!receipt.includes(input.tokenHash));
 const request=id=>new Request(h.config.origin+'/admin/accept',{headers:{cookie:receipt.split(';')[0],'x-first-admin-invitation-id':id}});
 assert.deepEqual(await (await handler(request(input.id))).json(),{completed:true});
 assert.ok((await (await handler(request(crypto.randomUUID()))).json()).csrfToken);
 h.advance(300001);assert.ok((await (await handler(request(input.id))).json()).csrfToken);
 assert.ok(!cookies.some(x=>x.startsWith('ohajiugwo_admin_local=')));
});
test('overlapping valid-link request is retryable while a lease is busy, then can complete',async()=>{
 const {h,handler,post}=await setup();h.row.lease_owner=crypto.randomUUID();h.row.lease_phase='accept';h.row.lease_until=h.clock()+120000;
 assert.equal((await handler(post())).status,503);assert.ok(!h.calls.includes('verifyInvite'));
 h.advance(120001);assert.equal((await handler(post())).status,200);assert.equal(h.active,1);
});
