import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../../functions/[[path]].js';
import {sessionFixture} from './fixtures/session-http.mjs';
import {fixture} from './fixtures/first-admin.mjs';
import {createFirstAdminService} from '../../server/auth/first-admin.mjs';
const enabled='confirmed-development-only';
const env=origin=>({ADMIN_ENABLE_DEVELOPMENT_ROUTES:enabled,ADMIN_ENVIRONMENT:'hosted-development',ADMIN_ORIGIN:origin,SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_PUBLISHABLE_KEY:'MOCK_PUBLIC',SUPABASE_SECRET_KEY:'MOCK_SECRET',ADMIN_SESSION_KEY:'ab'.repeat(32)});
test('actual Pages entry composes session HTML/API/cookies and shared assets without exposing bootstrap',async()=>{
 const h=sessionFixture(),vars=env(h.config.origin),assets=new Map([['/admin/session/client.mjs',{body:'export {};',type:'text/javascript'}]]),deps={auth:h.service,assets,getClientIp:()=> 'trusted-local'};
 const request=(path,options={})=>onRequest({request:new Request(h.config.origin+path,options),env:vars},deps);
 const page=await request('/admin/login');assert.equal(page.status,200);assert.ok((await page.text()).includes('Sign in.'));
 const context=await request('/admin/api/login'),csrf=await context.json(),cookie=context.headers.get('set-cookie').split(';')[0];
 const login=await request('/admin/api/login',{method:'POST',headers:{cookie,origin:h.config.origin,'content-type':'application/json','x-csrf-token':csrf.csrfToken},body:JSON.stringify({email:'owner@example.test',password:'DummyFarmPass123!'})});assert.equal(login.status,200);assert.equal(login.headers.getSetCookie().length,2);
 const result=await login.json(),sessionCookie=login.headers.getSetCookie().find(value=>value.startsWith('ohajiugwo_admin_local=')).split(';')[0];
 const privatePage=await request('/admin/',{headers:{cookie:sessionCookie}});assert.equal(privatePage.status,200);assert.ok((await privatePage.text()).includes('owner@example.test'));assert.match(privatePage.headers.get('cache-control'),/no-store/);
 assert.equal((await request('/admin/session/client.mjs')).status,200);assert.equal((await request('/admin/setup')).status,404);assert.equal((await request('/__editor/')).status,404);
 const logout=await request('/admin/api/logout',{method:'POST',headers:{cookie:sessionCookie,origin:h.config.origin,'content-type':'application/json','x-csrf-token':result.csrfToken},body:'{}'});assert.equal(logout.status,200);assert.equal((await request('/admin/api/session',{headers:{cookie:sessionCookie}})).status,401);
});
test('default/invalid runtime configuration remains closed even when an injected service exists',async()=>{
 for(const vars of [{},{ADMIN_ENABLE_DEVELOPMENT_ROUTES:enabled},{...env('http://127.0.0.1:4322'),ADMIN_ENABLE_DEVELOPMENT_ROUTES:'true'}])assert.equal((await onRequest({request:new Request('http://127.0.0.1:4322/admin/login'),env:vars})).status,503);
});

