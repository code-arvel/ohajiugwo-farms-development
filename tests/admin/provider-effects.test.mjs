import test from 'node:test';import assert from 'node:assert/strict';
import {localDatabase} from './fixtures/local-sql.mjs';
import {reauthFixture} from './fixtures/reauthentication.mjs';
import {createAuthService} from '../../server/auth/sessions.mjs';
import {createCleanupWorker} from '../../server/cleanup-worker.mjs';
const module=await import('../../server/auth/provider-effects.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('real SQL intent precedes provider call, atomically transfers ownership, retains failed proof cleanup and blocks ambiguous replay',async()=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql']);try{
 await db.exec(`INSERT INTO auth.users(id,email) VALUES('11111111-1111-4111-8111-111111111111','owner@example.test');INSERT INTO farm_private.memberships(user_id,state) VALUES('11111111-1111-4111-8111-111111111111','active');`);
 let failStage=false,loseOpenAck=false;const rpc=async(name,p)=>{if(failStage&&name==='farm_effect_session_stage')throw new Error('PRIVATE_DATABASE_OUTAGE');const result=(await db.query(`SELECT public.${name}(${Object.values(p).map((_,i)=>'$'+(i+1)).join(',')}) result`,Object.values(p))).rows[0].result;if(loseOpenAck&&name==='farm_effect_session_open')throw new Error('PRIVATE_LOST_OPEN_ACK');return result;};
 const h=reauthFixture(),original=h.provider.signIn;let calls=0;
 h.provider.signIn=async(...args)=>{calls++;assert.equal((await db.query(`SELECT count(*)::int n FROM farm_private.provider_effects WHERE state='started'`)).rows[0].n,1,'durable intent must exist before provider mutation');return original(...args);};
 const effects=module.createProviderEffects(h.config,{rpc}),service=createAuthService(h.config,{provider:h.provider,rpc,effects});const first=await service.login({email:'owner@example.test',password:'DummyFarmPass123!'});
 assert.equal((await db.query('SELECT state FROM farm_private.provider_effects')).rows[0].state,'attached');
 failStage=true;h.setCleanupFails(true);await assert.rejects(()=>service.reauthenticate(h.request(first.cookie,first.csrfToken),{password:'DummyFarmPass123!'}));
 assert.equal((await db.query(`SELECT count(*)::int n FROM farm_private.provider_effects WHERE state='cleanup' AND encrypted_credentials IS NOT NULL`)).rows[0].n,1);await service.authenticate(h.request(first.cookie,first.csrfToken));
 h.setCleanupFails(false);const summary=await createCleanupWorker(h.config,{provider:h.provider,rpc}).run();assert.equal(summary.completed,1);await service.authenticate(h.request(first.cookie,first.csrfToken));
 failStage=false;const rotated=await service.reauthenticate(h.request(first.cookie,first.csrfToken),{password:'DummyFarmPass123!'});await assert.rejects(()=>service.authenticate(h.request(first.cookie,first.csrfToken)));await service.authenticate(h.request(rotated.cookie,rotated.csrfToken));
 const before=(await db.query('SELECT count(*)::int n FROM farm_private.sessions WHERE revoked_at IS NULL')).rows[0].n;loseOpenAck=true;await assert.rejects(()=>service.login({email:'owner@example.test',password:'DummyFarmPass123!'}));loseOpenAck=false;assert.equal((await db.query('SELECT count(*)::int n FROM farm_private.sessions WHERE revoked_at IS NULL')).rows[0].n,before,'lost open acknowledgement must revoke its owned app session before provider cleanup');await service.authenticate(h.request(rotated.cookie,rotated.csrfToken));
 h.provider.signIn=async()=>{calls++;throw new Error('PRIVATE_LOST_PROVIDER_REPLY');};await assert.rejects(()=>service.login({email:'owner@example.test',password:'DummyFarmPass123!'}));const count=calls;await assert.rejects(()=>service.login({email:'owner@example.test',password:'DummyFarmPass123!'}));assert.equal(calls,count,'uncertain provider mutation must not be repeated');
 assert.equal((await db.query(`SELECT count(*)::int n FROM farm_private.provider_effects WHERE state='review'`)).rows[0].n,1);
 }finally{await db.close();}
});
