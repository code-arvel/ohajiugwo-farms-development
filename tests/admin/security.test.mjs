import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAdminConfig } from '../../server/config.mjs';
import { seal, unseal, sessionDigest, newToken, sessionCookie, checkMutation, parseSessionCookie } from '../../server/security.mjs';
const env=()=>({ADMIN_ENVIRONMENT:'hosted-development',ADMIN_ORIGIN:'http://127.0.0.1:4322',SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-public-key',SUPABASE_SECRET_KEY:'test-private-key',ADMIN_SESSION_KEY:'ab'.repeat(32)});
test('hosted configuration refuses missing keys, wrong projects and unsafe origins',()=>{
 const valid=env();assert.equal(loadAdminConfig(valid).origin,valid.ADMIN_ORIGIN);
 for(const key of Object.keys(valid)){const copy={...valid};delete copy[key];assert.throws(()=>loadAdminConfig(copy));}
 for(const patch of [{SUPABASE_URL:'https://otherprojectabcdefgh.supabase.co'},{SUPABASE_URL:'http://abcdefghijklmnopqrst.supabase.co'},{ADMIN_ORIGIN:'http://example.com'},{ADMIN_ORIGIN:'https://example.com/admin'},{ADMIN_ORIGIN:'https://user:pass@example.com'},{ADMIN_SESSION_KEY:'short'},{ADMIN_ENVIRONMENT:'production'}])assert.throws(()=>loadAdminConfig({...valid,...patch}));
 assert.equal(loadAdminConfig({...valid,ADMIN_ORIGIN:'https://review.example.com'}).secureCookies,true);
});
test('provider invitation issuance stays independently disabled unless its exact local gate is present',()=>{
 assert.equal(loadAdminConfig(env()).accountInviteIssueEnabled,false);
 assert.equal(loadAdminConfig({...env(),ADMIN_ENABLE_PROVIDER_INVITATION_ISSUE:'true'}).accountInviteIssueEnabled,false);
 assert.equal(loadAdminConfig({...env(),ADMIN_ENABLE_PROVIDER_INVITATION_ISSUE:'confirmed-development-only'}).accountInviteIssueEnabled,true);
});
test('password recovery link generation stays disabled unless its separate exact gate is present',()=>{
 assert.equal(loadAdminConfig(env()).accountRecoveryIssueEnabled,false);
 assert.equal(loadAdminConfig({...env(),ADMIN_ENABLE_PROVIDER_RECOVERY_ISSUE:'true'}).accountRecoveryIssueEnabled,false);
 assert.equal(loadAdminConfig({...env(),ADMIN_ENABLE_PROVIDER_RECOVERY_ISSUE:'confirmed-development-only'}).accountRecoveryIssueEnabled,true);
});
test('encrypted provider sessions are authenticated and bound to their application session',async()=>{
 const key='ab'.repeat(32),token={access_token:'private-access',refresh_token:'private-refresh'};
 const ciphertext=await seal(token,key,'session-a');assert.ok(!ciphertext.includes('private'));
 assert.deepEqual(await unseal(ciphertext,key,'session-a'),token);
 await assert.rejects(()=>unseal(ciphertext,key,'session-b'));
 await assert.rejects(()=>unseal(ciphertext,'cd'.repeat(32),'session-a'));
 await assert.rejects(()=>unseal(ciphertext.slice(0,-5)+'aaaaa',key,'session-a'));
 const id=newToken();assert.match(id,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(await sessionDigest(id),id);
});
test('session cookie is host-only, httpOnly, bounded and secure except loopback HTTP',()=>{
 const config=loadAdminConfig(env()),token=newToken();
 const cookie=sessionCookie(token,config);assert.match(cookie,/HttpOnly; SameSite=Lax/);assert.match(cookie,/Path=\/admin/);assert.ok(!cookie.includes('Domain='));assert.ok(!cookie.includes('; Secure'));
 assert.equal(parseSessionCookie(cookie,config),token);
 assert.equal(parseSessionCookie(cookie+'; ohajiugwo_admin_local='+token,config),null);
 assert.equal(parseSessionCookie('ohajiugwo_admin_local=bad',config),null);
 const secure=loadAdminConfig({...env(),ADMIN_ORIGIN:'https://review.example.com'});
 assert.match(sessionCookie(token,secure),/^__Secure-ohajiugwo_admin=/);assert.match(sessionCookie(token,secure),/; Secure/);
 assert.match(sessionCookie('',config),/Max-Age=0/);
});
test('mutations require matching origin and CSRF token; cross-site and malformed requests fail closed',async()=>{
 const config=loadAdminConfig(env()),csrf=newToken();
 const req=(headers={})=>new Request(config.origin+'/admin/api/save',{method:'POST',headers:{origin:config.origin,'x-csrf-token':csrf,...headers}});
 await checkMutation(req(),config,csrf);
 for(const headers of [{origin:'https://attacker.test'},{origin:''},{'x-csrf-token':''},{'x-csrf-token':newToken()},{'sec-fetch-site':'cross-site'}])await assert.rejects(()=>checkMutation(req(headers),config,csrf));
});
