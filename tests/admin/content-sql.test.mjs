import test from 'node:test';import assert from 'node:assert/strict';
import {localDatabase} from './fixtures/local-sql.mjs';

const migrations=['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql','202610170007_content_commands.sql'];
const user='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
const doc={company:{name:'Farm',displayName:'Farm',email:'',headquarters:'Enugu',farmland:'Enugu',hectares:1,mission:'Care.',vision:'Grow.',values:['Care','Soil','People']},products:[{title:'A',description:'B',enquiry:'Ask'},{title:'C',description:'D',enquiry:'Ask'},{title:'E',description:'F',enquiry:'Ask'}],services:[{title:'A',description:'B',enquiry:'Ask'},{title:'C',description:'D',enquiry:'Ask'},{title:'E',description:'F',enquiry:'Ask'}]};
test('content commands grant only active user sessions and preserve immutable CAS revisions through trash',async()=>{
 const db=await localDatabase(migrations);try{
  const grants=await db.query(`SELECT has_function_privilege('anon','public.farm_content_list()','EXECUTE') AS anon,has_function_privilege('authenticated','public.farm_content_list()','EXECUTE') AS member,has_function_privilege('service_role','public.farm_content_list()','EXECUTE') AS service,has_function_privilege('authenticated','public.farm_content_trash_list()','EXECUTE') AS trash_list,has_function_privilege('authenticated','public.farm_content_untrash(uuid,integer)','EXECUTE') AS untrash`);
  assert.deepEqual(grants.rows[0],{anon:false,member:true,service:false,trash_list:true,untrash:true});
  await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password) VALUES($1,'local@example.test',now(),'dummy')`,[user]);
  await db.query(`INSERT INTO farm_private.memberships(user_id,state) VALUES($1,'active')`,[user]);
  await db.query(`INSERT INTO farm_private.sessions(user_id,provider_session_id,cookie_hash,encrypted_credentials,csrf_hash,idle_expires_at,absolute_expires_at)
   VALUES($1,$2,$3,'sealed-fixture',$4,now()+interval '20 minutes',now()+interval '12 hours')`,[user,session,'a'.repeat(43),'b'.repeat(43)]);
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${user}',false);SELECT set_config('request.jwt.claims','{"session_id":"${session}"}',false);SET ROLE authenticated;`);
  let saved=(await db.query('SELECT public.farm_content_save(NULL,\'homepage\',NULL,$1::jsonb) AS row',[JSON.stringify(doc)])).rows[0].row;
  const id=saved.id;assert.equal(saved.revision,1);assert.equal(saved.review_only,true);
  const next=structuredClone(doc);next.company.mission='Better soil.';
  saved=(await db.query('SELECT public.farm_content_save($1,\'homepage\',1,$2::jsonb) AS row',[id,JSON.stringify(next)])).rows[0].row;assert.equal(saved.revision,2);
  await assert.rejects(()=>db.query('SELECT public.farm_content_save($1,\'homepage\',1,$2::jsonb)',[id,JSON.stringify(doc)]),error=>error.code==='40001');
  const history=(await db.query('SELECT public.farm_content_history($1) AS revisions',[id])).rows[0].revisions;assert.equal(history.length,2);
  saved=(await db.query('SELECT public.farm_content_restore($1,1,2) AS row',[id])).rows[0].row;assert.equal(saved.revision,3);assert.equal(saved.payload.company.mission,doc.company.mission);
  assert.equal((await db.query('SELECT public.farm_content_trash($1,3) AS trashed',[id])).rows[0].trashed,false);
  const post=(await db.query(`SELECT public.farm_content_save(NULL,'post',NULL,$1::jsonb) AS row`,[JSON.stringify({slug:'draft-post',title:'Draft',excerpt:'Short.',publishedAt:'',cover:'planting',status:'draft',body:{type:'doc',content:[{type:'paragraph'}]}})])).rows[0].row;
  assert.equal((await db.query('SELECT public.farm_content_trash($1,1) AS trashed',[post.id])).rows[0].trashed,true);
  assert.equal((await db.query('SELECT public.farm_content_read($1) AS row',[post.id])).rows[0].row,null);
  assert.equal((await db.query('SELECT public.farm_content_trash_list() AS rows')).rows[0].rows.length,1);
  await assert.rejects(()=>db.query('SELECT public.farm_content_untrash($1,0) AS row',[post.id]),error=>error.code==='40001');
  saved=(await db.query('SELECT public.farm_content_untrash($1,1) AS row',[post.id])).rows[0].row;assert.equal(saved.revision,2);assert.equal(saved.deleted_at,null);
  assert.equal((await db.query('SELECT public.farm_content_list() AS rows')).rows[0].rows.length,2);
  await db.exec('RESET ROLE;');await db.exec("SELECT set_config('request.jwt.claim.sub','',false);SELECT set_config('request.jwt.claims','{}',false);");
  await db.exec('SET ROLE authenticated;');await assert.rejects(()=>db.query('SELECT public.farm_content_list()'),error=>error.code==='42501');await db.exec('RESET ROLE;');
 }finally{await db.close();}
});
