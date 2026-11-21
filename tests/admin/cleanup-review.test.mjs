import test from 'node:test';import assert from 'node:assert/strict';
import {seal} from '../../server/security.mjs';
const {inspectCleanupReview,classifyCleanupProviderResponse}=await import('../../server/cleanup-review.mjs');
const key='ab'.repeat(32),user=crypto.randomUUID(),session=crypto.randomUUID();
const token=exp=>'eyJhbGciOiJNT0NLIn0.'+Buffer.from(JSON.stringify({sub:user,session_id:session,exp})).toString('base64url')+'.DUMMY';
test('review inspection decrypts only in memory, checks identity and expiration and prints no secrets',async()=>{
 const access=token(1),job={id:crypto.randomUUID(),source_kind:'session',state:'review',attempts:1,completed_tokens:0,aad:'PRIVATE_AAD',source_user_id:user,provider_session_id:session,source_revoked:true,source_matches:true};
 job.encrypted_credentials=await seal({access_token:access,refresh_token:'PRIVATE_REFRESH'},key,job.aad);
 let calls=0;const report=await inspectCleanupReview({sessionKey:key},{rpc:async()=>[job],inspectToken:async value=>{calls++;assert.equal(value,access);return{status:403,reason:'expired_jwt'};},now:()=>100000});
 assert.equal(calls,1);assert.equal(report.jobs[0].payloadReadable,true);assert.equal(report.jobs[0].accessExpired,true);assert.equal(report.jobs[0].identityMatches,true);assert.equal(report.jobs[0].providerReason,'expired_jwt');
 const output=JSON.stringify(report);for(const secret of [access,'PRIVATE_REFRESH','PRIVATE_AAD',user,session,job.encrypted_credentials])assert.ok(!output.includes(secret));
});
test('invalid ciphertext and identity mismatch never send a token to Auth',async()=>{
 let calls=0;const bad={id:crypto.randomUUID(),source_kind:'session',state:'review',aad:'PRIVATE',source_revoked:true,source_matches:true,encrypted_credentials:'invalid'};
 const wrong={...bad,id:crypto.randomUUID(),source_user_id:crypto.randomUUID(),provider_session_id:session,encrypted_credentials:await seal({access_token:token(1)},key,'PRIVATE')};
 const report=await inspectCleanupReview({sessionKey:key},{rpc:async()=>[bad,wrong],inspectToken:async()=>{calls++;}});
 assert.equal(calls,0);assert.equal(report.jobs[0].payloadReadable,false);assert.equal(report.jobs[1].identityMatches,false);
});

test('cleanup diagnostic recognises both legacy and versioned Supabase error formats without exposing provider messages',()=>{for(const data of [{code:403,error_code:'bad_jwt',msg:'invalid JWT: token is expired PRIVATE_PROVIDER_DETAIL'},{code:'bad_jwt',message:'JWT expired PRIVATE_PROVIDER_DETAIL'}]){const result=classifyCleanupProviderResponse(403,data);assert.deepEqual(result,{status:403,reason:'expired_jwt'});assert.ok(!JSON.stringify(result).includes('PRIVATE_PROVIDER_DETAIL'));}for(const data of [{code:403,error_code:'session_not_found',msg:'PRIVATE'},{code:'session_not_found',message:'PRIVATE'}])assert.deepEqual(classifyCleanupProviderResponse(403,data),{status:403,reason:'session_not_found'});assert.deepEqual(classifyCleanupProviderResponse(403,{code:403,error_code:'bad_jwt',msg:'invalid signature PRIVATE'}),{status:403,reason:'rejected'});assert.deepEqual(classifyCleanupProviderResponse(503,{}),{status:503,reason:'unavailable'});});
