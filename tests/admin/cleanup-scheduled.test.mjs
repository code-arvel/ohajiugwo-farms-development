import test from 'node:test';import assert from 'node:assert/strict';
const worker=await import('../../hosting/cleanup-worker.mjs');
test('cleanup schedule is closed unless the exact development gate is present',async()=>{
 const scheduled=worker.createCleanupScheduledHandler({loadConfig(){throw Error('must not load secrets')},createProvider(){throw Error('must not create provider')}}),tasks=[];
 scheduled.scheduled({}, {}, {waitUntil(task){tasks.push(task)}});assert.equal(tasks.length,0);
 scheduled.scheduled({}, {ADMIN_ENABLE_CLEANUP_WORKER:'true'}, {waitUntil(task){tasks.push(task)}});assert.equal(tasks.length,0);
});
test('explicit local gate runs one cleanup batch and emits only the safe summary',async()=>{
 let configCalls=0,providerCalls=0,runs=0;const lines=[],tasks=[];
 const scheduled=worker.createCleanupScheduledHandler({loadConfig(){configCalls++;return {private:'never-log'}},createProvider(config){providerCalls++;assert.deepEqual(config,{private:'never-log'});return {rpc(){}}},createWorker(config,{provider,rpc}){assert.deepEqual(config,{private:'never-log'});assert.equal(providerCalls,1);assert.equal(typeof rpc,'function');return {async run(){runs++;return {claimed:2,completed:1,retried:0,review:1,unconfirmed:0}}}},log(line){lines.push(line)},error(){throw Error('private failure logging is forbidden')}});
 scheduled.scheduled({}, {ADMIN_ENABLE_CLEANUP_WORKER:'confirmed-development-only'}, {waitUntil(task){tasks.push(task)}});
 assert.equal(tasks.length,1);await tasks[0];assert.deepEqual({configCalls,providerCalls,runs},{configCalls:1,providerCalls:1,runs:1});assert.deepEqual(lines,['{"cleanup":{"claimed":2,"completed":1,"retried":0,"review":1,"unconfirmed":0}}']);
});
test('cleanup schedule masks private runtime failures',async()=>{
 const lines=[];const scheduled=worker.createCleanupScheduledHandler({loadConfig(){throw Error('secret values')},log(line){lines.push(line)},error(line){lines.push(line)}}),tasks=[];
 scheduled.scheduled({}, {ADMIN_ENABLE_CLEANUP_WORKER:'confirmed-development-only'}, {waitUntil(task){tasks.push(task)}});await tasks[0];assert.deepEqual(lines,['Cleanup worker failed; private details withheld.']);
});
test('private media cleanup requires its separate exact gate and emits only counts',async()=>{
 let storageCalls=0,mediaRuns=0;const lines=[],tasks=[];
 const scheduled=worker.createCleanupScheduledHandler({
  loadConfig(){return {secret:'private'}},createProvider(){return {rpc(){return async()=>[];}}},
  createWorker(){return {async run(){return{claimed:0,completed:0,retried:0,review:0,unconfirmed:0};}}},
  createStorage(){storageCalls++;return{};},createMediaWorker({rpc,storage}){assert.equal(typeof rpc,'function');assert.deepEqual(storage,{});return{async run(){mediaRuns++;return{claimed:1,completed:1,retried:0,review:0,unconfirmed:0};}};},
  log(line){lines.push(line);},error(line){lines.push(line);}
 });
 scheduled.scheduled({}, {ADMIN_ENABLE_CLEANUP_WORKER:'confirmed-development-only'}, {waitUntil(task){tasks.push(task)}});await tasks.at(-1);
 assert.equal(storageCalls,0);assert.equal(mediaRuns,0);
 scheduled.scheduled({}, {ADMIN_ENABLE_CLEANUP_WORKER:'confirmed-development-only',ADMIN_ENABLE_MEDIA_CLEANUP_WORKER:'confirmed-development-only'}, {waitUntil(task){tasks.push(task)}});await tasks.at(-1);
 assert.equal(storageCalls,1);assert.equal(mediaRuns,1);assert.match(lines.at(-1),/"mediaCleanup"/);assert.ok(!lines.at(-1).includes('private'));
});
