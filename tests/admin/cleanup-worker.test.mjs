import test from 'node:test';import assert from 'node:assert/strict';
import {localDatabase} from './fixtures/local-sql.mjs';
import {seal} from '../../server/security.mjs';
const module=await import('../../server/cleanup-worker.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const config={sessionKey:'ab'.repeat(32)};
test('worker processes actual SQL queue, retries transient failure, resumes acknowledged tokens and never logs token material',async()=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql']);try{
 const user='11111111-1111-4111-8111-111111111111';await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[user,'owner@example.test']);await db.query('INSERT INTO farm_private.memberships(user_id,state) VALUES($1,\'active\')',[user]);
 const id=crypto.randomUUID(),aad='first-admin:'+id+':1',encrypted=await seal({invite:{access_token:'PRIVATE_INVITE'},previousProbes:[{access_token:'PRIVATE_OLD_PROBE'}],probe:{access_token:'PRIVATE_PROBE'}},config.sessionKey,aad);
 await db.query(`INSERT INTO farm_private.invitations(id,recipient_email,state,nonce_hash,expires_at,encrypted_credentials,credentials_generation,provider_cleanup_pending) VALUES($1,'owner@example.test','accepted',repeat('a',43),now(),$2,1,true)`,[id,encrypted]);
 const rpc=async(name,params)=>(await db.query(`SELECT public.${name}(${Object.values(params).map((_,i)=>'$'+(i+1)).join(',')}) AS result`,Object.values(params))).rows[0].result;
 const calls=[];let fail=true;const provider={signOut:async token=>{calls.push(token);if(token==='PRIVATE_OLD_PROBE'&&fail)throw Object.assign(new Error('PRIVATE_PROVIDER_DETAIL'),{status:503});}};
 const worker=module.createCleanupWorker(config,{provider,rpc});const first=await worker.run();assert.equal(first.retried,1);assert.equal((await db.query('SELECT completed_tokens FROM farm_private.cleanup_jobs')).rows[0].completed_tokens,1);assert.ok(!JSON.stringify(first).includes('PRIVATE'));
 fail=false;await db.exec(`UPDATE farm_private.cleanup_jobs SET next_attempt_at=now()-interval '1 second'`);const second=await worker.run();assert.equal(second.completed,1);assert.equal(calls.filter(value=>value==='PRIVATE_INVITE').length,1);assert.equal((await db.query('SELECT encrypted_credentials FROM farm_private.invitations')).rows[0].encrypted_credentials,null);
 }finally{await db.close();}
});
test('invalid ciphertext and provider 401 require durable review, never false cleanup acknowledgement',async()=>{
 const events=[],job={id:crypto.randomUUID(),encrypted_credentials:await seal({access_token:'PRIVATE'},config.sessionKey,'test'),aad:'test',completed_tokens:0};
 const rpc=async(name,p)=>{events.push({name,p});if(name==='farm_cleanup_claim')return [job];return true;};const worker=module.createCleanupWorker(config,{rpc,provider:{signOut:async()=>{throw Object.assign(new Error('PRIVATE'),{status:401});}}});assert.equal((await worker.run()).review,1);assert.equal(events.at(-1).p.p_outcome,'review');
 job.encrypted_credentials='invalid';assert.equal((await worker.run()).review,1);
});
