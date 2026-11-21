import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {localDatabase} from './fixtures/local-sql.mjs';
const extra=['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql','202610170007_content_commands.sql','202610170008_private_media.sql','202610170009_media_content_refs.sql','202611140010_content_conflict_status.sql','202611140011_cleanup_review_inspection.sql'];
test('real review SQL is bounded, read-only and denies both browser roles',async()=>{
 const db=await localDatabase(extra);try{
 const user=crypto.randomUUID(),session=crypto.randomUUID(),providerSession=crypto.randomUUID(),job=crypto.randomUUID();
 await db.query("INSERT INTO auth.users(id,email) VALUES($1,'fixture@example.test')",[user]);
 await db.query("INSERT INTO farm_private.sessions(id,user_id,provider_session_id,cookie_hash,encrypted_credentials,csrf_hash,idle_expires_at,absolute_expires_at,revoked_at) VALUES($1,$2,$3,repeat('a',43),'PRIVATE_CIPHERTEXT',repeat('b',43),now(),now(),now())",[session,user,providerSession]);
 await db.query("INSERT INTO farm_private.cleanup_jobs(id,source_kind,source_id,encrypted_credentials,aad,source_fingerprint,state) VALUES($1,'session',$2,'PRIVATE_CIPHERTEXT',repeat('a',43),md5('PRIVATE_CIPHERTEXT'),'review')",[job,session]);
 await db.query("INSERT INTO farm_private.cleanup_jobs(source_kind,source_id,encrypted_credentials,aad,source_fingerprint,state) VALUES('effect',gen_random_uuid(),'HIDDEN','HIDDEN',md5('HIDDEN'),'review')");
 const before=(await db.query('SELECT * FROM farm_private.cleanup_jobs ORDER BY id')).rows;
 const value=(await db.query('SELECT public.farm_cleanup_review_read(1) result')).rows[0].result;
 assert.equal(value.length,1);assert.equal(value[0].id,job);assert.equal(value[0].source_revoked,true);assert.equal(value[0].source_matches,true);assert.equal(value[0].encrypted_credentials,'PRIVATE_CIPHERTEXT');
 const results=await db.exec(await readFile('supabase/tests/cleanup-review-inspection.sql','utf8'));
 assert.match(results.at(-1).rows[0].result,/PASS:/);
 assert.deepEqual((await db.query('SELECT * FROM farm_private.cleanup_jobs ORDER BY id')).rows,before);
 }finally{await db.close();}
});
