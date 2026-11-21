import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localDatabase} from './fixtures/local-sql.mjs';
import {createHostedAuthProvider} from '../../server/auth/provider.mjs';
import {createContentService} from '../../server/content/content-service.mjs';
import {createContentHandler} from '../../server/content/content-http.mjs';
const prerequisites=['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql','202610170007_content_commands.sql','202610170008_private_media.sql','202610170009_media_content_refs.sql'];
test('stale draft writers receive a non-retryable conflict and never overwrite a saved revision',async()=>{
 const db=await localDatabase(prerequisites);try{
 await db.exec(await readFile('supabase/migrations/202611140010_content_conflict_status.sql','utf8'));
 const user=crypto.randomUUID(),session=crypto.randomUUID();
 await db.query("INSERT INTO auth.users(id,email) VALUES($1,'conflict@example.test')",[user]);
 await db.query("INSERT INTO farm_private.memberships(user_id,state) VALUES($1,'active')",[user]);
 await db.query("SELECT public.farm_session_open($1,$2,$3,'DUMMY',$4)",[user,session,'a'.repeat(43),'b'.repeat(43)]);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({session_id:session})]);
 await db.exec('SET ROLE authenticated');
 const payload={slug:'conflict-fixture',title:'Original',excerpt:'A test.',publishedAt:'',cover:'planting',status:'draft',body:{type:'doc',content:[{type:'paragraph'}]}};
 const first=(await db.query("SELECT public.farm_content_save(NULL,'post',NULL,$1::jsonb) saved",[JSON.stringify(payload)])).rows[0].saved;
 await db.query("SELECT public.farm_content_save($1,'post',1,$2::jsonb)",[first.id,JSON.stringify({...payload,title:'Saved from A'})]);
 await assert.rejects(db.query("SELECT public.farm_content_save($1,'post',1,$2::jsonb)",[first.id,JSON.stringify({...payload,title:'Stale from B'})]),error=>error.code==='PT409');
 const current=(await db.query('SELECT public.farm_content_read($1) saved',[first.id])).rows[0].saved;
 assert.equal(current.payload.title,'Saved from A');assert.equal(current.revision,2);
 assert.equal((await db.query('SELECT public.farm_content_history($1) history',[first.id])).rows[0].history.length,2);
 }finally{await db.close();}
});
test('PostgREST explicit conflict survives the provider/service/HTTP boundary with safe wording',async()=>{
 const origin='https://farm.example.test',provider=createHostedAuthProvider({supabaseUrl:'https://fixture.supabase.co',publishableKey:'MOCK',secretKey:'UNUSED'},{fetchImpl:async()=>Response.json({code:'PT409',message:'PRIVATE SQL DETAIL',details:'PRIVATE PAYLOAD'},{status:409})});
 const service=createContentService({auth:{authenticate:async()=>({accessToken:'DUMMY'})},provider});
 const handler=createContentHandler({origin},{service});
 const response=await handler(new Request(origin+'/admin/api/content',{method:'POST',headers:{origin,'Content-Type':'application/json','x-csrf-token':'a'.repeat(43)},body:JSON.stringify({id:crypto.randomUUID(),kind:'post',baseRevision:1,payload:{slug:'test',title:'Test title',excerpt:'A short introduction.',publishedAt:'',cover:'planting',status:'draft',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Dummy paragraph.'}]}]}}})}));
 assert.equal(response.status,409);const body=await response.text();assert.match(body,/changed elsewhere/);assert.ok(!body.includes('PRIVATE'));
});

test('complete rollback-only conflict verification leaves existing rows intact',async()=>{
 const db=await localDatabase([...prerequisites,'202611140010_content_conflict_status.sql']);try{
 const before=await db.query('SELECT (SELECT count(*) FROM auth.users) users,(SELECT count(*) FROM public.farm_content) content,(SELECT count(*) FROM farm_private.memberships) memberships');
 const results=await db.exec(await readFile('supabase/tests/content-conflict-status.sql','utf8'));
 assert.match(results.at(-1).rows[0].result,/PASS:/);
 const after=await db.query('SELECT (SELECT count(*) FROM auth.users) users,(SELECT count(*) FROM public.farm_content) content,(SELECT count(*) FROM farm_private.memberships) memberships');
 assert.deepEqual(after.rows,before.rows);
 }finally{await db.close();}
});
