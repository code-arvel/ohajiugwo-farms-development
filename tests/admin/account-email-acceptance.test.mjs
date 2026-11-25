import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reconciliationFixture} from './fixtures/session-reconciliation.mjs';
import {createAccountLifecycleService} from '../../server/auth/account-lifecycle.mjs';
import {createInvitationAcceptanceService} from '../../server/auth/additional-admin-acceptance.mjs';
import {createProviderEffects} from '../../server/auth/provider-effects.mjs';

test('mock email requests transfer real SQL intent, recipient/password proof and single-use activation for invite and reset',async t=>{
 const h=await reconciliationFixture(),{db}=h;
 try{
  await db.exec(await readFile('supabase/migrations/202611250016_account_email_delivery.sql','utf8'));
  await db.exec("UPDATE farm_private.sessions SET reauthenticated_at=clock_timestamp() WHERE cookie_hash=repeat('a',43)");
  const rpc=async(name,params)=>{const entries=Object.entries(params).filter(([,v])=>v!==undefined);return(await db.query(`SELECT public.${name}(${entries.map(([k],i)=>`${k} => $${i+1}`).join(',')}) result`,entries.map(([,v])=>v))).rows[0].result;};
  const config={sessionKey:'ab'.repeat(32),origin:'https://farm.example.test',accountInviteIssueEnabled:true,accountRecoveryIssueEnabled:true,accountEmailDeliveryEnabled:true};
  const auth={authenticate:async()=>({cookieHash:'a'.repeat(43),user:{id:h.user}})},effects=createProviderEffects(config,{rpc});
  for(const purpose of ['admin_invite','password_reset'])await t.test(purpose,async()=>{
   const recipient=crypto.randomUUID(),email=`${purpose}@example.test`,tokenHash='f'.repeat(64);let mailRequests=0,redirect,passwordSet=false,verified=0;
   await db.query('INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password) VALUES($1,$2,$3,$4)',[recipient,email,purpose==='password_reset'?new Date().toISOString():null,purpose==='password_reset'?'OLD_DUMMY':null]);
   if(purpose==='password_reset')await db.query("INSERT INTO farm_private.memberships(user_id,state) VALUES($1,'active')",[recipient]);
   const oldSession=purpose==='password_reset'?await rpc('farm_session_open',{p_user_id:recipient,p_provider_session_id:crypto.randomUUID(),p_cookie_hash:'r'.repeat(43),p_encrypted_credentials:'DUMMY_OLD',p_csrf_hash:'s'.repeat(43)}):null;
   const verify=async hash=>{assert.equal(hash,tokenHash);verified++;await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[recipient]);return{access_token:'DUMMY_ACCESS',refresh_token:'DUMMY_REFRESH'};};
   const identity=()=>({id:recipient,email,email_confirmed_at:new Date().toISOString()});
   const provider={
    inviteUserByEmail:async(address,url)=>{assert.equal(purpose,'admin_invite');assert.equal(address,email);mailRequests++;redirect=url;return{user:identity()};},
    getUserById:async id=>{assert.equal(id,recipient);return identity();},
    sendPasswordRecoveryEmail:async(address,url)=>{assert.equal(purpose,'password_reset');assert.equal(address,email);mailRequests++;redirect=url;},
    verifyInvite:purpose==='admin_invite'?verify:async()=>assert.fail('wrong proof type'),
    verifyRecovery:purpose==='password_reset'?verify:async()=>assert.fail('wrong proof type'),
    getUser:async()=>identity(),updatePassword:async(_,password)=>{assert.equal(password,'DummyAcceptancePass123!');passwordSet=true;await db.query("UPDATE auth.users SET encrypted_password='NEW_DUMMY' WHERE id=$1",[recipient]);},
    signIn:async(address,password)=>{assert.equal(address,email);assert.equal(password,'DummyAcceptancePass123!');assert.equal(passwordSet,true);return{access_token:'DUMMY_PROOF',refresh_token:'DUMMY_REFRESH_PROOF'};},signOut:async()=>{}
   };
   const accounts=createAccountLifecycleService(config,{auth,rpc,provider,effects});
   const pending=purpose==='admin_invite'?await accounts.prepare({},email):await accounts.prepareReset({},recipient);
   const issue=()=>purpose==='admin_invite'?accounts.issue({},pending.id):accounts.issueReset({},pending.id);
   assert.equal((await issue()).state,'sent_to_provider');assert.equal((await issue()).state,'sent_to_provider');assert.equal(mailRequests,1);
   const url=new URL(redirect),fragment=new URLSearchParams(url.hash.slice(1));assert.equal(url.origin,config.origin);assert.equal(url.pathname,'/admin/accept');assert.equal(fragment.get('id'),pending.id);
   const acceptance=createInvitationAcceptanceService(config,{provider,rpc,effects}),input={id:pending.id,nonce:fragment.get('nonce'),tokenHash,password:'DummyAcceptancePass123!'};
   await assert.rejects(acceptance.accept({...input,nonce:'w'.repeat(43)}));assert.equal(verified,0);
   assert.deepEqual(await acceptance.accept(input),{activated:true,signInRequired:true,providerCleanupPending:false});
   assert.equal((await db.query('SELECT state FROM farm_private.invitations WHERE id=$1',[pending.id])).rows[0].state,'accepted');assert.equal((await db.query('SELECT state FROM farm_private.memberships WHERE user_id=$1',[recipient])).rows[0].state,'active');
   if(oldSession)assert.ok((await db.query('SELECT revoked_at FROM farm_private.sessions WHERE id=$1',[oldSession.id])).rows[0].revoked_at);
   await assert.rejects(acceptance.accept(input));assert.equal(verified,1);assert.equal(mailRequests,1);
  });
 }finally{await db.close();}
});
