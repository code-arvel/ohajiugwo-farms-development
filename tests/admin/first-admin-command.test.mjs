import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fixture} from './fixtures/first-admin.mjs';
import {createFirstAdminService} from '../../server/auth/first-admin.mjs';
const module=await import('../../server/auth/bootstrap-command.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('maintainer command contract exists',()=>assert.equal(typeof module.runBootstrapCommand,'function'));
test('maintainer command prepares, issues, inspects and cancels only for the explicitly matched project',async()=>{
 const h=fixture(),service=createFirstAdminService(h.config,{provider:h.provider,rpc:h.rpc,now:h.clock});
 const run=args=>module.runBootstrapCommand(args,{config:h.config,service});
 await assert.rejects(()=>run(['prepare','--email','owner@example.test','--confirm-project','wrong']));assert.equal(h.row,null);
 const suffix=['--confirm-project',h.config.projectRef];
 const pending=await run(['prepare','--email','owner@example.test',...suffix]);
 assert.equal(pending.state,'pending');const ready=await run(['issue','--id',pending.id,...suffix]);assert.equal(ready.state,'ready_for_delivery');
 const status=await run(['status','--id',pending.id,...suffix]);assert.ok(!JSON.stringify(status).includes('owner@'));assert.ok(!JSON.stringify(status).includes('encrypted'));
 assert.deepEqual(await run(['cancel','--id',pending.id,...suffix]),{cancelled:true});assert.equal(h.active,0);
});
test('unknown/duplicate flags and password/token arguments never invoke bootstrap',async()=>{
 const h=fixture(),service=createFirstAdminService(h.config,{provider:h.provider,rpc:h.rpc});
 for(const args of [['prepare','--email','owner@example.test','--confirm-project',h.config.projectRef,'--password','PRIVATE'],['prepare','--email','owner@example.test','--email','other@example.test','--confirm-project',h.config.projectRef],['accept','--id','anything','--confirm-project',h.config.projectRef]]){
  await assert.rejects(()=>module.runBootstrapCommand(args,{config:h.config,service}),e=>!e.message.includes('PRIVATE'));
 }
 assert.equal(h.row,null);
});
test('installed command refuses live side effects even when credentials exist in its environment',()=>{
 const result=spawnSync(process.execPath,['scripts/bootstrap-admin.mjs','prepare','--email','owner@example.test','--confirm-project','abcdefghijklmnopqrst'],{encoding:'utf8',env:{...process.env,SUPABASE_SECRET_KEY:'PRIVATE-CREDENTIAL',ADMIN_FIRST_ADMIN_ENABLE:'true'}});
 assert.notEqual(result.status,0);assert.match(result.stderr,/Hosted bootstrap execution is disabled/);assert.ok(!result.stderr.includes('PRIVATE-CREDENTIAL'));
 const help=spawnSync(process.execPath,['scripts/bootstrap-admin.mjs','--help'],{encoding:'utf8'});assert.equal(help.status,0);assert.match(help.stdout,/local tests/);
});
