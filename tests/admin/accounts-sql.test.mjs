import test from 'node:test';import assert from 'node:assert/strict';
import {localDatabase} from './fixtures/local-sql.mjs';
test('account SQL gates recent session, preserves equal-admin/last-admin safety and invalidates prior invitation on resend',async()=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql']);try{
 const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
 await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password) VALUES($1,'first@example.test',now(),'DUMMY'),($2,'second@example.test',now(),'DUMMY');`,[first,second]);await db.query(`INSERT INTO farm_private.memberships(user_id,state) VALUES($1,'active'),($2,'active')`,[first,second]);
 const rpc=async(name,args)=>(await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
 await rpc('farm_session_open',[first,crypto.randomUUID(),'a'.repeat(43),'ENCRYPTED','b'.repeat(43)]);await rpc('farm_session_open',[second,crypto.randomUUID(),'c'.repeat(43),'ENCRYPTED','d'.repeat(43)]);
 const invitation=await rpc('farm_admin_invite_prepare',['a'.repeat(43),'new@example.test','e'.repeat(43),'SEALED_NONCE']);assert.equal(invitation.invited_by,first);assert.equal(invitation.state,'queued');
 const inventory=await rpc('farm_admin_list',['a'.repeat(43)]);assert.equal(inventory.admins.length,2);assert.equal(inventory.invitations[0].email,'new@example.test');assert.ok(!JSON.stringify(inventory).includes('SEALED_NONCE'));
 const resent=await rpc('farm_admin_invite_resend',['a'.repeat(43),invitation.id,'f'.repeat(43),'NEW_SEALED']);assert.notEqual(resent.id,invitation.id);assert.equal((await rpc('farm_invitation_read',[invitation.id])).state,'cancelled');
 await db.query(`UPDATE farm_private.sessions SET reauthenticated_at=now()-interval '6 minutes' WHERE user_id=$1`,[first]);await assert.rejects(()=>rpc('farm_admin_revoke',['a'.repeat(43),second]));await db.query(`UPDATE farm_private.sessions SET reauthenticated_at=now() WHERE user_id=$1`,[first]);
 const secondInvite=await rpc('farm_admin_invite_prepare',['c'.repeat(43),'other@example.test','g'.repeat(43),'SEALED_OTHER']);
 assert.equal(await rpc('farm_admin_revoke',['a'.repeat(43),second]),true);assert.equal(await rpc('farm_session_read',['c'.repeat(43)]),null);assert.equal((await rpc('farm_invitation_read',[secondInvite.id])).state,'cancelled');await assert.rejects(()=>rpc('farm_admin_revoke',['c'.repeat(43),first]));await assert.rejects(()=>rpc('farm_admin_revoke',['a'.repeat(43),first]));assert.equal((await db.query('SELECT active_count FROM farm_private.admin_guard')).rows[0].active_count,1);
 assert.equal((await db.query(`SELECT has_function_privilege('authenticated','public.farm_admin_revoke(text,uuid)','EXECUTE') allowed`)).rows[0].allowed,false);
 }finally{await db.close();}
});

test('additional-admin invitation issue and activation are leased, recipient-bound and single-use',async()=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql']);try{
 const actor='11111111-1111-4111-8111-111111111111',recipient='33333333-3333-4333-8333-333333333333';
 await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password) VALUES($1,'owner@example.test',now(),'DUMMY')`,[actor]);
 await db.query(`INSERT INTO farm_private.memberships(user_id,state) VALUES($1,'active')`,[actor]);
 const rpc=async(name,args)=>(await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
 await rpc('farm_session_open',[actor,crypto.randomUUID(),'a'.repeat(43),'ENCRYPTED','b'.repeat(43)]);
 const invite=await rpc('farm_admin_invite_prepare',['a'.repeat(43),'new-admin@example.test','c'.repeat(43),'SEALED_NONCE']);
 const owner=crypto.randomUUID(),claimed=await rpc('farm_admin_invite_claim',['a'.repeat(43),invite.id,owner]);
 assert.equal(claimed.issue_state,'issuing');assert.equal(await rpc('farm_admin_invite_claim',['a'.repeat(43),invite.id,crypto.randomUUID()]),null);
 await db.query(`INSERT INTO auth.users(id,email) VALUES($1,'new-admin@example.test')`,[recipient]);
 const issueEffect=await rpc('farm_effect_begin',[crypto.randomUUID(),'e'.repeat(43),'invite_issue',crypto.randomUUID(),'SEALED_CONTEXT']);
 assert.ok(issueEffect);assert.equal(await rpc('farm_effect_capture',[issueEffect.id,issueEffect.owner,'SEALED_PROVIDER_INVITE']),true);
 assert.equal(await rpc('farm_admin_invite_issue_effect_finish',[issueEffect.id,issueEffect.owner,'a'.repeat(43),invite.id,owner,recipient,'SEALED_INVITE']),true);
 const attachedIssue=await db.query(`SELECT state,encrypted_credentials FROM farm_private.provider_effects WHERE id=$1`,[issueEffect.id]);assert.equal(attachedIssue.rows[0].state,'attached');assert.equal(attachedIssue.rows[0].encrypted_credentials,null);
 await rpc('farm_admin_invite_release',[invite.id,owner]);
 const issued=await rpc('farm_invitation_read',[invite.id]);assert.equal(issued.user_id,recipient);assert.equal(issued.issue_state,'ready');assert.equal(issued.state,'queued');
 const nonce='c'.repeat(43),acceptOwner=crypto.randomUUID();
 const accepting=await rpc('farm_admin_invite_accept_claim',[invite.id,acceptOwner,nonce]);
 assert.equal(accepting.user_id,recipient);assert.equal(await rpc('farm_admin_invite_accept_claim',[invite.id,crypto.randomUUID(),nonce]),null);
 const acceptEffect=await rpc('farm_effect_begin',[crypto.randomUUID(),'f'.repeat(43),'invite_verify',crypto.randomUUID(),'SEALED_CONTEXT']);
 assert.equal(await rpc('farm_effect_capture',[acceptEffect.id,acceptEffect.owner,'SEALED_PROVIDER_TOKENS']),true);
 assert.equal(await rpc('farm_admin_invite_accept_effect_progress',[acceptEffect.id,acceptEffect.owner,invite.id,acceptOwner,'SEALED_CREDENTIALS']),true);
 await db.query(`UPDATE auth.users SET email_confirmed_at=now(),encrypted_password='DUMMY' WHERE id=$1`,[recipient]);
 assert.equal(await rpc('farm_admin_invite_activate',[invite.id,acceptOwner,nonce,invite.generation,recipient]),true);
 assert.equal((await db.query(`SELECT state FROM farm_private.memberships WHERE user_id=$1`,[recipient])).rows[0].state,'active');
 assert.equal(await rpc('farm_admin_invite_activate',[invite.id,acceptOwner,nonce,invite.generation,recipient]),false);
 assert.equal((await db.query(`SELECT has_function_privilege('authenticated','public.farm_admin_invite_activate(uuid,uuid,text,integer,uuid)','EXECUTE') allowed`)).rows[0].allowed,false);
 }finally{await db.close();}
});

