import test from 'node:test';import assert from 'node:assert/strict';
import {createContentScreenHandler} from '../../server/content/content-screen.mjs';
const config={origin:'https://farm.example.test',secureCookies:true};const user={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'},actor={user,csrfToken:'a'.repeat(43)};
const auth={authenticate:async()=>actor},service={list:async()=>[],read:async()=>null,history:async()=>[],save:async()=>{},restore:async()=>{},trash:async()=>{}};
test('content screen uses the existing editor styling and requires a live admin session',async()=>{
 const handler=createContentScreenHandler(config,{auth,service,assets:new Map([['/admin/content/editor.css',{body:'/* existing editor */',type:'text/css'}]])});
 const page=await handler(new Request(config.origin+'/admin/content',{headers:{cookie:'session=private'}}));assert.equal(page.status,200);const html=await page.text();assert.match(html,/Writing desk/);assert.match(html,/admin\/content\/editor\.css/);assert.match(html,/name="admin-csrf-token" content="aaaaaaaa/);assert.match(page.headers.get('content-security-policy'),/default-src 'none'/);assert.match(page.headers.get('cache-control'),/no-store/);
 const asset=await handler(new Request(config.origin+'/admin/content/editor.css'));assert.equal(asset.status,200);assert.equal(await asset.text(),'/* existing editor */');
 const denied=createContentScreenHandler(config,{auth:{authenticate:async()=>{const error=Error('expired');error.status=401;throw error;}},service,assets:new Map()});assert.equal((await denied(new Request(config.origin+'/admin/content'))).status,303);
});
