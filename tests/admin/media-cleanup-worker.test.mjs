import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaCleanupWorker} from '../../server/media/media-cleanup-worker.mjs';

const paths=['staging/11111111-1111-4111-8111-111111111111/source','media/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/original.webp'];
test('media cleanup reconciles expired uploads, deletes only ledger paths and acknowledges completion',async()=>{
 const calls=[],deleted=[];
 const worker=createMediaCleanupWorker({rpc:async(name,args)=>{calls.push({name,args});if(name==='farm_media_cleanup_claim')return[{id:'44444444-4444-4444-8444-444444444444',attempts:1,paths}];if(name==='farm_media_expired_cleanup_enqueue')return 1;return true;},storage:{async delete(value){deleted.push(value);}}});
 const result=await worker.run();assert.deepEqual(deleted,[paths]);assert.equal(result.completed,1);assert.equal(result.unconfirmed,0);
 assert.deepEqual(calls.map(call=>call.name),['farm_media_expired_cleanup_enqueue','farm_media_cleanup_claim','farm_media_cleanup_finish']);
 assert.equal(calls.at(-1).args.p_success,true);assert.ok(!JSON.stringify(result).includes('44444444'));
});

test('unsafe cleanup payload is not passed to Storage or acknowledged as deleted',async()=>{
 let deleted=0,finish;
 const worker=createMediaCleanupWorker({rpc:async(name,args)=>{if(name==='farm_media_cleanup_claim')return[{id:'44444444-4444-4444-8444-444444444444',attempts:1,paths:['../public/key']}];if(name==='farm_media_cleanup_finish')finish=args;return true;},storage:{async delete(){deleted++;}}});
 const result=await worker.run();assert.equal(deleted,0);assert.equal(result.retried,1);assert.equal(result.unconfirmed,0);assert.equal(finish.p_success,false);
});

test('Storage failure records retry without exposing provider errors',async()=>{
 let finish;
 const worker=createMediaCleanupWorker({rpc:async(name,args)=>{if(name==='farm_media_cleanup_claim')return[{id:'44444444-4444-4444-8444-444444444444',attempts:1,paths}];finish=args;return true;},storage:{async delete(){throw Error('private storage detail');}}});
 const result=await worker.run();assert.equal(result.retried,1);assert.equal(finish.p_success,false);assert.ok(!JSON.stringify(result).includes('private storage detail'));
});

test('cleanup budget requeues every remaining lease with an acknowledged failure',async()=>{
 const finish=[];let tick=0;
 const worker=createMediaCleanupWorker({now:()=>tick++,rpc:async(name,args)=>{if(name==='farm_media_cleanup_claim')return[1,2,3].map(value=>({id:`44444444-4444-4444-8444-44444444444${value}`,attempts:1,paths}));if(name==='farm_media_cleanup_finish')finish.push(args);return true;},storage:{async delete(){throw Error('budget used');}}});
 const result=await worker.run({budgetMs:1});assert.equal(finish.length,3);assert.ok(finish.every(item=>item.p_success===false));assert.equal(result.retried,3);assert.equal(result.unconfirmed,0);
});
