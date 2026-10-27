import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateStorageProvider} from '../../server/media/storage-provider.mjs';
const config={supabaseUrl:'https://exampleproject1234567890.supabase.co',secretKey:'PRIVATE_SERVICE_KEY'};
test('Storage uses Workers-compatible redirect refusal for private requests',async()=>{
 let calls=0;
 const storage=createPrivateStorageProvider(config,{fetchImpl:async(_url,options)=>{
  if(!['manual','follow'].includes(options.redirect))throw new TypeError('Invalid redirect value');
  assert.equal(options.redirect,'manual');calls++;
  return calls===1?new Response(new Uint8Array([1])):new Response(null,{status:307,headers:{Location:'https://other.example.test/steal'}});
 }});
 const path='staging/11111111-1111-4111-8111-111111111111/source';
 assert.deepEqual(await storage.get(path),new Uint8Array([1]));
 await assert.rejects(storage.get(path),error=>error.status===503);
 assert.equal(calls,2);
});
test('private Storage adapter uploads without upsert, downloads privately and deletes only validated farm paths',async()=>{
 const calls=[],storage=createPrivateStorageProvider(config,{fetchImpl:async(url,options)=>{calls.push({url:String(url),options});return new Response(new Uint8Array([1,2,3]),{status:200,headers:{'Content-Type':'image/webp'}});}});
 const source='staging/11111111-1111-4111-8111-111111111111/source';await storage.put(source,new Uint8Array([1,2]),'image/png');
 assert.deepEqual(await storage.get(source),new Uint8Array([1,2,3]));await storage.delete([source]);
 assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.headers['x-upsert'],'false');assert.ok(calls[0].url.includes('/storage/v1/object/farm-photographs/staging/'));
 assert.ok(calls[1].url.includes('/storage/v1/object/authenticated/farm-photographs/'));assert.equal(calls[2].options.method,'DELETE');assert.equal(calls[2].options.headers.Authorization,'Bearer PRIVATE_SERVICE_KEY');assert.deepEqual(JSON.parse(calls[2].options.body),{prefixes:[source]});
});
test('private Storage adapter rejects path traversal and oversized downloads',async()=>{
 let calls=0;const storage=createPrivateStorageProvider(config,{fetchImpl:async()=>{calls++;return new Response(new Uint8Array(1));}});
 await assert.rejects(()=>storage.get('../public/file.webp'));assert.equal(calls,0);
 const large=createPrivateStorageProvider(config,{fetchImpl:async()=>new Response(new Uint8Array(1),{headers:{'content-length':'10485761'}})});
 await assert.rejects(()=>large.get('media/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/preview.webp'));
});