test('password recovery is purpose-bound, does not change membership and invalidates prior sessions only after proof',async()=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql']);try{
 const actor='11111111-1111-4111-8111-111111111111',target='33333333-3333-4333-8333-333333333333';
 await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password) VALUES($1,'owner@example.test',now(),'DUMMY'),($2,'target@example.test',now(),'OLD_HASH')`,[actor,target]);
 await db.query(`INSERT INTO farm_private.memberships(user_id,state) VALUES($1,'active'),($2,'active')`,[actor,target]);
 const rpc=async(name,args)=>(await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
 await rpc('farm_session_open',[actor,crypto.randomUUID(),'a'.repeat(43),'ACTOR_CREDS','b'.repeat(43)]);
 const targetSession=await rpc('farm_session_open',[target,crypto.randomUUID(),'c'.repeat(43),'TARGET_CREDS','d'.repeat(43)]);
 const reset=await rpc('farm_admin_reset_prepare',['a'.repeat(43),target,'e'.repeat(43),'SEALED_NONCE']);assert.equal(reset.purpose,'password_reset');assert.equal(reset.user_id,target);
 const issueOwner=crypto.randomUUID(),claimed=await rpc('farm_admin_reset_claim',['a'.repeat(43),reset.id,issueOwner]);assert.equal(claimed.issue_state,'issuing');
 const effect=await rpc('farm_effect_begin',[crypto.randomUUID(),'f'.repeat(43),'reset_issue',crypto.randomUUID(),'SEALED_CONTEXT']);assert.equal(await rpc('farm_effect_capture',[effect.id,effect.owner,'SEALED_RECOVERY_TOKEN']),true);
 assert.equal(await rpc('farm_admin_reset_issue_effect_finish',[effect.id,effect.owner,'a'.repeat(43),reset.id,issueOwner,target,'SEALED_RESET_LINK']),true);await rpc('farm_admin_reset_release',[reset.id,issueOwner]);
 const nonce='e'.repeat(43),acceptOwner=crypto.randomUUID(),accepting=await rpc('farm_admin_reset_accept_claim',[reset.id,acceptOwner,nonce]);assert.equal(accepting.user_id,target);
 const verifyEffect=await rpc('farm_effect_begin',[crypto.randomUUID(),'g'.repeat(43),'reset_verify',crypto.randomUUID(),'SEALED_CONTEXT']);assert.equal(await rpc('farm_effect_capture',[verifyEffect.id,verifyEffect.owner,'SEALED_PROVIDER_TOKENS']),true);
 assert.equal(await rpc('farm_admin_reset_accept_effect_progress',[verifyEffect.id,verifyEffect.owner,reset.id,acceptOwner,'SEALED_PROGRESS']),true);
 await db.query(`UPDATE auth.users SET encrypted_password='NEW_HASH' WHERE id=$1`,[target]);
 assert.equal(await rpc('farm_admin_reset_activate',[reset.id,acceptOwner,nonce,reset.generation,target]),true);
 assert.equal(await rpc('farm_admin_reset_activate',[reset.id,acceptOwner,nonce,reset.generation,target]),false);
 assert.ok((await db.query(`SELECT revoked_at FROM farm_private.sessions WHERE id=$1`,[targetSession.id])).rows[0].revoked_at);
 assert.equal((await db.query(`SELECT state FROM farm_private.memberships WHERE user_id=$1`,[target])).rows[0].state,'active');
 }finally{await db.close();}
});
