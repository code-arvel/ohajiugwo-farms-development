import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from './fixtures/local-sql.mjs';

test('private media reservations, publication, actor isolation, removal and cleanup leases enforce their SQL gates',async()=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql','202610170007_content_commands.sql','202610170008_private_media.sql','202610170009_media_content_refs.sql']);try{
  const actor='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
  await db.query(`INSERT INTO auth.users(id,email) VALUES($1,'owner@example.test'),($2,'other@example.test')`,[actor,other]);
  await db.query(`INSERT INTO farm_private.memberships(user_id,state) VALUES($1,'active'),($2,'active')`,[actor,other]);
  const rpc=async(name,args)=>(await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
  await rpc('farm_session_open',[actor,crypto.randomUUID(),'a'.repeat(43),'ENCRYPTED','b'.repeat(43)]);
  await rpc('farm_session_open',[other,crypto.randomUUID(),'c'.repeat(43),'ENCRYPTED','d'.repeat(43)]);
  const reservation=await rpc('farm_media_reserve',['a'.repeat(43),'image/png',1200]);assert.match(reservation.upload_path,/^staging\/[0-9a-f-]+\/source$/);assert.match(reservation.original_path,/^media\/[0-9a-f-]+\/[0-9a-f-]+\/original\.webp$/);
  const lease=crypto.randomUUID();assert.equal(await rpc('farm_media_claim',['c'.repeat(43),reservation.id,lease]),false);assert.equal(await rpc('farm_media_claim',['a'.repeat(43),reservation.id,lease]),true);
  assert.equal(await rpc('farm_media_ready',['a'.repeat(43),reservation.id,crypto.randomUUID(),800,600,'image/webp',900,'f'.repeat(64)]),false);
  assert.equal(await rpc('farm_media_ready',['a'.repeat(43),reservation.id,lease,800,600,'image/webp',900,'f'.repeat(64)]),true);
  const items=await rpc('farm_media_list',['a'.repeat(43)]);assert.equal(items.length,1);assert.equal(items[0].metadata.mimeType,'image/webp');assert.equal(JSON.stringify(items).includes('original_path'),false);
  const preview=await rpc('farm_media_preview_path',['a'.repeat(43),reservation.media_id,reservation.version_id]);assert.equal(preview,reservation.preview_path);
  await assert.rejects(()=>rpc('farm_media_preview_path',['e'.repeat(43),reservation.media_id,reservation.version_id]));
  const content='44444444-4444-4444-8444-444444444444',revision='55555555-5555-4555-8555-555555555555';
  const payload=JSON.stringify({slug:'fixture-photo',title:'Fixture',excerpt:'A test.',publishedAt:'',cover:'planting',status:'draft',body:{type:'doc',content:[]},mediaVersionId:reservation.version_id});
  await db.query(`INSERT INTO public.farm_content(id,kind,payload) VALUES($1,'post',$2::jsonb)`,[content,payload]);
  await db.query(`INSERT INTO public.farm_revisions(id,content_id,revision,payload,actor_id) VALUES($1,$2,1,$3::jsonb,$4)`,[revision,content,payload,actor]);
  assert.equal((await db.query(`SELECT count(*)::int AS count FROM public.farm_media_usages WHERE revision_id=$1 AND media_version_id=$2`,[revision,reservation.version_id])).rows[0].count,1);
  await assert.rejects(()=>rpc('farm_media_remove',['a'.repeat(43),reservation.media_id]));
  const secondSlot=await rpc('farm_media_reserve',['a'.repeat(43),'image/jpeg',1300]),secondLease=crypto.randomUUID();assert.equal(await rpc('farm_media_claim',['a'.repeat(43),secondSlot.id,secondLease]),true);assert.equal(await rpc('farm_media_ready',['a'.repeat(43),secondSlot.id,secondLease,640,480,'image/webp',700,'e'.repeat(64)]),true);
  assert.equal(await rpc('farm_media_remove',['a'.repeat(43),secondSlot.media_id]),true);assert.equal((await rpc('farm_media_list',['a'.repeat(43)])).length,1);
  const owner=crypto.randomUUID(),jobs=await db.query(`SELECT * FROM public.farm_media_cleanup_claim($1,5)`,[owner]);assert.equal(jobs.rows.length,1);assert.equal(jobs.rows[0].farm_media_cleanup_claim.paths.length,2);
  assert.equal(await rpc('farm_media_cleanup_finish',[jobs.rows[0].farm_media_cleanup_claim.id,crypto.randomUUID(),true]),false);
  assert.equal(await rpc('farm_media_cleanup_finish',[jobs.rows[0].farm_media_cleanup_claim.id,owner,false]),true);
  assert.equal((await db.query(`SELECT state FROM farm_private.media_cleanup WHERE id=$1`,[jobs.rows[0].farm_media_cleanup_claim.id])).rows[0].state,'queued');
  assert.equal((await db.query(`SELECT has_function_privilege('authenticated','public.farm_media_reserve(text,text,bigint)','EXECUTE') allowed`)).rows[0].allowed,false);
 }finally{await db.close();}
});
