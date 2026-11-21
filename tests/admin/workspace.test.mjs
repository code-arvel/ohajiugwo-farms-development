import test from 'node:test';import assert from 'node:assert/strict';
import {createAdminApplication} from '../../server/application.mjs';
import {browserAssetFiles} from '../../server/browser-assets.mjs';
const config={origin:'https://farm.test',environment:'hosted-development',sessionKey:'ab'.repeat(32),privateMediaEnabled:false,accountLifecycleEnabled:false};
const actor={user:{id:'11111111-1111-4111-8111-111111111111',email:'owner<script>@example.test'},csrfToken:'c'.repeat(43)};
const app=auth=>createAdminApplication(config,{auth,provider:{rpc:async()=>null,userRpc:async()=>[]},assets:new Map([['/admin/workspace/screen.css',{body:'/* workspace */',type:'text/css'}]])});
test('overview replaces placeholder with protected real-data workspace, escaped identity and capability-aware links',async()=>{
 const handler=app({authenticate:async()=>actor}),response=await handler(new Request(config.origin+'/admin/')),html=await response.text();
 assert.equal(response.status,200);assert.match(html,/Make room for good work/);assert.match(html,/owner&lt;script&gt;@example.test/);assert.doesNotMatch(html,/Administration is being prepared/);assert.match(html,/content#company/);assert.doesNotMatch(html,/href="\/admin\/(?:media|accounts)"/);assert.match(html,/id="session-form"/);assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.doesNotMatch(html,/Caring for living soil|Sample workspace/);
});
test('overview and shared assets reject invalid origins/methods; unauthenticated overview redirects',async()=>{
 const handler=app({authenticate:async()=>{throw Object.assign(Error(),{status:401});}});
 assert.equal((await handler(new Request(config.origin+'/admin/'))).status,303);
 assert.equal((await handler(new Request(config.origin+'/admin/',{headers:{origin:'https://evil.test'}}))).status,403);
 assert.equal((await handler(new Request(config.origin+'/admin/workspace/screen.css'))).status,200);
 assert.equal((await handler(new Request(config.origin+'/admin/workspace/screen.css',{method:'POST'}))).status,405);
 assert.equal((await handler(new Request(config.origin+'/admin/workspace/screen.css',{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
 assert.equal((await handler(new Request(config.origin+'/admin/workspace/missing.mjs'))).status,404);
 assert.ok(browserAssetFiles.some(([route])=>route==='/admin/workspace/overview.mjs'));
});
test('overview controller distinguishes failure from empty data, and ignores closed/outdated responses',async()=>{
 const {createOverviewController}=await import('../../admin/workspace/overview.mjs');
 const states=[];let resolve;
 const controller=createOverviewController({render:state=>states.push(state),fetchImpl:async()=>new Promise(done=>resolve=done)});
 const pending=controller.load();controller.dispose();resolve(new Response('[]'));await pending;assert.equal(states.at(-1).phase,'closed');
 const failed=createOverviewController({render:state=>states.push(state),fetchImpl:async()=>new Response('PRIVATE_ERROR',{status:503})});await failed.load();assert.equal(states.at(-1).phase,'error');assert.ok(!JSON.stringify(states).includes('PRIVATE_ERROR'));
 const empty=createOverviewController({render:state=>states.push(state),fetchImpl:async()=>new Response('[]')});await empty.load();assert.equal(states.at(-1).phase,'empty');
});
