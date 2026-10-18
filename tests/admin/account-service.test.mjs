import test from'node:test';import assert from'node:assert/strict';import{createAccountLifecycleService}from'../../server/auth/account-lifecycle.mjs';
test('account service requires fresh confirmation and mutation CSRF before service-only SQL commands',async()=>{
 const options=[],calls=[],actor={user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'}};Object.defineProperty(actor,'cookieHash',{value:'a'.repeat(43)});
 const auth={async authenticate(_request,value){options.push(value);return actor;}},rpc=async(name,params)=>{calls.push([name,params]);if(name==='farm_admin_list')return{admins:[{id:actor.user.id,email:actor.user.email,createdAt:new Date().toISOString()}],invitations:[],passwordResets:[]};return true;};
 const service=createAccountLifecycleService({auth,rpc}),request=new Request('https://example.test/');
 assert.equal((await service.list(request)).admins.length,1);assert.deepEqual(options[0],{requireRecent:true});
 await service.revoke(request,'22222222-2222-4222-8222-222222222222');await service.cancel(request,'33333333-3333-4333-8333-333333333333');
 assert.deepEqual(options.slice(1),[{requireRecent:true,requireMutation:true},{requireRecent:true,requireMutation:true}]);
 assert.deepEqual(calls.map(([name])=>name),['farm_admin_list','farm_admin_revoke','farm_admin_invite_cancel']);assert.ok(calls.every(([,params])=>params.p_actor_cookie_hash==='a'.repeat(43)));
});
test('account service withholds malformed inventory and never returns private SQL fields',async()=>{
 const actor={user:{id:'11111111-1111-4111-8111-111111111111'}};Object.defineProperty(actor,'cookieHash',{value:'b'.repeat(43)});
 const service=createAccountLifecycleService({auth:{authenticate:async()=>actor},rpc:async()=>({admins:[{id:actor.user.id,email:'owner@example.test',createdAt:new Date().toISOString(),encrypted_credentials:'SECRET'}],invitations:[],passwordResets:[]})});
 const result=await service.list(new Request('https://example.test/'));assert.ok(!JSON.stringify(result).includes('SECRET'));
});

test('account invitations persist nonce, issue provider link once and report delivery as pending without sending mail',async()=>{
 const actor={user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'}};Object.defineProperty(actor,'cookieHash',{value:'a'.repeat(43)});
 const calls=[],rpc=async(name,params)=>{calls.push([name,params]);if(name==='farm_admin_invite_prepare'||name==='farm_admin_invite_resend')return{id:'22222222-2222-4222-8222-222222222222',recipient_email:'new-admin@example.test',state:'queued',issue_state:'new',generation:1,expires_at:'2030-01-01T00:00:00Z'};if(name==='farm_admin_invite_claim')return{id:params.p_id,invited_by:actor.user.id,recipient_email:'new-admin@example.test',state:'queued',issue_state:'new',generation:1,expires_at:'2030-01-01T00:00:00Z'};if(name==='farm_admin_invite_issue_effect_finish')return true;if(name==='farm_admin_invite_release')return null;throw Error('unexpected RPC');};
 let generated=0,sent=0,captured=0;const provider={async generateInvite(email){generated++;return{user:{id:'33333333-3333-4333-8333-333333333333',email},tokenHash:'provider-token-hash-12345678901234567890'};}};
 const effects={async begin(operation){assert.equal(operation,'invite_issue');return{id:'44444444-4444-4444-8444-444444444444',owner:'55555555-5555-4555-8555-555555555555'};},async capture(_effect,tokens){captured++;assert.ok(tokens.tokenHash);},async release(){throw Error('not expected');}};
 const service=createAccountLifecycleService({sessionKey:'0'.repeat(64),accountInviteIssueEnabled:true},{auth:{authenticate:async()=>actor},rpc,provider,effects,now:()=>Date.parse('2029-01-01T00:00:00Z')}),request=new Request('https://example.test/');
 const prepared=await service.prepare(request,' New-Admin@Example.Test ');assert.equal(prepared.state,'pending');assert.equal(calls[0][1].p_email,'new-admin@example.test');assert.equal(calls[0][1].p_nonce_hash.length,43);assert.ok(calls[0][1].p_encrypted_nonce);
 const ready=await service.issue(request,prepared.id);assert.equal(ready.state,'ready_for_delivery');assert.equal(generated,1);assert.equal(captured,1);assert.equal(sent,0);assert.ok(!JSON.stringify(ready).includes('provider-token'));
 assert.equal(calls.find(([name])=>name==='farm_admin_invite_issue_effect_finish')[1].p_actor_cookie_hash,'a'.repeat(43));assert.ok(calls.some(([name])=>name==='farm_admin_invite_release'));
 const resent=await service.resend(request,prepared.id);assert.equal(resent.state,'pending');assert.equal(generated,1);
});
test('provider identity issuance stops before claims while its independent gate is closed',async()=>{
 const actor={user:{id:'11111111-1111-4111-8111-111111111111'}};Object.defineProperty(actor,'cookieHash',{value:'a'.repeat(43)});let calls=0;
 const service=createAccountLifecycleService({sessionKey:'0'.repeat(64),accountInviteIssueEnabled:false},{auth:{authenticate:async()=>actor},rpc:async()=>{calls++;},provider:{generateInvite:async()=>{calls++;}},effects:{begin:async()=>{calls++;}}});
 await assert.rejects(()=>service.issue(new Request('https://example.test/'),'22222222-2222-4222-8222-222222222222'),error=>error.status===503);assert.equal(calls,0);
});
test('recovery uses only an active account id, binds the provider link, and leaves email delivery pending',async()=>{
 const actor={user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'}};Object.defineProperty(actor,'cookieHash',{value:'a'.repeat(43)});
 const calls=[],rpc=async(name,params)=>{calls.push([name,params]);if(name==='farm_admin_reset_prepare'||name==='farm_admin_reset_claim')return{id:'22222222-2222-4222-8222-222222222222',user_id:'33333333-3333-4333-8333-333333333333',recipient_email:'target@example.test',invited_by:actor.user.id,purpose:'password_reset',state:'queued',issue_state:name.endsWith('claim')?'issuing':'new',expires_at:'2030-01-01T00:00:00Z',generation:1};if(name==='farm_admin_reset_issue_effect_finish')return true;if(name==='farm_admin_reset_release')return null;throw Error('unexpected RPC');};
 let generated=0;const provider={async generateRecovery(email){generated++;return{user:{id:'33333333-3333-4333-8333-333333333333',email},tokenHash:'mock-recovery-token-hash-1234567890'};}};
 const effects={async begin(operation){assert.equal(operation,'reset_issue');return{id:'44444444-4444-4444-8444-444444444444',owner:'55555555-5555-4555-8555-555555555555'};},async capture(_effect,value){assert.ok(value.tokenHash);},async release(){throw Error('unexpected release');}};
 const service=createAccountLifecycleService({sessionKey:'0'.repeat(64),accountRecoveryIssueEnabled:true},{auth:{authenticate:async()=>actor},rpc,provider,effects,now:()=>Date.parse('2029-01-01T00:00:00Z')}),request=new Request('https://example.test/');
 const prepared=await service.prepareReset(request,'33333333-3333-4333-8333-333333333333');assert.equal(prepared.state,'pending');assert.equal(calls[0][1].p_user_id,'33333333-3333-4333-8333-333333333333');assert.equal('p_email' in calls[0][1],false);
 const ready=await service.issueReset(request,prepared.id);assert.equal(ready.state,'ready_for_delivery');assert.equal(generated,1);assert.ok(!JSON.stringify(ready).includes('recovery-token'));
 assert.equal(calls.find(([name])=>name==='farm_admin_reset_issue_effect_finish')[1].p_user_id,'33333333-3333-4333-8333-333333333333');assert.ok(calls.some(([name])=>name==='farm_admin_reset_release'));
});
