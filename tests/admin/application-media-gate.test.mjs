import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminApplication} from '../../server/application.mjs';

test('private media routes and editor picker stay closed without an Images service binding',async()=>{
 const config={origin:'https://farm.test',environment:'hosted-development',secureCookies:true,accountLifecycleEnabled:false,privateMediaEnabled:true,idleSeconds:1800,absoluteSeconds:43200,sessionKey:'ab'.repeat(32),projectRef:'abcdefghijklmnopqrst',supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'dummy-public',secretKey:'dummy-secret'};
 const actor={cookieHash:'a'.repeat(43),csrfToken:'b'.repeat(43),user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'}};
 const app=createAdminApplication(config,{auth:{async authenticate(){return actor;}},provider:{rpc:async()=>null,userRpc:async()=>[]},assets:new Map()});
 const editor=await app(new Request('https://farm.test/admin/content'));assert.equal(editor.status,200);assert.match(await editor.text(),/<meta name="admin-private-media" content="disabled">/);
 const api=await app(new Request('https://farm.test/admin/api/media'));assert.equal(api.status,404);
});
