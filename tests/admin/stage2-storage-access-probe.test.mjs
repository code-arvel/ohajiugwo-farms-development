import test from 'node:test';
import assert from 'node:assert/strict';
import {probePrivateStorageAccess} from '../../server/stage2/storage-access-probe.mjs';

const config={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'sb_publishable_MOCK',secretKey:'sb_secret_MOCK'};
const ok=body=>new Response(body,{status:200});

test('private Storage probe creates, verifies, anonymously denies, and removes one unique object',async()=>{
 const calls=[];let exists=false;const report=await probePrivateStorageAccess(config,{uuid:()=> '12345678-1234-4123-8123-123456789abc',fetchImpl:async(url,options)=>{
  calls.push({url,options,method:options.method||'GET'});
  if(options.method==='POST'){exists=true;return ok('{}');}
  if(options.method==='DELETE'){exists=false;return ok('{}');}
  if(options.headers.apikey===config.publishableKey)return new Response('{}',{status:403});
  return exists?ok('ohajiugwo-private-storage-probe'):new Response('{}',{status:404});
 }});
 assert.deepEqual(report,{privateBucketAnonymousReadDenied:true,temporaryObjectDeleted:true,accountCreated:false,authProviderCalled:false,emailSent:false,scope:'Anonymous direct-object read denial only; authenticated non-member access, application preview, Images binding and concurrent Storage behavior remain unverified.'});
 assert.equal(calls.length,5);assert.deepEqual(calls.map(call=>call.method),['POST','GET','GET','DELETE','GET']);
 assert.match(calls[0].url,/staging\/12345678-1234-4123-8123-123456789abc\/source$/);assert.ok(!calls.some(call=>call.url.includes('sb_secret')));
 assert.equal(calls[1].options.headers.apikey,config.secretKey);assert.equal(calls[2].options.headers.apikey,config.publishableKey);assert.equal(calls[3].options.headers.apikey,config.secretKey);
 assert.ok(!JSON.stringify(report).includes('sb_secret'));
});

test('unexpected anonymous access fails but still deletes the temporary object',async()=>{
 const calls=[];let exists=false;await assert.rejects(()=>probePrivateStorageAccess(config,{uuid:()=> '12345678-1234-4123-8123-123456789abc',fetchImpl:async(url,options)=>{
  const method=options.method||'GET';calls.push(method);if(method==='POST'){exists=true;return ok('{}');}if(method==='DELETE'){exists=false;return ok('{}');}if(options.headers.apikey===config.publishableKey)return ok('object leaked');return exists?ok('ohajiugwo-private-storage-probe'):new Response('{}',{status:404});
 }}),/Private Storage access boundary was not verified/);
 assert.deepEqual(calls,['POST','GET','GET','DELETE','GET']);
});

test('Storage may mask an existing object behind the NoSuchKey response for an anonymous reader',async()=>{
 let exists=false;const report=await probePrivateStorageAccess(config,{uuid:()=> '12345678-1234-4123-8123-123456789abc',fetchImpl:async(url,options)=>{
  const method=options.method||'GET';if(method==='POST'){exists=true;return ok('{}');}if(method==='DELETE'){exists=false;return ok('{}');}
  if(options.headers.apikey===config.publishableKey)return new Response(JSON.stringify({code:'NoSuchKey'}),{status:400});
  return exists?ok('ohajiugwo-private-storage-probe'):new Response(JSON.stringify({code:'NoSuchKey'}),{status:400});
 }});
 assert.equal(report.privateBucketAnonymousReadDenied,true);assert.equal(report.temporaryObjectDeleted,true);
});

test('cleanup failure reports only the isolated path for owner recovery',async()=>{
 await assert.rejects(()=>probePrivateStorageAccess(config,{uuid:()=> '12345678-1234-4123-8123-123456789abc',fetchImpl:async(url,options)=>{
  if(options.method==='POST'||options.method==='GET')return ok('ohajiugwo-private-storage-probe');return new Response('PRIVATE_PROVIDER_DETAIL',{status:500});
 }}),error=>error.message==='Temporary Storage test object cleanup could not be verified. Remove staging/12345678-1234-4123-8123-123456789abc/source from the farm-photographs bucket.');
});

test('ambiguous upload transport still attempts cleanup of the unique path',async()=>{
 const calls=[];await assert.rejects(()=>probePrivateStorageAccess(config,{uuid:()=> '12345678-1234-4123-8123-123456789abc',fetchImpl:async(url,options)=>{
  const method=options.method||'GET';calls.push(method);if(method==='POST')throw new Error('PRIVATE_TRANSPORT_DETAIL');if(method==='DELETE')return ok('{}');return new Response('{}',{status:404});
 }}),/Private Storage access boundary was not verified/);
 assert.deepEqual(calls,['POST','DELETE','GET']);
});
