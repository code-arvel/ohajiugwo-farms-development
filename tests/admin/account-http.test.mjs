import test from 'node:test';import assert from 'node:assert/strict';import{config}from'./fixtures/first-admin.mjs';import{AuthError}from'../../server/auth/sessions.mjs';
const mod=await import('../../server/auth/account-lifecycle-http.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error});
test('equal-admin HTTP handler exists and never calls a mutation from GET',async()=>{
 assert.equal(typeof mod.createAccountLifecycleHandler,'function');let reads=0,writes=0;
 const handler=mod.createAccountLifecycleHandler(config,{service:{list:async()=>{reads++;return{admins:[],invitations:[]}},cancel:async()=>{writes++;return{cancelled:true}},revoke:async()=>{writes++;return{revoked:true}}}});
 const response=await handler(new Request(config.origin+'/admin/api/accounts'));assert.equal(response.status,200);assert.equal(reads,1);assert.equal(writes,0);
});
test('same-origin bounded POST routes expose only revoke/cancel and return safe outcomes',async()=>{
 let command;const service={list:async()=>({admins:[],invitations:[]}),cancel:async(_request,id)=>{command=['cancel',id];return{cancelled:true}},revoke:async(_request,id)=>{command=['revoke',id];return{revoked:true}}};
 const handler=mod.createAccountLifecycleHandler(config,{service}),id='11111111-1111-4111-8111-111111111111',headers={origin:config.origin,'content-type':'application/json','x-csrf-token':'a'.repeat(43)};
 const cancel=await handler(new Request(config.origin+`/admin/api/accounts/invitations/${id}/cancel`,{method:'POST',headers,body:'{}'}));assert.equal(cancel.status,200);assert.deepEqual(command,['cancel',id]);
 const revoke=await handler(new Request(config.origin+`/admin/api/accounts/${id}/revoke`,{method:'POST',headers,body:'{}'}));assert.equal(revoke.status,200);assert.deepEqual(command,['revoke',id]);
 for(const request of [new Request('https://attacker.test/admin/api/accounts/'+id+'/revoke',{method:'POST',headers,body:'{}'}),new Request(config.origin+`/admin/api/accounts/${id}/revoke?next=/`,{method:'POST',headers,body:'{}'}),new Request(config.origin+`/admin/api/accounts/${id}/revoke`,{method:'POST',headers:{...headers,'content-type':'text/plain'},body:'{}'}),new Request(config.origin+`/admin/api/accounts/${id}/revoke`,{method:'POST',headers,body:'{"unexpected":true}'})])assert.ok([400,403,415].includes((await handler(request)).status));
 assert.deepEqual(command,['revoke',id]);
});
test('same-origin invitation prepare, issue and resend use bounded explicit POST bodies',async()=>{
 const calls=[],service={list:async()=>({admins:[],invitations:[]}),prepare:async(_request,email)=>{calls.push(['prepare',email]);return{id:'11111111-1111-4111-8111-111111111111',state:'pending'};},issue:async(_request,id)=>{calls.push(['issue',id]);return{state:'ready_for_delivery'};},resend:async(_request,id)=>{calls.push(['resend',id]);return{state:'pending'};},cancel:async()=>({cancelled:true}),revoke:async()=>({revoked:true})};
 const handler=mod.createAccountLifecycleHandler(config,{service}),id='11111111-1111-4111-8111-111111111111',headers={origin:config.origin,'content-type':'application/json','x-csrf-token':'a'.repeat(43)};
 const prepare=await handler(new Request(config.origin+'/admin/api/accounts/invitations/prepare',{method:'POST',headers,body:JSON.stringify({email:'admin@example.test'})}));assert.equal(prepare.status,200);assert.deepEqual(calls[0],['prepare','admin@example.test']);
 const issue=await handler(new Request(config.origin+`/admin/api/accounts/invitations/${id}/issue`,{method:'POST',headers,body:'{}'}));assert.equal(issue.status,200);assert.deepEqual(calls[1],['issue',id]);
 const resend=await handler(new Request(config.origin+`/admin/api/accounts/invitations/${id}/resend`,{method:'POST',headers,body:'{}'}));assert.equal(resend.status,200);assert.deepEqual(calls[2],['resend',id]);
 for(const body of ['{}','{"email":"admin@example.test","extra":true}','{"email":12}'])assert.notEqual((await handler(new Request(config.origin+'/admin/api/accounts/invitations/prepare',{method:'POST',headers,body}))).status,200);
});
test('same-origin password reset routes use active target identifiers and never accept caller-provided email',async()=>{
 const calls=[],service={list:async()=>({admins:[],invitations:[],passwordResets:[]}),prepareReset:async(_request,userId)=>{calls.push(['prepare',userId]);return{id:'33333333-3333-4333-8333-333333333333',state:'pending'};},issueReset:async(_request,id)=>{calls.push(['issue',id]);return{state:'ready_for_delivery'};},cancelReset:async(_request,id)=>{calls.push(['cancel',id]);return{cancelled:true};}};
 const handler=mod.createAccountLifecycleHandler(config,{service}),userId='11111111-1111-4111-8111-111111111111',resetId='33333333-3333-4333-8333-333333333333',headers={origin:config.origin,'content-type':'application/json','x-csrf-token':'a'.repeat(43)};
 const prepare=await handler(new Request(config.origin+'/admin/api/accounts/password-resets/prepare',{method:'POST',headers,body:JSON.stringify({userId})}));assert.equal(prepare.status,200);assert.deepEqual(calls[0],['prepare',userId]);
 assert.notEqual((await handler(new Request(config.origin+'/admin/api/accounts/password-resets/prepare',{method:'POST',headers,body:JSON.stringify({userId,email:'attacker@example.test'})}))).status,200);
 assert.equal((await handler(new Request(config.origin+`/admin/api/accounts/password-resets/${resetId}/issue`,{method:'POST',headers,body:'{}'}))).status,200);assert.deepEqual(calls[1],['issue',resetId]);
 assert.equal((await handler(new Request(config.origin+`/admin/api/accounts/password-resets/${resetId}/cancel`,{method:'POST',headers,body:'{}'}))).status,200);assert.deepEqual(calls[2],['cancel',resetId]);
});
test('authentication errors are redacted and feature mutations are never retried',async()=>{
 let writes=0;const handler=mod.createAccountLifecycleHandler(config,{service:{list:async()=>{throw new AuthError('private',428)},cancel:async()=>{writes++;return{cancelled:true}},revoke:async()=>{writes++;throw Error('private database error')}}});
 const get=await handler(new Request(config.origin+'/admin/api/accounts'));assert.equal(get.status,428);assert.ok(!(await get.text()).includes('private'));
 const id='22222222-2222-4222-8222-222222222222',request=new Request(config.origin+`/admin/api/accounts/${id}/revoke`,{method:'POST',headers:{origin:config.origin,'content-type':'application/json','x-csrf-token':'b'.repeat(43)},body:'{}'});
 const post=await handler(request);assert.equal(post.status,503);assert.equal(writes,1);
});
