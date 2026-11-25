import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{reconciliationFixture}from'./fixtures/session-reconciliation.mjs';
async function fixture(){const h=await reconciliationFixture();try{await h.db.exec(await readFile('supabase/migrations/202611250016_account_email_delivery.sql','utf8'));await h.db.exec("UPDATE farm_private.sessions SET reauthenticated_at=clock_timestamp() WHERE cookie_hash=repeat('a',43)");return h;}catch(e){await h.db.close();throw e;}}
test('email delivery intent/finish is owner-lease bound, reports provider acceptance honestly and cannot repeat send intent',async()=>{const h=await fixture();try{
 const cookie='a'.repeat(43),recipient=crypto.randomUUID(),inviteOwner=crypto.randomUUID(),effect=crypto.randomUUID(),effectOwner=crypto.randomUUID();await h.db.query("INSERT INTO auth.users(id,email) VALUES($1,'recipient@example.test')",[recipient]);
 const row=(await h.db.query("SELECT public.farm_admin_invite_prepare($1,'recipient@example.test',repeat('n',43),'sealed-nonce') result",[cookie])).rows[0].result;
 await h.db.query('SELECT public.farm_admin_invite_claim($1,$2,$3)',[cookie,row.id,inviteOwner]);
 const begin=async(owner=inviteOwner)=> (await h.db.query("SELECT public.farm_admin_email_begin($1,$2,$3,'admin_invite') result",[cookie,row.id,owner])).rows[0].result;
 assert.equal(await begin(crypto.randomUUID()),false);assert.equal(await begin(),true);assert.equal(await begin(),false);
 await h.db.query("SELECT public.farm_effect_begin($1,repeat('s',43),'invite_issue',$2,'sealed-context')",[effect,effectOwner]);await h.db.query("SELECT public.farm_effect_capture($1,$2,'sealed-delivery-marker')",[effect,effectOwner]);
 const finish=async()=> (await h.db.query("SELECT public.farm_admin_email_finish($1,$2,$3,$4,$5,$6,'sealed-marker','admin_invite') result",[effect,effectOwner,cookie,row.id,inviteOwner,recipient])).rows[0].result;
 assert.equal(await finish(),true);assert.equal(await finish(),false);
 const list=(await h.db.query('SELECT public.farm_admin_list($1) result',[cookie])).rows[0].result;assert.equal(list.invitations[0].deliveryState,'sent_to_provider');assert.ok(!JSON.stringify(list).includes('sealed'));assert.equal((await h.db.query('SELECT state FROM farm_private.memberships WHERE user_id=$1',[recipient])).rows[0].state,'pending');
 await h.db.exec('SET ROLE authenticated');await assert.rejects(()=>begin(),/permission denied/);await h.db.exec('RESET ROLE');
 }finally{await h.db.close();}});
test('default delivery metadata preserves generation-only records and wrong purpose/expired lease cannot send',async()=>{const h=await fixture();try{
 const cookie='a'.repeat(43),owner=crypto.randomUUID(),row=(await h.db.query("SELECT public.farm_admin_invite_prepare($1,'generation@example.test',repeat('n',43),'sealed-nonce') result",[cookie])).rows[0].result;
 await h.db.query('SELECT public.farm_admin_invite_claim($1,$2,$3)',[cookie,row.id,owner]);
 assert.equal((await h.db.query("SELECT public.farm_admin_email_begin($1,$2,$3,'password_reset') result",[cookie,row.id,owner])).rows[0].result,false);
 await h.db.query("UPDATE farm_private.invitations SET lease_until=now()-interval '1 second' WHERE id=$1",[row.id]);assert.equal((await h.db.query("SELECT public.farm_admin_email_begin($1,$2,$3,'admin_invite') result",[cookie,row.id,owner])).rows[0].result,false);
 const list=(await h.db.query('SELECT public.farm_admin_list($1) result',[cookie])).rows[0].result;assert.equal(list.invitations[0].deliveryState,'not_sent');
 }finally{await h.db.close();}});
test('entire owner email-ledger verification rolls back all fixtures and existing records',async()=>{const h=await fixture();try{const before=await h.snapshot();const invitations=(await h.db.query('SELECT * FROM farm_private.invitations ORDER BY id')).rows;const result=await h.db.exec(await readFile('supabase/tests/account-email-delivery.sql','utf8'));assert.match(result.at(-1).rows[0].result,/PASS: account email/);assert.deepEqual(await h.snapshot(),before);assert.deepEqual((await h.db.query('SELECT * FROM farm_private.invitations ORDER BY id')).rows,invitations);}finally{await h.db.close();}});
