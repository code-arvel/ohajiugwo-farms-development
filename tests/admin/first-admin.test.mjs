import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/first-admin.mjs';
const module=await import('../../server/auth/first-admin.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('first-admin service contract exists',()=>assert.equal(typeof module.createFirstAdminService,'function'));
const service=h=>module.createFirstAdminService(h.config,{provider:h.provider,rpc:h.rpc,now:h.clock});
async function ready(h){const s=service(h);const pending=await s.prepare(' Owner@example.test ');await s.issue(pending.id);return s;}
test('bootstrap stays pending until verified password completion and activation is single-use',async()=>{
 const h=fixture(),s=await ready(h),input=await h.inputs();
 assert.equal(h.active,0);assert.equal(h.member,'pending');assert.equal(h.row.state,'queued');
 assert.ok(!h.row.encrypted_nonce.includes(input.nonce));assert.ok(!h.row.encrypted_invite.includes(input.tokenHash));
 const result=await s.accept(input);assert.deepEqual(result,{activated:true,signInRequired:true,providerCleanupPending:false});
 assert.equal(h.active,1);assert.equal(h.row.state,'accepted');assert.equal(h.row.encrypted_nonce,null);
 await assert.rejects(()=>s.accept(input));assert.equal(h.calls.filter(x=>x==='verifyInvite').length,1);
 assert.ok(!JSON.stringify(result).includes('private-'));assert.ok(!JSON.stringify(result).includes(input.nonce));
});
test('duplicate or closed bootstrap stops before provider effects',async()=>{
 const h=fixture(),s=service(h);await s.prepare('owner@example.test');await assert.rejects(()=>s.prepare('owner@example.test'));
 h.setActive(1);await assert.rejects(()=>s.prepare('owner@example.test'));assert.ok(!h.calls.includes('generateInvite'));
});
test('pending provider generation failure is redacted and requires review rather than blind retry',async()=>{
 const h=fixture(),s=service(h),pending=await s.prepare('owner@example.test');h.fail.add('generateInvite');
 await assert.rejects(()=>s.issue(pending.id),e=>!e.message.includes('PRIVATE'));assert.equal(h.active,0);assert.equal(h.row.issue_state,'review');
 h.fail.clear();await assert.rejects(()=>s.issue(pending.id));assert.equal(h.calls.filter(x=>x==='generateInvite').length,1);
});
test('saved invitation generation is reusable after service restart without regenerating a provider link',async()=>{
 const h=fixture(),s=await ready(h);await service(h).issue(h.row.id);assert.equal(h.calls.filter(x=>x==='generateInvite').length,1);
 const status=await s.status(h.row.id);assert.equal(status.state,'ready_for_delivery');assert.ok(!JSON.stringify(status).includes('encrypted'));assert.ok(!JSON.stringify(status).includes('owner@'));
});
test('wrong nonce, wrong token, expired or cancelled invitation never verifies or sets a password',async()=>{
 for(const mode of ['nonce','token','expired','cancelled']){
  const h=fixture(),s=await ready(h),input=await h.inputs();
  if(mode==='nonce')input.nonce='z'.repeat(43);if(mode==='token')input.tokenHash='e'.repeat(64);
  if(mode==='expired')h.advance(86400001);if(mode==='cancelled')await s.cancel(input.id);
  await assert.rejects(()=>s.accept(input));assert.equal(h.active,0);assert.ok(!h.calls.includes('verifyInvite'));assert.ok(!h.calls.includes('updatePassword'));
 }
});
test('recipient mismatch or unconfirmed identity cannot set a password or activate',async()=>{
 for(const mode of ['email','id','unconfirmed']){
  const h=fixture(),s=await ready(h),input=await h.inputs();
  if(mode==='email')h.user.email='other@example.test';if(mode==='id')h.user.id=crypto.randomUUID();if(mode==='unconfirmed')h.user.email_confirmed_at=null;
  await assert.rejects(()=>s.accept(input));assert.equal(h.active,0);assert.ok(!h.calls.includes('updatePassword'));
 }
});
test('weak passwords and oversized UTF-8 passwords are rejected before provider effects',async()=>{
 const h=fixture(),s=await ready(h),input=await h.inputs();
 for(const password of ['short','é'.repeat(40),'x'.repeat(73)])await assert.rejects(()=>s.accept({...input,password}));
 assert.ok(!h.calls.includes('verifyInvite'));
});
test('saved verified progress resumes after password failure without reusing the consumed provider token',async()=>{
 const h=fixture(),s=await ready(h),input=await h.inputs();h.fail.add('updatePassword');
 await assert.rejects(()=>s.accept(input));assert.equal(h.active,0);assert.ok(h.row.encrypted_credentials);assert.ok(!h.row.encrypted_credentials.includes('private-invitation'));
 h.fail.clear();await service(h).accept(input);assert.equal(h.active,1);assert.equal(h.calls.filter(x=>x==='verifyInvite').length,1);
});
test('password update success followed by failed activation can resume using the selected password',async()=>{
 const h=fixture(),s=await ready(h),input=await h.inputs();h.fail.add('farm_bootstrap_activate');
 await assert.rejects(()=>s.accept(input));assert.equal(h.active,0);h.fail.clear();h.fail.add('updatePassword');
 await service(h).accept(input);assert.equal(h.active,1);
});
test('busy or lost lease and revoked membership cannot activate',async()=>{
 for(const mode of ['busy','lost','revoked']){
  const h=fixture(),s=await ready(h),input=await h.inputs();
  if(mode==='busy'){h.row.lease_owner=crypto.randomUUID();h.row.lease_until=h.clock()+120000;}
  if(mode==='lost'){const original=h.provider.signIn;h.provider.signIn=async(...args)=>{const result=await original(...args);h.advance(120001);return result;};}
  if(mode==='revoked')h.setMember('revoked');
  await assert.rejects(()=>s.accept(input));assert.equal(h.active,0);
 }
});
test('provider cleanup failure keeps activation true and records cleanup as pending',async()=>{
 const h=fixture(),s=await ready(h),input=await h.inputs();h.fail.add('signOut');
 const result=await s.accept(input);assert.equal(result.activated,true);assert.equal(result.providerCleanupPending,true);assert.equal(h.row.provider_cleanup_pending,true);
 assert.ok(h.row.encrypted_credentials);assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('overlapping acceptance attempts allow only one activation and one provider verification',async()=>{
 const h=fixture(),s=await ready(h),input=await h.inputs();
 const outcomes=await Promise.allSettled([s.accept(input),service(h).accept(input)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(h.active,1);
 assert.equal(h.calls.filter(x=>x==='verifyInvite').length,1);
});
test('provider or progress-write failure cannot activate or leak provider details',async()=>{
 for(const failure of ['verifyInvite','getUser','farm_bootstrap_progress','signIn']){
  const h=fixture(),s=await ready(h),input=await h.inputs();h.fail.add(failure);
  await assert.rejects(()=>s.accept(input),e=>!e.message.includes('PRIVATE'));assert.equal(h.active,0);
 }
});
test('activation rechecks the identity returned by password sign-in',async()=>{
 const h=fixture(),s=await ready(h),input=await h.inputs(),original=h.provider.signIn;
 h.provider.signIn=async(...args)=>{const tokens=await original(...args);h.user.email='wrong-after-password@example.test';return tokens;};
 await assert.rejects(()=>s.accept(input));assert.equal(h.active,0);
});
test('restart after saved invitation access expires refreshes and persists credentials before password work',async()=>{
 const h=fixture(),s=await ready(h),input=await h.inputs();h.fail.add('updatePassword');
 await assert.rejects(()=>s.accept(input));h.fail.clear();
 const original=h.provider.getUser,originalUpdate=h.provider.updatePassword;
 let refreshed=false,updated=false;
 h.provider.getUser=async token=>{
  if(token==='private-invitation-access'){const error=new Error('expired');error.status=401;throw error;}
  if(token==='private-renewed-access')return {...h.user};
  return original(token);
 };
 h.provider.refresh=async token=>{assert.equal(token,'private-invitation-refresh');refreshed=true;return {access_token:'private-renewed-access',refresh_token:'private-renewed-refresh'};};
 h.provider.updatePassword=async(token,password)=>{
  assert.equal(token,'private-renewed-access');
  const {unseal}=await import('../../server/security.mjs');
  const saved=await unseal(h.row.encrypted_credentials,h.config.sessionKey,`first-admin:${h.row.id}:${h.row.generation}`);
  assert.equal(saved.invite.refresh_token,'private-renewed-refresh');updated=true;
  return originalUpdate('private-invitation-access',password);
 };
 await service(h).accept(input);assert.equal(h.active,1);assert.equal(refreshed,true);assert.equal(updated,true);
 assert.equal(h.calls.filter(x=>x==='verifyInvite').length,1);
});
test('a retry retains earlier password-probe credentials when provider cleanup still fails',async()=>{
 const h=fixture(),s=await ready(h),input=await h.inputs(),originalSignIn=h.provider.signIn,originalGet=h.provider.getUser;
 let count=0;
 h.provider.signIn=async(...args)=>({...await originalSignIn(...args),access_token:++count===1?'private-probe-one':'private-probe-two'});
 h.provider.getUser=async token=>token.startsWith('private-probe-')?{...h.user}:originalGet(token);
 h.provider.signOut=async token=>{if(token==='private-probe-one')throw new Error('PRIVATE CLEANUP FAILURE');};
 h.fail.add('farm_bootstrap_activate');await assert.rejects(()=>s.accept(input));h.fail.clear();
 const result=await service(h).accept(input);assert.equal(result.activated,true);assert.equal(result.providerCleanupPending,true);
 const {unseal}=await import('../../server/security.mjs');
 const saved=await unseal(h.row.encrypted_credentials,h.config.sessionKey,`first-admin:${h.row.id}:${h.row.generation}`);
 assert.ok(saved.previousProbes.some(tokens=>tokens.access_token==='private-probe-one'));
});
