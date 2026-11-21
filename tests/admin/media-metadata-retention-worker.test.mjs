import test from 'node:test';import assert from 'node:assert/strict';
import {createRetentionWorker} from '../../server/media/retention-worker.mjs';
const plan='11111111-1111-4111-8111-111111111111',receiptId='22222222-2222-4222-8222-222222222222';
const now=()=>Date.parse('2026-11-21T12:00:00Z');
const receipt={sourceRef:'farm-project',setId:'backup-set-1',manifestSha256:'a'.repeat(64),verifiedAt:'2026-11-21T11:00:00Z',offsite:true,restoreDrillVerified:true};
test('retention worker is disabled by default and never contacts providers when disabled',async()=>{
 const worker=createRetentionWorker({rpc:()=>assert.fail('no rpc'),verifyBackupReceipt:()=>assert.fail('no verifier')});
 assert.deepEqual(await worker.run({planId:plan}),{state:'disabled',prunedRevisions:0,queuedMedia:0});
});
test('retention worker requires independent verified recent receipt for exact source before recording and executing bounded plan',async()=>{
 const calls=[];const worker=createRetentionWorker({enabled:true,sourceRef:'farm-project',now,verifyBackupReceipt:async()=>receipt,rpc:async(name,params)=>{calls.push({name,params});return name==='farm_retention_backup_record'?receiptId:{state:'queued',prunedRevisions:2,queuedMedia:1};}});
 assert.equal((await worker.run({planId:plan,limit:3})).queuedMedia,1);assert.deepEqual(calls.map(c=>c.name),['farm_retention_backup_record','farm_retention_execute']);assert.equal(calls[1].params.p_limit,3);assert.equal(calls[1].params.p_receipt_id,receiptId);
});
test('retention worker fails closed for stale, future, wrong-source, nonoffsite or untested receipts',async()=>{
 for(const change of [{verifiedAt:'2026-11-19T11:00:00Z'},{verifiedAt:'2026-11-21T12:01:00Z'},{sourceRef:'other-project'},{offsite:false},{restoreDrillVerified:false},{manifestSha256:'bad'}]){
  const worker=createRetentionWorker({enabled:true,sourceRef:'farm-project',now,verifyBackupReceipt:async()=>({...receipt,...change}),rpc:()=>assert.fail('no mutation before verifier gates')});
  await assert.rejects(()=>worker.run({planId:plan}));
 }
});
test('retention worker never acknowledges Storage deletion and rejects malformed or excessive execution summaries',async()=>{
 for(const value of [{state:'queued',prunedRevisions:26,queuedMedia:0},{state:'published',prunedRevisions:0,queuedMedia:0}]){
  const worker=createRetentionWorker({enabled:true,sourceRef:'farm-project',now,verifyBackupReceipt:async()=>receipt,rpc:async name=>name==='farm_retention_backup_record'?receiptId:value});await assert.rejects(()=>worker.run({planId:plan}));
 }
});
