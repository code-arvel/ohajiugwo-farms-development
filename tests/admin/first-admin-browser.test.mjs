import test from 'node:test';
import assert from 'node:assert/strict';
const browser=await import('../../admin/accept/client.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const id='11111111-1111-4111-8111-111111111111',nonce='n'.repeat(43),tokenHash='f'.repeat(64);
const fragment=`#id=${id}&nonce=${nonce}&token_hash=${tokenHash}`;
const password='a good local password';
function harness(replies){
 const states=[],requests=[];
 const controller=browser.createAcceptanceController({fragment,view:{render:value=>states.push(value)},fetchImpl:async(url,options)=>{
  requests.push({url,options});const next=replies.shift();if(next instanceof Error)throw next;return new Response(JSON.stringify(next?.body||{}),{status:next?.status||200});
 }});
 return {controller,states,requests,last:()=>states.at(-1)};
}
test('fragment parser accepts only one bounded app invitation and rejects query/provider/duplicate tokens',()=>{
 assert.equal(typeof browser.parseInvitation,'function');
 assert.deepEqual(browser.parseInvitation(fragment),{id,nonce,tokenHash});
 for(const invalid of ['',fragment+'&nonce='+nonce,'#access_token=PRIVATE&refresh_token=PRIVATE',fragment+'&redirect_to=https://attacker.test','#id=bad',fragment+'x'.repeat(2100)])assert.equal(browser.parseInvitation(invalid),null);
 assert.equal(browser.parseInvitation(fragment,true),null);
});
test('browser password validation covers confirmation, Unicode byte limits and paste-friendly spaces',()=>{
 assert.equal(browser.passwordError(password,password),'');
 for(const pair of [['short','short'],[password,'different'],['é'.repeat(40),'é'.repeat(40)]])assert.ok(browser.passwordError(...pair));
});
test('successful explicit submission sends secrets only in POST and clears view on completion',async()=>{
 const h=harness([{body:{csrfToken:'c'.repeat(43)}},{body:{csrfToken:'c'.repeat(43)}},{body:{activated:true,signInRequired:true,providerCleanupPending:false}}]);
 await h.controller.start();assert.equal(h.last().phase,'ready');assert.ok(h.requests.every(x=>x.options.method==='GET'));
 await h.controller.submit({password,confirmation:password});assert.equal(h.last().phase,'complete');
 assert.equal(h.requests.filter(x=>x.options.method==='POST').length,1);
 const post=h.requests.find(x=>x.options.method==='POST');assert.deepEqual(JSON.parse(post.options.body),{id,nonce,tokenHash,password});
 for(const call of h.requests){assert.equal(call.url,'/admin/accept');assert.equal(call.options.credentials,'same-origin');assert.equal(call.options.cache,'no-store');assert.ok(!call.url.includes(nonce));}
 assert.ok(!JSON.stringify(h.states).includes(nonce));assert.ok(!JSON.stringify(h.states).includes(password));
});
test('invalid link never calls API and invalid passwords never submit',async()=>{
 let calls=0;const states=[];const controller=browser.createAcceptanceController({fragment:'#broken',view:{render:s=>states.push(s)},fetchImpl:async()=>{calls++;throw new Error();}});
 await controller.start();assert.equal(states.at(-1).phase,'invalid');assert.equal(calls,0);
 const h=harness([{body:{csrfToken:'c'.repeat(43)}}]);await h.controller.start();await h.controller.submit({password:'short',confirmation:'short'});
 assert.equal(h.last().phase,'ready');assert.equal(h.requests.length,1);
});
test('missing password remains a correctable validation error without throwing or submitting',async()=>{
 const h=harness([{body:{csrfToken:'c'.repeat(43)}}]);await h.controller.start();
 await h.controller.submit({confirmation:''});assert.equal(h.last().phase,'ready');assert.ok(h.last().message);assert.equal(h.requests.length,1);
});
test('expired/cancelled/reused links become a safe terminal state without provider error text',async()=>{
 const h=harness([{body:{csrfToken:'c'.repeat(43)}},{body:{csrfToken:'c'.repeat(43)}},{status:400,body:{error:'PRIVATE PROVIDER DETAIL'}}]);
 await h.controller.start();await h.controller.submit({password,confirmation:password});assert.equal(h.last().phase,'invalid');assert.ok(!JSON.stringify(h.states).includes('PRIVATE'));
 await h.controller.submit({password,confirmation:password});assert.equal(h.requests.length,3);
});
test('network/provider failure allows manual retry with memory-only context and fresh CSRF',async()=>{
 const h=harness([{body:{csrfToken:'c'.repeat(43)}},{body:{csrfToken:'c'.repeat(43)}},new Error('PRIVATE NETWORK DETAIL'),{body:{csrfToken:'d'.repeat(43)}},{body:{csrfToken:'e'.repeat(43)}},{body:{activated:true,signInRequired:true,providerCleanupPending:false}}]);
 await h.controller.start();await h.controller.submit({password,confirmation:password});assert.equal(h.last().phase,'retry');assert.ok(!JSON.stringify(h.states).includes('PRIVATE'));
 await h.controller.submit({password,confirmation:password});assert.equal(h.last().phase,'complete');assert.equal(h.requests.filter(x=>x.options.method==='POST').length,2);
});
test('completion receipt recovers a lost success response without another activation POST',async()=>{
 const h=harness([{body:{csrfToken:'c'.repeat(43)}},{body:{csrfToken:'c'.repeat(43)}},new Error('lost body'),{body:{completed:true}}]);
 await h.controller.start();await h.controller.submit({password,confirmation:password});assert.equal(h.last().phase,'complete');assert.equal(h.requests.filter(x=>x.options.method==='POST').length,1);
});
test('duplicate submits, pagehide and late responses cannot reactivate or restore cleared context',async()=>{
 let finish;const h=harness([{body:{csrfToken:'c'.repeat(43)}}]);await h.controller.start();
 // A network request remains pending while a second submit and disposal occur.
 const states=[];let posts=0;
 const controller=browser.createAcceptanceController({fragment,view:{render:s=>states.push(s)},fetchImpl:async(url,options)=>{
  if(options.method==='GET')return new Response(JSON.stringify({csrfToken:'c'.repeat(43)}));posts++;return await new Promise(resolve=>finish=resolve);
 }});
 await controller.start();const pending=controller.submit({password,confirmation:password});
 await new Promise(resolve=>setTimeout(resolve,0));await controller.submit({password,confirmation:password});assert.equal(posts,1);
 controller.dispose();finish(new Response(JSON.stringify({activated:true,signInRequired:true,providerCleanupPending:false})));await pending;
 assert.equal(states.at(-1).phase,'closed');
});
