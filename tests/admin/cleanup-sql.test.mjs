import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from './fixtures/local-sql.mjs';
test('new cleanup SQL claims only safe sources, owns leases, preserves retry payload and clears only acknowledged sources',async()=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql']);try{
 await db.exec(`INSERT INTO auth.users(id,email) VALUES('11111111-1111-4111-8111-111111111111','owner@example.test');INSERT INTO farm_private.memberships(user_id,state) VALUES('11111111-1111-4111-8111-111111111111','active');`);
 const opened=await db.query(`SELECT public.farm_session_open('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',repeat('a',43),'ENCRYPTED',repeat('b',43)) AS row`),session=opened.rows[0].row;
 const rpc=async(name,args)=> (await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS result`,args)).rows[0].result;
 const owner='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
 assert.deepEqual(await rpc('farm_cleanup_claim',[owner,5]),[]);
 await db.exec(`UPDATE farm_private.sessions SET revoked_at=now(),provider_cleanup_pending=true,reauth_until=now()+interval '60 seconds';`);assert.deepEqual(await rpc('farm_cleanup_claim',[owner,5]),[]);
 await db.exec(`UPDATE farm_private.sessions SET reauth_until=now()-interval '1 second';`);const jobs=await rpc('farm_cleanup_claim',[owner,5]);assert.equal(jobs.length,1);assert.equal(jobs[0].aad,'a'.repeat(43));assert.equal(jobs[0].encrypted_credentials,'ENCRYPTED');
 assert.equal((await db.query('SELECT reauth_until FROM farm_private.sessions')).rows[0].reauth_until,null);assert.deepEqual(await rpc('farm_cleanup_claim',[other,5]),[]);
 assert.equal(await rpc('farm_cleanup_progress',[jobs[0].id,other,1]),false);assert.equal(await rpc('farm_cleanup_progress',[jobs[0].id,owner,1]),true);
 assert.equal(await rpc('farm_cleanup_finish',[jobs[0].id,owner,'retry']),true);assert.equal((await db.query('SELECT encrypted_credentials FROM farm_private.sessions')).rows[0].encrypted_credentials,'ENCRYPTED');assert.deepEqual(await rpc('farm_cleanup_claim',[other,5]),[]);
 await db.exec(`UPDATE farm_private.cleanup_jobs SET next_attempt_at=now()-interval '1 second';`);const retried=await rpc('farm_cleanup_claim',[other,5]);assert.equal(retried[0].completed_tokens,1);assert.equal(await rpc('farm_cleanup_finish',[retried[0].id,owner,'done']),false);assert.equal(await rpc('farm_cleanup_finish',[retried[0].id,other,'done']),true);
 const final=(await db.query('SELECT provider_cleanup_pending,encrypted_credentials FROM farm_private.sessions')).rows[0];assert.equal(final.provider_cleanup_pending,false);assert.equal(final.encrypted_credentials,'');
 assert.equal((await db.query(`SELECT has_function_privilege('anon','public.farm_cleanup_claim(uuid,integer)','EXECUTE') allowed`)).rows[0].allowed,false);
 assert.equal(session.cookie_hash,'a'.repeat(43));
 for(const hash of ['c','d'])await db.query(`INSERT INTO farm_private.sessions(user_id,cookie_hash,provider_session_id,encrypted_credentials,csrf_hash,idle_expires_at,absolute_expires_at,revoked_at,provider_cleanup_pending) VALUES('11111111-1111-4111-8111-111111111111',repeat($1,43),gen_random_uuid()::text,'NEXT',repeat('e',43),now()+interval '1 hour',now()+interval '2 hours',now(),true)`,[hash]);
 const review=await rpc('farm_cleanup_claim',[owner,1]);assert.equal(review.length,1);await rpc('farm_cleanup_finish',[review[0].id,owner,'review']);assert.equal((await rpc('farm_cleanup_claim',[other,1])).length,1,'review work must not starve newer sources');
 }finally{await db.close();}
});