test('equal-admin screen and mutation APIs remain closed unless separately enabled, then require recent CSRF-bound sessions',async()=>{
 const h=sessionFixture(),actor={user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'},csrfToken:'c'.repeat(43)};Object.defineProperty(actor,'cookieHash',{value:'d'.repeat(43)});
 const auth={async authenticate(_request,options={}){if(options.requireRecent)assert.equal(options.requireRecent,true);if(options.requireMutation)assert.equal(options.requireMutation,true);return actor;}},calls=[];
 const assets=new Map([['/admin/accounts/client.mjs',{body:'export {};',type:'text/javascript'}],['/admin/accounts/screen.css',{body:'/* fixture */',type:'text/css'}]]);
 const request=(gate,path,options={})=>onRequest({request:new Request(h.config.origin+path,options),env:{...env(h.config.origin),...(gate?{ADMIN_ENABLE_ACCOUNT_LIFECYCLE:enabled}:{})}},{auth,provider:h.provider,rpc:async(name,p)=>{calls.push([name,p]);if(name==='farm_admin_list')return{admins:[{id:actor.user.id,email:actor.user.email,createdAt:new Date().toISOString()}],invitations:[],passwordResets:[]};return true;},assets});
 assert.equal((await request(false,'/admin/accounts')).status,404);assert.equal((await request(false,'/admin/api/accounts')).status,404);
 const page=await request(true,'/admin/accounts',{headers:{cookie:'admin=session'}});assert.equal(page.status,200);const html=await page.text();assert.match(html,/Administrator access/);assert.match(html,/name="admin-invitation-issue" content="disabled"/);assert.match(html,/Provider invitation issue remains disabled/);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const list=await request(true,'/admin/api/accounts');assert.equal(list.status,200);assert.equal((await list.json()).admins.length,1);
 const response=await request(true,'/admin/api/accounts/22222222-2222-4222-8222-222222222222/revoke',{method:'POST',headers:{cookie:'admin=session',origin:h.config.origin,'content-type':'application/json','x-csrf-token':'c'.repeat(43)},body:'{}'});assert.equal(response.status,200);assert.deepEqual(calls.map(([name])=>name),['farm_admin_list','farm_admin_revoke']);assert.equal(calls[1][1].p_actor_cookie_hash,'d'.repeat(43));
});

test('actual Pages entry routes callback/acceptance to one-use first-admin service, without GET consumption or implicit sign-in',async()=>{
 const h=fixture(),firstAdmin=createFirstAdminService(h.config,{provider:h.provider,rpc:h.rpc,now:h.clock}),auth=sessionFixture().service;
 const pending=await firstAdmin.prepare('owner@example.test');await firstAdmin.issue(pending.id);
 const request=(path,options={})=>onRequest({request:new Request(h.config.origin+path,options),env:env(h.config.origin)},{auth,firstAdmin,assets:new Map(),getClientIp:()=> 'trusted-local'});
 const callback=await request('/admin/callback');assert.equal(callback.status,200);assert.match(await callback.text(),/Set your password/);assert.ok(!h.calls.includes('verifyInvite'));
 const context=await request('/admin/accept',{headers:{accept:'application/json'}}),{csrfToken}=await context.json(),cookie=context.headers.get('set-cookie').split(';')[0],input=await h.inputs();
 const post=()=>request('/admin/accept',{method:'POST',headers:{cookie,origin:h.config.origin,'content-type':'application/json','x-csrf-token':csrfToken},body:JSON.stringify(input)});
 const accepted=await post();assert.equal(accepted.status,200);assert.equal(h.active,1);assert.deepEqual(await accepted.json(),{activated:true,signInRequired:true,providerCleanupPending:false});
 assert.ok(!accepted.headers.getSetCookie().some(value=>value.startsWith('ohajiugwo_admin_local=')));
 assert.notEqual((await post()).status,200);assert.equal((await request('/admin/')).status,303);
 assert.equal((await request('/admin/setup',{method:'POST'})).status,404);
});

test('actual Pages entry exposes draft content API only through the composed private route and user JWT',async()=>{
 const origin='http://127.0.0.1:4322',actor={user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'},csrfToken:'a'.repeat(43)};Object.defineProperty(actor,'accessToken',{value:'PRIVATE_USER_JWT'});
 const auth={authenticate:async(_request,options)=>{if(options.requireMutation)assert.equal(options.requireMutation,true);return actor;}},calls=[];
 const provider={userRpc:async(name,params,token)=>{calls.push([name,params,token]);if(name==='farm_content_list')return[];if(name==='farm_content_save')return{id:'22222222-2222-4222-8222-222222222222',kind:params.p_kind,revision:1,payload:params.p_payload,updated_at:new Date().toISOString(),deleted_at:null};return null;},rpc:async()=>null,signIn:async()=>{},getUser:async()=>{}};
 const request=(path,options={})=>onRequest({request:new Request(origin+path,options),env:env(origin)},{auth,provider});
 assert.equal((await request('/admin/api/content')).status,200);
 const payload={slug:'first-note',title:'First note',excerpt:'A short introduction.',publishedAt:'',cover:'planting',status:'draft',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Private draft.'}]}]}};
 const response=await request('/admin/api/content',{method:'POST',headers:{origin,'content-type':'application/json','x-csrf-token':'a'.repeat(43)},body:JSON.stringify({id:null,kind:'post',baseRevision:null,payload})});
 assert.equal(response.status,200);assert.equal(calls[0][0],'farm_content_list');assert.equal(calls[0][2],'PRIVATE_USER_JWT');assert.equal(calls[1][0],'farm_content_save');assert.equal(calls[1][2],'PRIVATE_USER_JWT');
 assert.equal((await request('/admin/api/content')).status,200);assert.equal((await request('/admin/api/content')).headers.get('cache-control').includes('no-store'),true);
});
