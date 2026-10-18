import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {newToken} from '../../server/security.mjs';
import {sessionFixture} from './fixtures/session-http.mjs';
const client=await import('../../admin/session/client.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const screen=await import('../../server/auth/session-screen.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const user={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'},csrfToken='c'.repeat(43),password='DummyFarmPass123!';
function browser(replies,mode='login'){
 const states=[],requests=[],navigations=[];
 const controller=client.createSessionController({mode,csrfToken,view:{render:value=>states.push(value)},onNavigate:path=>navigations.push(path),fetchImpl:async(path,options)=>{requests.push({path,options});const next=replies.shift();if(next instanceof Error)throw next;return new Response(JSON.stringify(next?.body||{}),{status:next?.status||200});}});
 controller.start();return {controller,states,requests,navigations,last:()=>states.at(-1)};
}
test('login validates fields before requests and submits only once with fresh CSRF and fixed navigation',async()=>{
 const h=browser([{body:{csrfToken}},{body:{user,csrfToken}}]);await h.controller.submit({email:'bad',password:''});assert.ok(h.last().fieldErrors.email);assert.ok(h.last().fieldErrors.password);assert.equal(h.requests.length,0);
 await h.controller.submit({email:user.email,password});assert.equal(h.last().phase,'complete');assert.deepEqual(h.navigations,['/admin/']);
 assert.deepEqual(h.requests.map(item=>[item.path,item.options.method]),[['/admin/api/login','GET'],['/admin/api/login','POST']]);assert.equal(h.requests[1].options.headers['x-csrf-token'],csrfToken);assert.deepEqual(JSON.parse(h.requests[1].options.body),{email:user.email,password});assert.ok(!JSON.stringify(h.states).includes(password));
});
test('generic login errors and throttling retain a correctable screen without unsafe provider text',async()=>{
 for(const status of [401,403,429]){const h=browser([{body:{csrfToken}},{status,body:{error:'MOCK_PRIVATE'}}]);await h.controller.submit({email:user.email,password});assert.ok(['error','retry'].includes(h.last().phase));assert.ok(!JSON.stringify(h.states).includes('MOCK_PRIVATE'));assert.equal(h.navigations.length,0);}
});
test('lost login response is recoverable by a matching authenticated GET, never an automatic second POST',async()=>{
 const h=browser([{body:{csrfToken}},new Error('MOCK_PRIVATE'),{body:{user,csrfToken}}]);await h.controller.submit({email:user.email,password});assert.deepEqual(h.navigations,['/admin/']);assert.equal(h.requests.filter(item=>item.options.method==='POST').length,1);
 const wrong=browser([{body:{csrfToken}},new Error(),{body:{user:{...user,email:'someone@example.test'},csrfToken}}]);await wrong.controller.submit({email:user.email,password});assert.equal(wrong.last().phase,'retry');assert.equal(wrong.navigations.length,0);
});
test('logout uncertainty requires manual retry and never claims success before confirmed revocation',async()=>{
 const h=browser([new Error('MOCK_PRIVATE'),{body:{signedOut:true,providerCleanupPending:true}}],'protected');await h.controller.submit();assert.equal(h.last().phase,'retry');assert.equal(h.navigations.length,0);await h.controller.submit();assert.equal(h.last().phase,'complete');assert.deepEqual(h.navigations,['/admin/login']);assert.ok(h.requests.every(item=>item.path==='/admin/api/logout'&&item.options.headers['x-csrf-token']===csrfToken&&item.options.body==='{}'));
});
test('duplicate submission and pagehide disposal cannot restore or navigate a closed page',async()=>{
 let finish;const states=[],navigations=[];let calls=0;
 const controller=client.createSessionController({mode:'protected',csrfToken,view:{render:value=>states.push(value)},onNavigate:path=>navigations.push(path),fetchImpl:async()=>{calls++;return new Promise(resolve=>finish=resolve);}});controller.start();const pending=controller.submit();await controller.submit();assert.equal(calls,1);controller.dispose();finish(new Response(JSON.stringify({signedOut:true,providerCleanupPending:false})));await pending;assert.equal(states.at(-1).phase,'closed');assert.equal(navigations.length,0);
});
test('protected HTML is never served anonymously and all destinations are fixed same-origin routes',async()=>{
 const h=sessionFixture(),handler=screen.createSessionBrowserHandler(h.config,{service:h.service});
 const denied=await handler(new Request(h.config.origin+'/admin/'));assert.equal(denied.status,303);assert.equal(denied.headers.get('location'),'/admin/login');assert.match(denied.headers.get('cache-control'),/no-store/);
 const login=await handler(new Request(h.config.origin+'/admin/login'));assert.equal(login.status,200);const loginHtml=await login.text();assert.ok(loginHtml.includes('autocomplete="current-password"'));assert.match(loginHtml,/<form[^>]+method="post"[^>]+action="\/admin\/api\/login"/);
 assert.equal((await handler(new Request(h.config.origin+'/admin/login?next=https://attacker.test'))).status,400);
 const result=await h.service.login({email:user.email,password}),request=new Request(h.config.origin+'/admin/',{headers:{cookie:result.cookie}}),page=await handler(request);assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes(user.email));assert.ok(!html.includes('MOCK_PRIVATE'));assert.ok(!html.includes('MOCK_SIGNATURE'));assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 h.setActive(false);assert.equal((await handler(request)).status,303);
});
test('authenticated login redirects to protected page while verification outages show private unavailability',async()=>{
 const h=sessionFixture(),handler=screen.createSessionBrowserHandler(h.config,{service:h.service}),result=await h.service.login({email:user.email,password});const headers={cookie:result.cookie};
 const response=await handler(new Request(h.config.origin+'/admin/login',{headers}));assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/admin/');h.provider.getUser=async()=>{throw new Error('MOCK_PRIVATE');};const failed=await handler(new Request(h.config.origin+'/admin/',{headers}));assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('MOCK_PRIVATE'));
});
test('asset allowlist and origin/method checks reject unknown paths and identity markup is escaped',async()=>{
 const h=sessionFixture(),handler=screen.createSessionBrowserHandler(h.config,{service:{authenticate:async()=>({user:{email:'<img src=x onerror=alert(1)>'},csrfToken:newToken(),accessToken:'MOCK_PRIVATE'})},assets:new Map([['/admin/session/client.mjs',{body:'export {};',type:'text/javascript'}]])});
 const page=await handler(new Request(h.config.origin+'/admin/')),html=await page.text();assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('MOCK_PRIVATE'));
 assert.equal((await handler(new Request(h.config.origin+'/admin/session/client.mjs'))).status,200);
 for(const path of ['/.env.admin','/admin/session/unknown.js'])assert.equal((await handler(new Request(h.config.origin+path))).status,404);
 assert.equal((await handler(new Request('https://attacker.test/admin/login'))).status,403);assert.equal((await handler(new Request(h.config.origin+'/admin/login',{method:'POST'}))).status,405);
});
test('inline bootstrap scrubs a closed document before delayed or failed imports and reloads restored pages',async()=>{
 const h=sessionFixture(),handler=screen.createSessionBrowserHandler(h.config,{service:h.service}),html=await (await handler(new Request(h.config.origin+'/admin/login'))).text(),script=html.match(/<script nonce="[^"]+">([\s\S]+?)<\/script>/)[1];
 for(const failed of [false,true]){
  let resolveImport,rejectImport,ready,mounted=false,reloads=0,removed=false;const events={},nodes={email:{value:'owner@example.test'},password:{value:password,type:'text'},'session-identity':{textContent:user.email},'session-form':{hidden:false}};
  const context={window:{addEventListener:(name,callback)=>{events[name]=callback;}},location:{reload:()=>reloads++},document:{readyState:'loading',addEventListener:(name,callback)=>{ready=callback;},getElementById:id=>nodes[id]||null,querySelector:()=>({remove:()=>{removed=true;}})},load:()=>new Promise((resolve,reject)=>{resolveImport=resolve;rejectImport=reject;})};
  vm.runInNewContext(script.replace('import(', 'load('),context);assert.equal(typeof events.pagehide,'function');events.pagehide();assert.equal(nodes.password.value,'');assert.equal(nodes.email.value,'');assert.equal(nodes['session-identity'].textContent,'');assert.equal(nodes['session-form'].hidden,true);assert.equal(removed,true);
  failed?rejectImport(new Error('MOCK_DELAYED_LOAD')):resolveImport({mountSession:()=>{mounted=true;}});await new Promise(resolve=>setImmediate(resolve));ready?.();await new Promise(resolve=>setImmediate(resolve));assert.equal(mounted,false);events.pageshow({persisted:true});assert.equal(reloads,1);
 }
});
