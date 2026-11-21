import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaMetadataService,validateEditorial} from '../../server/media/metadata-service.mjs';
import {planRetention} from '../../server/media/retention-planner.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('editorial fields are bounded and technical data cannot be overwritten',()=>{
 assert.deepEqual(validateEditorial({displayName:' Field ',tags:['soil','soil'],focalPoint:{x:0,y:1}}),{displayName:'Field',tags:['soil'],focalPoint:{x:0,y:1}});
 for(const editorial of [{width:5},{description:'x'.repeat(2001)},{source:'javascript:alert(1)'},{focalPoint:{x:-1,y:0}},{tags:Array(21).fill('a')},{provenance:{remote:'url'}}])assert.throws(()=>validateEditorial(editorial));
});
test('metadata service uses authenticated JWT, session checks and CAS; preserves conflicts',async()=>{
 const calls=[];let mutate=false;
 const service=createMediaMetadataService({auth:{authenticate:async(_r,options)=>{mutate=options.requireMutation===true;return{accessToken:'USER-JWT'};}},provider:{userRpc:async(name,params,token)=>{calls.push({name,params,token});return{id,revision:2,editorial:params.p_editorial||{},technical:{width:10}};}}});
 assert.equal((await service.save({},id,{baseRevision:1,editorial:{altText:' seedlings '}})).revision,2);
 assert.equal(mutate,true);assert.equal(calls[0].token,'USER-JWT');assert.equal(calls[0].params.p_base_revision,1);assert.equal(calls[0].params.p_editorial.altText,'seedlings');
 await assert.rejects(()=>service.save({},id,{baseRevision:0,editorial:{}}),e=>e.status===400);
 const conflict=createMediaMetadataService({auth:{authenticate:async()=>({accessToken:'jwt'})},provider:{userRpc:async()=>{throw{code:'PT409'};}}});
 await assert.rejects(()=>conflict.save({},id,{baseRevision:1,editorial:{}}),e=>e.status===409);
 const anonymous=createMediaMetadataService({auth:{authenticate:async()=>({})},provider:{userRpc:()=>assert.fail('must not call provider')}});
 await assert.rejects(()=>anonymous.read({},id),e=>e.status===401);
});
test('retention planner keeps current revisions, 90 days history, 30 days trash and every release reference',()=>{
 const now='2026-11-21T12:00:00Z';
 const result=planRetention({now,revisions:[{id:'old',contentId:'c',revision:1,createdAt:'2026-01-01'},{id:'head',contentId:'c',revision:2,createdAt:'2026-01-02'},{id:'recent',contentId:'b',revision:1,createdAt:'2026-11-01'}],contents:[{id:'c',draftRevision:2}],media:[{id:'unused',deletedAt:'2026-10-01',versions:[{id:'v0'}]},{id:'held',deletedAt:'2026-10-01',versions:[{id:'v1'}]},{id:'released',deletedAt:'2026-10-01',versions:[{id:'v2'}]},{id:'young',deletedAt:'2026-11-01',versions:[{id:'v3'}]}],usages:[{revisionId:'head',mediaVersionId:'v1'}],releaseRefs:[{mediaVersionId:'v2'}]});
 assert.deepEqual(result.expiredRevisionIds,['old']);assert.deepEqual(result.purgeMediaIds,['unused']);assert.equal(result.preparedOnly,true);assert.equal(result.deleteEnabled,false);
 assert.throws(()=>planRetention({now:'bad'}));
});
test('retention fails closed for usage awaiting revision deletion and missing current content inventory',()=>{
 const result=planRetention({now:'2026-11-21',contents:[{id:'c',draftRevision:2}],revisions:[{id:'old',contentId:'c',revision:1,createdAt:'2026-01-01'},{id:'unknown',contentId:'missing',revision:1,createdAt:'2026-01-01'}],media:[{id:'m',deletedAt:'2026-01-01',versions:[{id:'v'}]}],usages:[{revisionId:'old',mediaVersionId:'v'}]});
 assert.deepEqual(result.expiredRevisionIds,['old']);assert.deepEqual(result.purgeMediaIds,[]);assert.deepEqual(result.blockedMediaIds,['m']);
});
test('recently deleted photos are discoverable only via authenticated trash RPC',async()=>{
 const service=createMediaMetadataService({auth:{authenticate:async()=>({accessToken:'JWT'})},provider:{userRpc:async(name,_p,token)=>{assert.equal(name,'farm_media_trash_list');assert.equal(token,'JWT');return[{id,revision:3,editorial:{},technical:{width:10},deletedAt:'2026-11-20'}];}}});
 assert.equal((await service.listTrash({}))[0].revision,3);
});
test('retention preparation uses mutation authentication and persists an advisory plan via user RPC',async()=>{
 const {createRetentionService}=await import('../../server/media/retention-service.mjs');
 let guarded=false;
 const service=createRetentionService({auth:{authenticate:async(_r,o)=>{guarded=o.requireMutation;return{accessToken:'jwt'};}},provider:{userRpc:async(name,_p,token)=>{assert.equal(name,'farm_media_retention_prepare');assert.equal(token,'jwt');return{id,preparedOnly:true,deleteEnabled:false,expiredRevisionIds:[],purgeMediaIds:[]};}}});
 assert.equal((await service.prepare({})).deleteEnabled,false);assert.equal(guarded,true);
});
