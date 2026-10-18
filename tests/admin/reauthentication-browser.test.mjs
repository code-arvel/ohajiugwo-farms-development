import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionController} from '../../admin/session/client.mjs';
import {createSessionBrowserHandler} from '../../server/auth/session-screen.mjs';
import {reauthFixture} from './fixtures/reauthentication.mjs';
const user={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'},csrfToken='a'.repeat(43),rotated='b'.repeat(43),password='DummyFarmPass123!';
function browser(replies){
 const states=[],requests=[],navigations=[];
 const controller=createSessionController({mode:'reauthenticate',csrfToken,user,view:{render:value=>states.push(value)},onNavigate:path=>navigations.push(path),fetchImpl:async(path,options)=>{requests.push({path,options});const reply=replies.shift();if(reply instanceof Error)throw reply;return new Response(JSON.stringify(reply?.body||{}),{status:reply?.status||200});}});
 controller.start();return {controller,requests,states,navigations,last:()=>states.at(-1)};
}
test('password confirmation validates only password and submits current identity context once to fixed route',async()=>{
 const h=browser([{body:{user,csrfToken:rotated,providerCleanupPending:true}}]);await h.controller.submit({password:''});assert.ok(h.last().fieldErrors.password);assert.equal(h.requests.length,0);
 await h.controller.submit({password,email:'attacker@example.test'});assert.equal(h.last().phase,'confirmed');assert.equal(h.requests.length,1);assert.equal(h.requests[0].path,'/admin/api/reauthenticate');assert.equal(h.requests[0].options.headers['x-csrf-token'],csrfToken);assert.deepEqual(JSON.parse(h.requests[0].options.body),{password});assert.equal(h.navigations.length,0);assert.ok(!JSON.stringify(h.states).includes(password));
});
test('wrong password and rate limit show safe correctable errors; CSRF requires reload',async()=>{
 for(const status of [401,429,403]){const h=browser([{status,body:{error:'PRIVATE_PROVIDER_DETAIL'}},...(status===401?[{body:{user,csrfToken}}]:[])]);await h.controller.submit({password});assert.equal(h.last().phase,status===403?'reload':'error');if(status===401){assert.ok(h.last().fieldErrors.password);assert.equal(h.requests.length,2);assert.equal(h.requests[1].path,'/admin/api/session');}assert.ok(!JSON.stringify(h.states).includes('PRIVATE_PROVIDER_DETAIL'));assert.equal(h.navigations.length,0);}
});
test('unknown confirmation outcomes require explicit reload without GET inference or second POST',async()=>{
 for(const reply of [new Error('PRIVATE_OUTAGE'),{status:503},{body:{user,csrfToken}},{body:{user:{...user,id:'someone-else'},csrfToken:rotated,providerCleanupPending:false}},{body:{user:{...user,email:'someone@example.test'},csrfToken:rotated,providerCleanupPending:false}},{body:{user,csrfToken:rotated}}]){
 const h=browser([reply]);await h.controller.submit({password});assert.equal(h.last().phase,'reload');await h.controller.submit({password});assert.equal(h.requests.length,1);assert.equal(h.navigations.length,0);}
});
test('confirmation response cannot restore or navigate a disposed document and duplicate submit is blocked',async()=>{
 let finish;const states=[],requests=[];const h=createSessionController({mode:'reauthenticate',csrfToken,user,view:{render:value=>states.push(value)},onNavigate:()=>assert.fail('unexpected navigation'),fetchImpl:async(path,options)=>{requests.push({path,options});return new Promise(resolve=>finish=resolve);}});h.start();const pending=h.submit({password});await h.submit({password});assert.equal(requests.length,1);h.dispose();finish(new Response(JSON.stringify({user,csrfToken:rotated,providerCleanupPending:false})));await pending;assert.equal(states.at(-1).phase,'closed');
});
test('confirmation GET requires live membership, renders current identity/password and never performs confirmation',async()=>{
 const h=reauthFixture(),handler=createSessionBrowserHandler(h.config,{service:h.service}),url=h.config.origin+'/admin/confirm-password';
 const anonymous=await handler(new Request(url));assert.equal(anonymous.status,303);assert.equal(anonymous.headers.get('location'),'/admin/login');
 const session=await h.login(),response=await handler(new Request(url,{headers:{cookie:session.cookie}})),html=await response.text();assert.equal(response.status,200);assert.match(html,/Confirm your password/);assert.match(html,/autocomplete="current-password"/);assert.match(html,/action="\/admin\/api\/reauthenticate"/);assert.ok(!html.includes('id="email"'));assert.ok(html.includes(user.email));assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(h.signs,1);
 assert.equal((await handler(new Request(url+'?next=https://attacker.test',{headers:{cookie:session.cookie}}))).status,400);h.setActive(false);assert.equal((await handler(new Request(url,{headers:{cookie:session.cookie}}))).status,303);
});

test('401 is correctable only after the same original session context is verified; changed/ended context requires reload',async()=>{
 for(const context of [{status:401},{body:{user,csrfToken:rotated}},{body:{user:{...user,id:'other'},csrfToken}}]){
 const h=browser([{status:401},context]);await h.controller.submit({password});assert.equal(h.last().phase,'reload');await h.controller.submit({password});assert.equal(h.requests.filter(value=>value.options.method==='POST').length,1);}
});
test('malformed response and disposal during JSON reading cannot claim confirmation',async()=>{
 let finish;const states=[];const controller=createSessionController({mode:'reauthenticate',csrfToken,user,view:{render:value=>states.push(value)},onNavigate:()=>assert.fail('unexpected navigation'),fetchImpl:async()=>({ok:true,status:200,json:()=>new Promise(resolve=>finish=resolve)})});
 controller.start();const pending=controller.submit({password});await new Promise(resolve=>setImmediate(resolve));controller.dispose();finish({user,csrfToken:rotated,providerCleanupPending:false});await pending;assert.equal(states.at(-1).phase,'closed');
 const failed=[];const malformed=createSessionController({mode:'reauthenticate',csrfToken,user,view:{render:value=>failed.push(value)},fetchImpl:async()=>new Response('not-json')});malformed.start();await malformed.submit({password});assert.equal(failed.at(-1).phase,'reload');
});
