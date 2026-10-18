import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createFirstAdminService} from '../../server/auth/first-admin.mjs';
import {fixture} from './fixtures/first-admin.mjs';
const module=await import('../../server/auth/first-admin-screen.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('screen bootstrap clears fragment/query before importing client and never exposes link values globally',async()=>{
 const h=fixture(),service=createFirstAdminService(h.config,{provider:h.provider,rpc:h.rpc});
 const handler=module.createFirstAdminBrowserHandler(h.config,{service,assets:new Map()});
 const response=await handler(new Request(h.config.origin+'/admin/callback'));
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);assert.match(response.headers.get('cache-control'),/no-store/);
 const html=await response.text(),script=html.match(/<script nonce="([^"]+)">([\s\S]+?)<\/script>/);
 assert.ok(script);assert.ok(response.headers.get('content-security-policy').includes(`'nonce-${script[1]}'`));
 // Execute the real inline bootstrap with only its module import substituted by a controlled sink.
 const events=[],secret='#id=PRIVATE',context={location:{hash:secret,search:'?bad=PRIVATE'},history:{replaceState:(state,title,url)=>events.push(['clear',url])},document:{getElementById:()=>({textContent:''})},load:async path=>{events.push(['import',path]);return {mountAcceptance:input=>events.push(['mount',input])};}};
 vm.runInNewContext(script[2].replace('import(', 'load('),context);await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(events[0],['clear','/admin/accept']);assert.equal(events[1][0],'import');assert.equal(events[2][1].fragment,secret);assert.equal(events[2][1].hadQuery,true);
 assert.ok(!Object.keys(context).some(x=>/invitation|fragment|nonce|token/i.test(x)));
 assert.ok(!html.includes('PRIVATE'));assert.ok(html.includes('autocomplete="new-password"'));assert.ok(html.includes('aria-live="polite"'));
});
test('callback never verifies tokens; assets are exact same-origin allowlist and private',async()=>{
 const h=fixture(),handler=module.createFirstAdminBrowserHandler(h.config,{service:createFirstAdminService(h.config,{provider:h.provider,rpc:h.rpc}),assets:new Map([['/admin/accept/client.mjs',{body:'export const fixture=true;',type:'text/javascript'}]])});
 const html=await handler(new Request(h.config.origin+'/admin/callback?access_token=PRIVATE'));assert.equal(html.status,400);assert.ok(!(await html.text()).includes('PRIVATE'));assert.ok(!h.calls.includes('verifyInvite'));
 const asset=await handler(new Request(h.config.origin+'/admin/accept/client.mjs'));assert.equal(asset.status,200);assert.match(asset.headers.get('cache-control'),/no-store/);
 assert.equal((await handler(new Request('https://attacker.test/admin/accept/client.mjs'))).status,403);
 for(const path of ['/admin/setup','/admin/accept/../../.env.admin','/admin/accept/unknown.js'])assert.equal((await handler(new Request(h.config.origin+path))).status,404);
});
test('cached client import waits for parsed form elements before mounting',async()=>{
 const h=fixture(),handler=module.createFirstAdminBrowserHandler(h.config,{service:createFirstAdminService(h.config,{provider:h.provider,rpc:h.rpc})});
 const html=await (await handler(new Request(h.config.origin+'/admin/accept'))).text(),script=html.match(/<script nonce="[^"]+">([\s\S]+?)<\/script>/)[1];
 let ready,mounted=false;
 vm.runInNewContext(script.replace('import(', 'load('),{location:{hash:'#fixture',search:''},history:{replaceState(){}},document:{readyState:'loading',addEventListener:(name,callback)=>{assert.equal(name,'DOMContentLoaded');ready=callback;},getElementById:()=>({textContent:''})},load:async()=>({mountAcceptance:()=>mounted=true})});
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(mounted,false);assert.equal(typeof ready,'function');ready();
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(mounted,true);
});
