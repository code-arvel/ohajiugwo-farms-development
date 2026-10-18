import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionHandler} from '../../server/auth/session-http.mjs';
import {newToken} from '../../server/security.mjs';

import {reauthFixture as fixture} from './fixtures/reauthentication.mjs';
test('password confirmation rotates cookie/CSRF/provider session and preserves original absolute expiry',async()=>{
 const h=fixture(),old=await h.login(),oldRow=[...h.rows.values()][0];h.advance(301000);await assert.rejects(()=>h.service.authenticate(h.request(old.cookie,old.csrfToken),{requireRecent:true}),error=>error.status===428);
 const result=await h.service.reauthenticate(h.request(old.cookie,old.csrfToken),{password:'DummyFarmPass123!'});assert.notEqual(result.cookie,old.cookie);assert.notEqual(result.csrfToken,old.csrfToken);assert.ok(!JSON.stringify(result).includes('MOCK_REFRESH'));
 await assert.rejects(()=>h.service.authenticate(h.request(old.cookie,old.csrfToken)),error=>error.status===401);const actor=await h.service.authenticate(h.request(result.cookie,result.csrfToken),{requireRecent:true});assert.equal(actor.user.email,'owner@example.test');const row=[...h.rows.values()].find(value=>!value.revoked_at);assert.equal(row.absolute_expires_at,oldRow.absolute_expires_at);assert.notEqual(row.provider_session_id,oldRow.provider_session_id);assert.match(result.cookie,/Max-Age=42899;/);assert.equal(row.provider_cleanup_pending,false);assert.equal(oldRow.revoked_at!==undefined,true);
});
test('confirmation rejects CSRF, bad password, wrong identity and throttling without elevating the original session',async()=>{
 for(const mode of ['csrf','password','identity','limit']){const h=fixture(),old=await h.login();h.advance(301000);if(mode==='identity')h.setProofUser(h.other);if(mode==='limit')h.setAllowed(false);await assert.rejects(()=>h.service.reauthenticate(h.request(old.cookie,mode==='csrf'?newToken():old.csrfToken),{password:mode==='password'?'wrong':'DummyFarmPass123!'}),error=>error.status===(mode==='csrf'?403:mode==='limit'?429:401));await assert.rejects(()=>h.service.authenticate(h.request(old.cookie,old.csrfToken),{requireRecent:true}),error=>error.status===428);if(mode==='csrf'||mode==='limit')assert.equal(h.signs,1);}
});
test('revocation during confirmation prevents activation and keeps staged cleanup recoverable',async()=>{
 const h=fixture(),old=await h.login();h.setMode('revoke');h.setCleanupFails(true);await assert.rejects(()=>h.service.reauthenticate(h.request(old.cookie,old.csrfToken),{password:'DummyFarmPass123!'}));const staged=[...h.rows.values()].find(row=>row.reauth_parent);assert.ok(staged.revoked_at);assert.equal(staged.provider_cleanup_pending,true);assert.equal(staged.reauth_until,null);
});
test('database failure before activation keeps old session valid; lost commit acknowledgement recovers only the new active row',async()=>{
 const before=fixture(),old=await before.login();before.setMode('before');await assert.rejects(()=>before.service.reauthenticate(before.request(old.cookie,old.csrfToken),{password:'DummyFarmPass123!'}),error=>error.status===503);await before.service.authenticate(before.request(old.cookie,old.csrfToken));
 const after=fixture(),first=await after.login();after.setMode('after');const result=await after.service.reauthenticate(after.request(first.cookie,first.csrfToken),{password:'DummyFarmPass123!'});assert.equal(result.providerCleanupPending,true);await after.service.authenticate(after.request(result.cookie,result.csrfToken),{requireRecent:true});await assert.rejects(()=>after.service.authenticate(after.request(first.cookie,first.csrfToken)),error=>error.status===401);
});
test('reauthentication HTTP is POST-only, bounded, CSRF-protected and projects only safe rotated session data',async()=>{
 const h=fixture(),old=await h.login(),handler=createSessionHandler(h.config,{service:h.service});assert.equal((await handler(new Request(h.config.origin+'/admin/api/reauthenticate'))).status,405);const response=await handler(h.request(old.cookie,old.csrfToken));assert.equal(response.status,200);const result=await response.json();assert.equal(result.user.email,'owner@example.test');assert.notEqual(result.csrfToken,old.csrfToken);assert.ok(!JSON.stringify(result).includes('MOCK_REFRESH'));assert.match(response.headers.get('set-cookie'),/HttpOnly/);
});
test('a provider reusing the old session must never cause its cleanup on a verification outage',async()=>{
 const h=fixture(),old=await h.login(),getUser=h.provider.getUser;let reads=0;h.provider.signIn=async()=>h.issued[0];h.provider.getUser=async token=>{if(++reads===2)throw new Error('MOCK_NETWORK');return getUser(token);};
 await assert.rejects(()=>h.service.reauthenticate(h.request(old.cookie,old.csrfToken),{password:'DummyFarmPass123!'}),error=>error.status===503);h.provider.getUser=getUser;await h.service.authenticate(h.request(old.cookie,old.csrfToken));assert.ok(!h.calls.includes('signOut'));
});
test('recent confirmation expires at five minutes and rejects absent or future timestamps',async()=>{
 const h=fixture(),session=await h.login(),request=h.request(session.cookie,session.csrfToken);h.advance(299999);await h.service.authenticate(request,{requireRecent:true});h.advance(1);await assert.rejects(()=>h.service.authenticate(request,{requireRecent:true}),error=>error.status===428);const row=[...h.rows.values()][0];for(const stamp of [null,new Date(Date.now()+3600000).toISOString()]){row.reauthenticated_at=stamp;await assert.rejects(()=>h.service.authenticate(request,{requireRecent:true}),error=>error.status===428);}
});
test('concurrent confirmations cannot both activate or revoke the winning provider session',async()=>{
 const h=fixture(),old=await h.login(),results=await Promise.allSettled([h.service.reauthenticate(h.request(old.cookie,old.csrfToken),{password:'DummyFarmPass123!'}),h.service.reauthenticate(h.request(old.cookie,old.csrfToken),{password:'DummyFarmPass123!'})]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);const result=results.find(item=>item.status==='fulfilled').value;await h.service.authenticate(h.request(result.cookie,result.csrfToken),{requireRecent:true});assert.equal([...h.rows.values()].filter(row=>!row.revoked_at).length,1);
});
test('verification outage retains a staged cleanup record if provider sign-out also fails',async()=>{
 const h=fixture(),old=await h.login(),getUser=h.provider.getUser;let reads=0;h.setCleanupFails(true);h.provider.getUser=async token=>{if(++reads===2)throw new Error('MOCK_VERIFICATION_OUTAGE');return getUser(token);};await assert.rejects(()=>h.service.reauthenticate(h.request(old.cookie,old.csrfToken),{password:'DummyFarmPass123!'}),error=>error.status===503);const staged=[...h.rows.values()].find(row=>row.reauth_parent);assert.ok(staged?.revoked_at);assert.equal(staged.provider_cleanup_pending,true);assert.equal(staged.reauth_until,null);
});
test('reauthentication route rejects malformed bodies, extra fields, oversized input and missing Origin/CSRF',async()=>{
 for(const [body,patch,status] of [['{',{},400],[JSON.stringify({password:'dummy',email:'attacker@example.test'}),{},400],['x'.repeat(4097),{},413],['{}',{'content-type':'text/plain'},415],['{}',{origin:''},403],['{}',{'x-csrf-token':''},403],['{}',{'x-csrf-token':newToken()},403]]){const h=fixture(),old=await h.login(),original=h.request(old.cookie,old.csrfToken),headers={...Object.fromEntries(original.headers),...patch},response=await createSessionHandler(h.config,{service:h.service})(new Request(original.url,{method:'POST',headers,body}));assert.equal(response.status,status);assert.equal(h.signs,1);assert.ok(!(await response.text()).includes('MOCK_'));}
});
test('successful rotation keeps old cleanup work durable when provider sign-out fails',async()=>{
 const h=fixture(),old=await h.login();h.setCleanupFails(true);const result=await h.service.reauthenticate(h.request(old.cookie,old.csrfToken),{password:'DummyFarmPass123!'});assert.equal(result.providerCleanupPending,true);assert.equal([...h.rows.values()].filter(row=>row.revoked_at&&row.provider_cleanup_pending).length,1);await h.service.authenticate(h.request(result.cookie,result.csrfToken),{requireRecent:true});
});
