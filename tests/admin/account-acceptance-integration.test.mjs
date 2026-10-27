import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from './fixtures/local-sql.mjs';
import {createInvitationAcceptanceService} from '../../server/auth/additional-admin-acceptance.mjs';
import {createProviderEffects} from '../../server/auth/provider-effects.mjs';
import {seal,sessionDigest} from '../../server/security.mjs';

test('additional invitations and recovery transfer real SQL leases through the shared acceptance service',async t=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql']);
 try{
  const key='ab'.repeat(32),actor=crypto.randomUUID(),actorCookie='a'.repeat(43);
  // Named arguments emulate PostgREST: omitted/undefined fields are not positional NULL placeholders.
  const rpc=async(name,params)=>{
   const entries=Object.entries(params).filter(([,value])=>value!==undefined);
   return (await db.query(`SELECT public.${name}(${entries.map(([key],i)=>`${key} => $${i+1}`).join(',')}) result`,entries.map(([,value])=>value))).rows[0].result;
  };
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password) VALUES($1,'owner@example.test',now(),'DUMMY')",[actor]);
  await db.query("INSERT INTO farm_private.memberships(user_id,state) VALUES($1,'active')",[actor]);
  await rpc('farm_session_open',{p_user_id:actor,p_provider_session_id:crypto.randomUUID(),p_cookie_hash:actorCookie,p_encrypted_credentials:'DUMMY',p_csrf_hash:'b'.repeat(43)});
  for(const purpose of ['admin_invite','password_reset'])await t.test(purpose,async()=>{
   const recipient=crypto.randomUUID(),email=purpose+'@example.test',nonce='n'.repeat(43),nonceHash=await sessionDigest(nonce),tokenHash='f'.repeat(64);
   await db.query('INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password) VALUES($1,$2,$3,$4)',[recipient,email,purpose==='password_reset'?new Date().toISOString():null,purpose==='password_reset'?'OLD_DUMMY':null]);
   if(purpose==='password_reset')await db.query("INSERT INTO farm_private.memberships(user_id,state) VALUES($1,'active')",[recipient]);
   const priorSession=purpose==='password_reset'?await rpc('farm_session_open',{p_user_id:recipient,p_provider_session_id:crypto.randomUUID(),p_cookie_hash:'r'.repeat(43),p_encrypted_credentials:'DUMMY_OLD_SESSION',p_csrf_hash:'s'.repeat(43)}):null;
   const pending=await rpc(purpose==='admin_invite'?'farm_admin_invite_prepare':'farm_admin_reset_prepare',{
    p_actor_cookie_hash:actorCookie,...(purpose==='admin_invite'?{p_email:email}:{p_user_id:recipient}),p_nonce_hash:nonceHash,p_encrypted_nonce:await seal({nonce},key,nonceHash)
   });
   const owner=crypto.randomUUID(),prefix=purpose==='admin_invite'?'farm_admin_invite':'farm_admin_reset';
   await rpc(prefix+'_claim',{p_actor_cookie_hash:actorCookie,p_id:pending.id,p_owner:owner});
   const encrypted=await seal({tokenHash},key,`first-admin:${pending.id}:${pending.generation}`);
   assert.equal(await rpc(prefix+'_issue_finish',{p_actor_cookie_hash:actorCookie,p_id:pending.id,p_owner:owner,p_user_id:recipient,...(purpose==='admin_invite'?{p_encrypted_invite:encrypted}:{p_encrypted_recovery:encrypted})}),true);
   await rpc(prefix+'_release',{p_id:pending.id,p_owner:owner});
   let passwordSet=false,verified=0;
   const tokens={access_token:'DUMMY_ACCESS',refresh_token:'DUMMY_REFRESH'};
   const verify=async hash=>{assert.equal(hash,tokenHash);verified++;await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[recipient]);return tokens;};
   const provider={
    verifyInvite:purpose==='admin_invite'?verify:async()=>assert.fail('invite proof must not be used for reset'),
    verifyRecovery:purpose==='password_reset'?verify:async()=>assert.fail('recovery proof must not be used for invite'),
    getUser:async()=>({id:recipient,email,email_confirmed_at:new Date().toISOString()}),
    updatePassword:async(_token,password)=>{assert.equal(password,'DummyAcceptancePass123!');passwordSet=true;await db.query("UPDATE auth.users SET encrypted_password='NEW_DUMMY' WHERE id=$1",[recipient]);},
    signIn:async(address,password)=>{assert.equal(address,email);assert.equal(password,'DummyAcceptancePass123!');assert.equal(passwordSet,true);return tokens;},
    signOut:async()=>{}
   };
   const config={sessionKey:key},service=createInvitationAcceptanceService(config,{provider,rpc,effects:createProviderEffects(config,{rpc})});
   const input={id:pending.id,nonce,tokenHash,password:'DummyAcceptancePass123!'};
   assert.deepEqual(await service.accept(input),{activated:true,signInRequired:true,providerCleanupPending:false});
   assert.equal((await db.query('SELECT state FROM farm_private.invitations WHERE id=$1',[pending.id])).rows[0].state,'accepted');
   assert.equal((await db.query('SELECT state FROM farm_private.memberships WHERE user_id=$1',[recipient])).rows[0].state,'active');
   if(priorSession)assert.ok((await db.query('SELECT revoked_at FROM farm_private.sessions WHERE id=$1',[priorSession.id])).rows[0].revoked_at);
   assert.equal((await db.query("SELECT count(*)::int n FROM farm_private.provider_effects WHERE source_id=$1 AND state='attached'",[pending.id])).rows[0].n,2);
   await assert.rejects(service.accept(input));assert.equal(verified,1);
  });
 }finally{await db.close();}
});
