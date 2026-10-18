import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fixture} from './fixtures/first-admin.mjs';
import {createFirstAdminService} from '../../server/auth/first-admin.mjs';
const module=await import('../../server/auth/bootstrap-command.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('maintainer command contract exists',()=>assert.equal(typeof module.runBootstrapCommand,'function'));
test('maintainer command prepares, issues, inspects and cancels only for the explicitly matched project',async()=>{
 const h=fixture(),config={...h.config,firstAdminEmailEnabled:true},service=createFirstAdminService(config,{provider:h.provider,rpc:h.rpc,now:h.clock,sendInvite:async email=>({user:{id:h.user.id,email}})});
 const run=args=>module.runBootstrapCommand(args,{config,service});
 await assert.rejects(()=>run(['prepare','--email','owner@example.test','--confirm-project','wrong']));assert.equal(h.row,null);
 const suffix=['--confirm-project',h.config.projectRef];
 const pending=await run(['prepare','--email','owner@example.test',...suffix]);
 assert.equal(pending.state,'pending');const ready=await run(['issue','--id',pending.id,'--send-email','true',...suffix]);assert.equal(ready.state,'sent_to_provider');
 const status=await run(['status','--id',pending.id,...suffix]);assert.ok(!JSON.stringify(status).includes('owner@'));assert.ok(!JSON.stringify(status).includes('encrypted'));
 assert.deepEqual(await run(['cancel','--id',pending.id,...suffix]),{cancelled:true});assert.equal(h.active,0);
});
test('email issue requires its explicit flag and sends only the app-bound redirect to injected provider',async()=>{
 const h=fixture();let sent;
 const service=createFirstAdminService({...h.config,firstAdminEmailEnabled:true},{provider:h.provider,rpc:h.rpc,now:h.clock,sendInvite:async(email,redirectTo)=>{sent={email,redirectTo};return {user:{id:h.user.id,email:h.user.email}};}});
 const suffix=['--confirm-project',h.config.projectRef],run=args=>module.runBootstrapCommand(args,{config:{...h.config,firstAdminEmailEnabled:true},service});
 const pending=await run(['prepare','--email','owner@example.test',...suffix]);
 await assert.rejects(()=>run(['issue','--id',pending.id,...suffix]));
 const ready=await run(['issue','--id',pending.id,'--send-email','true',...suffix]);
 assert.equal(ready.state,'sent_to_provider');assert.equal(sent.email,'owner@example.test');
 assert.ok(sent.redirectTo.startsWith(`${h.config.origin}/admin/accept#id=${pending.id}&nonce=`));
 assert.match(sent.redirectTo,/&nonce=[A-Za-z0-9_-]{43}$/);
 assert.ok(!JSON.stringify(ready).includes('nonce'));
});
test('unknown/duplicate flags and password/token arguments never invoke bootstrap',async()=>{
 const h=fixture(),service=createFirstAdminService(h.config,{provider:h.provider,rpc:h.rpc});
 for(const args of [['prepare','--email','owner@example.test','--confirm-project',h.config.projectRef,'--password','PRIVATE'],['prepare','--email','owner@example.test','--email','other@example.test','--confirm-project',h.config.projectRef],['accept','--id','anything','--confirm-project',h.config.projectRef]]){
  await assert.rejects(()=>module.runBootstrapCommand(args,{config:h.config,service}),e=>!e.message.includes('PRIVATE'));
 }
 assert.equal(h.row,null);
});
test('installed command prints delivery prerequisites without printing credentials',()=>{
 const help=spawnSync(process.execPath,['scripts/bootstrap-admin.mjs','--help'],{encoding:'utf8'});assert.equal(help.status,0);assert.match(help.stdout,/configured Invite User email template/);assert.ok(!help.stdout.includes('PRIVATE-CREDENTIAL'));
});
