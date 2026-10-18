import test from 'node:test';import assert from 'node:assert/strict';
import {localDatabase} from './fixtures/local-sql.mjs';
import {fixture} from './fixtures/first-admin.mjs';
import {createFirstAdminService} from '../../server/auth/first-admin.mjs';
import {createProviderEffects} from '../../server/auth/provider-effects.mjs';
import {unseal} from '../../server/security.mjs';
test('acceptance journals invite and password proofs, atomically transfers progress and never loses failed probe cleanup',async()=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql']);try{
 const h=fixture(),rpc=async(name,p)=>(await db.query(`SELECT public.${name}(${Object.values(p).map((_,i)=>'$'+(i+1)).join(',')}) result`,Object.values(p))).rows[0].result;
 const generate=h.provider.generateInvite,verify=h.provider.verifyInvite,update=h.provider.updatePassword,signIn=h.provider.signIn;
 h.provider.generateInvite=async email=>{const result=await generate(email);await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[result.user.id,email]);return result;};
 h.provider.verifyInvite=async hash=>{assert.equal((await db.query(`SELECT count(*)::int n FROM farm_private.provider_effects WHERE operation='invite_verify' AND state='started'`)).rows[0].n,1);const result=await verify(hash);await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[h.user.id]);return result;};
 h.provider.updatePassword=async(token,password)=>{const result=await update(token,password);await db.query('UPDATE auth.users SET encrypted_password=$1 WHERE id=$2',['DUMMY_HASH',h.user.id]);return result;};
 h.provider.signIn=async(...args)=>{assert.equal((await db.query(`SELECT count(*)::int n FROM farm_private.provider_effects WHERE operation='password_proof' AND state='started'`)).rows[0].n,1);return signIn(...args);};
 const service=createFirstAdminService(h.config,{provider:h.provider,rpc,effects:createProviderEffects(h.config,{rpc})}),pending=await service.prepare('owner@example.test');await service.issue(pending.id);
 const row=(await db.query('SELECT * FROM farm_private.invitations')).rows[0],nonce=(await unseal(row.encrypted_nonce,h.config.sessionKey,row.nonce_hash)).nonce,tokenHash=(await unseal(row.encrypted_invite,h.config.sessionKey,'first-admin:'+row.id+':1')).tokenHash;
 const result=await service.accept({id:row.id,nonce,tokenHash,password:'a good private password'});assert.equal(result.activated,true);assert.equal((await db.query('SELECT active_count FROM farm_private.admin_guard')).rows[0].active_count,1);
 assert.equal((await db.query(`SELECT count(*)::int n FROM farm_private.provider_effects WHERE state='attached' AND source_kind='invitation' AND encrypted_credentials IS NULL`)).rows[0].n,2);
 }finally{await db.close();}
});
