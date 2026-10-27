import test from'node:test';import assert from'node:assert/strict';import{seal}from'../../server/security.mjs';
const mod=await import('../../server/auth/additional-admin-acceptance.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
test('additional administrator acceptance reuses the password proof flow through inviter-bound SQL commands',async()=>{
 assert.equal(typeof mod.createInvitationAcceptanceService,'function');
 const id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',nonce='a'.repeat(43),tokenHash='invite-token-hash-12345678901234567890',key='ab'.repeat(32),calls=[];
 const rpc=async(name,params)=>{calls.push([name,params]);if(name==='farm_invitation_read')return{...row,id, user_id:user,recipient_email:'admin@example.test',invited_by:'33333333-3333-4333-8333-333333333333',nonce_hash:awaitDigest(nonce),generation:2,issue_state:'ready',state:'queued',encrypted_invite:await seal({tokenHash},key,`first-admin:${id}:2`)};if(name==='farm_auth_attempt')return true;if(name==='farm_admin_invite_accept_claim')return{...row,id,user_id:user,recipient_email:'admin@example.test',nonce_hash:awaitDigest(nonce),generation:2,issue_state:'ready',encrypted_invite:await seal({tokenHash},key,`first-admin:${id}:2`)};if(name==='farm_admin_invite_accept_progress'||name==='farm_admin_invite_activate')return true;if(name==='farm_admin_invite_release'||name==='farm_admin_invite_cleanup_done')return null;throw Error(`unexpected ${name}`);};
 const provider={verifyInvite:async value=>{assert.equal(value,tokenHash);return{access_token:'invite-access',refresh_token:'invite-refresh'};},getUser:async()=>({id:user,email:'admin@example.test',email_confirmed_at:'2026-01-01T00:00:00Z'}),updatePassword:async()=>null,signIn:async()=>({access_token:'proof-access',refresh_token:'proof-refresh'}),signOut:async()=>null};
 const service=mod.createInvitationAcceptanceService({sessionKey:key},{provider,rpc});
 let result;try{result=await service.accept({id,nonce,tokenHash,password:'dummy-password-123',clientIp:'127.0.0.1'});}catch(error){assert.fail(`${error.message}; calls=${calls.map(([name])=>name).join(',')}`);}
 assert.deepEqual(result,{activated:true,signInRequired:true,providerCleanupPending:false});
 assert.deepEqual(calls.map(([name])=>name),['farm_invitation_read','farm_auth_attempt','farm_auth_attempt','farm_admin_invite_accept_claim','farm_admin_invite_accept_progress','farm_admin_invite_accept_progress','farm_admin_invite_activate','farm_admin_invite_cleanup_done','farm_admin_invite_release']);
 assert.ok(calls.every(([,params])=>!JSON.stringify(params).includes('dummy-password-123')));
});
const row={lease_until:new Date(Date.now()+60000).toISOString()};
test('lookup diagnostic reports only allowlisted failure metadata',async()=>{
 const reports=[],failure=Object.assign(new Error('PRIVATE'),{status:503,failureKind:'transport',transportType:'TypeError'});
 const service=mod.createInvitationAcceptanceService({sessionKey:'ab'.repeat(32)},{provider:{},rpc:async()=>{throw failure;},reportLookupFailure:report=>reports.push(report)});
 await assert.rejects(service.accept({id:'PRIVATE'}));
 assert.deepEqual(reports,[{event:'admin_acceptance_lookup_failed',upstreamStatus:503,failureKind:'transport',transportType:'TypeError'}]);
});
test('failed invitation lookup records only a safe upstream status and preserves the failure',async()=>{
 const reports=[],failure=Object.assign(new Error('PRIVATE provider detail'),{status:401});
 const service=mod.createInvitationAcceptanceService({sessionKey:'ab'.repeat(32)},{provider:{},rpc:async()=>{throw failure;},reportLookupFailure:report=>reports.push(report)});
 await assert.rejects(service.accept({id:'PRIVATE invitation',password:'PRIVATE password'}),error=>error===failure);
 assert.deepEqual(reports,[{event:'admin_acceptance_lookup_failed',upstreamStatus:401}]);
 assert.ok(!JSON.stringify(reports).includes('PRIVATE'));
});
test('lookup diagnostics reject arbitrary error status text and cannot replace the original failure',async()=>{
 const reports=[],failure=Object.assign(new Error('PRIVATE detail'),{status:'PRIVATE status'});
 const service=mod.createInvitationAcceptanceService({sessionKey:'ab'.repeat(32)},{provider:{},rpc:async()=>{throw failure;},reportLookupFailure:report=>{reports.push(report);throw new Error('logger failure');}});
 await assert.rejects(service.accept({id:'PRIVATE'}),error=>error===failure);
 assert.deepEqual(reports,[{event:'admin_acceptance_lookup_failed',upstreamStatus:null}]);
});
async function awaitDigest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
