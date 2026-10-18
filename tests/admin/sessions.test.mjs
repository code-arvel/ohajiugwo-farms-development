import test from 'node:test';import assert from 'node:assert/strict';
import {createAuthService,AuthError} from '../../server/auth/sessions.mjs';
import {loadAdminConfig} from '../../server/config.mjs';import {newToken,sessionDigest} from '../../server/security.mjs';
const userId='11111111-1111-4111-8111-111111111111',providerId='22222222-2222-4222-8222-222222222222';
const config=()=>loadAdminConfig({ADMIN_ENVIRONMENT:'hosted-development',ADMIN_ORIGIN:'http://127.0.0.1:4322',SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SECRET_KEY:'private',ADMIN_SESSION_KEY:'ab'.repeat(32)});
function harness(){
 const c=config();let row=null,active=true,lease=false,refreshes=0,expiresIn=3600;const events=[];
 const tokens=(ttl=expiresIn)=>({access_token:'header.'+btoa(JSON.stringify({sub:userId,session_id:providerId,role:'authenticated',iss:c.supabaseUrl+'/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+ttl})).replace(/=+$/,'')+'.signature',refresh_token:'private-refresh-token'});
 const provider={signIn:async()=>tokens(),getUser:async()=>({id:userId,email:'owner@example.test',email_confirmed_at:new Date().toISOString()}),refresh:async()=>{refreshes++;return tokens(3600);},signOut:async()=>{events.push('provider-signout');}};
 const rpc=async(name,p)=>{
  events.push(name);
  if(name==='farm_auth_attempt')return true;
  if(name==='farm_session_open'){if(!active)throw new AuthError('Denied',403);row={id:crypto.randomUUID(),user_id:p.p_user_id,provider_session_id:p.p_provider_session_id,cookie_hash:p.p_cookie_hash,encrypted_credentials:p.p_encrypted_credentials,csrf_hash:p.p_csrf_hash,refresh_version:0};return row;}
  if(name==='farm_session_read')return active&&row&&!row.revoked_at&&row.cookie_hash===p.p_cookie_hash?{...row}:null;
  if(name==='farm_session_close'){if(row)row.revoked_at='now';return row;}
  if(name==='farm_session_cleanup_done')return null;
  if(name==='farm_session_refresh_claim'){if(lease)return null;lease=true;return {...row};}
  if(name==='farm_session_refresh_finish'){if(!active||row.revoked_at)return false;row.encrypted_credentials=p.p_encrypted_credentials;row.refresh_version++;lease=false;return active&&!row.revoked_at;}
  if(name==='farm_session_refresh_release'){lease=false;return null;}
  throw new Error('Unexpected RPC '+name);
 };
 const service=createAuthService(c,{provider,rpc});
 return {c,provider,rpc,service,events,get row(){return row;},setActive:v=>active=v,setTtl:v=>expiresIn=v,setLease:v=>lease=v,get refreshes(){return refreshes;}};
}
const req=(h,cookie,csrf,origin=h.c.origin)=>new Request(h.c.origin+'/admin/api/logout',{method:'POST',headers:{cookie,origin,'x-csrf-token':csrf||''}});
test('sign-in creates only an opaque cookie and encrypted server credentials for an active member',async()=>{
 const h=harness(),result=await h.service.login({email:'Owner@example.test',password:'a private password',clientIp:'127.0.0.1'});
 assert.match(result.cookie,/HttpOnly/);assert.ok(!JSON.stringify(result).includes('private-refresh'));
 assert.ok(!h.row.encrypted_credentials.includes('private-refresh'));assert.match(h.row.cookie_hash,/^[A-Za-z0-9_-]{43}$/);
 const actor=await h.service.authenticate(new Request(h.c.origin+'/admin',{headers:{cookie:result.cookie}}));
 assert.equal(actor.user.id,userId);assert.equal(actor.csrfToken,result.csrfToken);assert.ok(actor.accessToken);assert.match(actor.cookieHash,/^[A-Za-z0-9_-]{43}$/);assert.ok(!JSON.stringify(actor).includes(actor.cookieHash));assert.ok(!JSON.stringify(actor).includes('private-refresh'));assert.ok(!JSON.stringify(actor).includes('.signature'));
});
test('account-mutation CSRF failure does not revoke a valid session',async()=>{
 const h=harness(),result=await h.service.login({email:'owner@example.test',password:'password',clientIp:'127.0.0.1'});
 await assert.rejects(()=>h.service.authenticate(new Request(h.c.origin+'/admin',{headers:{cookie:result.cookie}}),{requireRecent:true,requireMutation:true}),e=>e.status===403);
 assert.ok(!h.row.revoked_at);const actor=await h.service.authenticate(new Request(h.c.origin+'/admin',{headers:{cookie:result.cookie}}));assert.equal(actor.user.id,userId);
});
test('auth success without active membership is denied and provider session is cleaned up',async()=>{
 const h=harness();h.setActive(false);await assert.rejects(()=>h.service.login({email:'owner@example.test',password:'password',clientIp:'127.0.0.1'}),e=>e.status===401&&e.message==='Unable to sign in with those details.');assert.ok(h.events.includes('provider-signout'));
});
test('session/membership revocation and missing cookies deny requests without provider refresh',async()=>{
 const h=harness();const result=await h.service.login({email:'owner@example.test',password:'password',clientIp:'127.0.0.1'});
 h.setActive(false);await assert.rejects(()=>h.service.authenticate(new Request(h.c.origin+'/admin',{headers:{cookie:result.cookie}})),e=>e.status===401);
 await assert.rejects(()=>h.service.authenticate(new Request(h.c.origin+'/admin')),e=>e.status===401);assert.equal(h.refreshes,0);
});
test('logout enforces CSRF, revokes application session before provider cleanup, and keeps revocation if provider fails',async()=>{
 const h=harness(),result=await h.service.login({email:'owner@example.test',password:'password',clientIp:'127.0.0.1'});
 await assert.rejects(()=>h.service.logout(req(h,result.cookie,newToken(),'https://attacker.test')));assert.ok(!h.row.revoked_at);
 h.provider.signOut=async()=>{h.events.push('provider-signout');throw new Error('private-network-error');};
 const cleared=await h.service.logout(req(h,result.cookie,result.csrfToken));assert.match(cleared.cookie,/Max-Age=0/);assert.ok(h.row.revoked_at);
 assert.ok(h.events.indexOf('farm_session_close')<h.events.indexOf('provider-signout'));assert.equal(cleared.providerCleanupPending,true);
});
test('rate-limit denial stops password authentication; private provider failures are redacted',async()=>{
 const h=harness();let signs=0;h.provider.signIn=async()=>{signs++;throw new Error('private password');};
 const limited=createAuthService(h.c,{provider:h.provider,rpc:async()=>false});await assert.rejects(()=>limited.login({email:'owner@example.test',password:'password',clientIp:'127.0.0.1'}),e=>e.status===429);assert.equal(signs,0);
 await assert.rejects(()=>h.service.login({email:'owner@example.test',password:'password',clientIp:'127.0.0.1'}),e=>!e.message.includes('private password'));
});

test('near-expiry JWT rotates under a DB lease and preserves CSRF without exposing tokens',async()=>{
 const h=harness();h.setTtl(10);const result=await h.service.login({email:'owner@example.test',password:'password',clientIp:'127.0.0.1'});
 const actor=await h.service.authenticate(new Request(h.c.origin+'/admin',{headers:{cookie:result.cookie}}));
 assert.equal(h.refreshes,1);assert.equal(h.row.refresh_version,1);assert.equal(actor.csrfToken,result.csrfToken);assert.ok(!JSON.stringify(actor).includes('.signature'));
});
test('busy refresh lease returns retryable failure without a second refresh',async()=>{
 const h=harness();h.setTtl(10);const result=await h.service.login({email:'owner@example.test',password:'password',clientIp:'127.0.0.1'});h.setLease(true);
 await assert.rejects(()=>h.service.authenticate(new Request(h.c.origin+'/admin',{headers:{cookie:result.cookie}})),e=>e.status===503);assert.equal(h.refreshes,0);
});
test('revocation during refresh cannot revive the session',async()=>{
 const h=harness();h.setTtl(10);const result=await h.service.login({email:'owner@example.test',password:'password',clientIp:'127.0.0.1'});const refresh=h.provider.refresh;
 h.provider.refresh=async token=>{h.setActive(false);return refresh(token);};
 await assert.rejects(()=>h.service.authenticate(new Request(h.c.origin+'/admin',{headers:{cookie:result.cookie}})),e=>e.status===401);assert.ok(h.row.revoked_at);assert.equal(h.row.refresh_version,0);
});
test('provider invalidation closes the application session, while a network outage is retryable',async()=>{
 const h=harness();const result=await h.service.login({email:'owner@example.test',password:'password',clientIp:'127.0.0.1'});
 h.provider.getUser=async()=>{throw new Error('private network detail');};
 const request=new Request(h.c.origin+'/admin',{headers:{cookie:result.cookie}});
 await assert.rejects(()=>h.service.authenticate(request),e=>e.status===503);assert.ok(!h.row.revoked_at);
 h.provider.getUser=async()=>{throw new AuthError('Private provider message',401);};
 await assert.rejects(()=>h.service.authenticate(request),e=>e.status===401&&!e.message.includes('Private provider'));assert.ok(h.row.revoked_at);
});
