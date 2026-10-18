import test from 'node:test';
import assert from 'node:assert/strict';
import {probeStage2CommandAccess} from '../../server/stage2/access-probe.mjs';

const config={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'sb_publishable_MOCK',secretKey:'sb_secret_MOCK'};
const denied=()=>new Response(JSON.stringify({code:'42501',message:'permission denied for function'}),{status:403});

test('Stage 2 access probe uses only fail-closed inputs and reports service/anonymous boundaries',async()=>{
 const calls=[];
 const report=await probeStage2CommandAccess(config,{fetchImpl:async(url,options)=>{
  calls.push({url,options});
  if(options.headers.apikey===config.publishableKey)return denied();
  const name=url.split('/').at(-1);
  if(name==='farm_content_list')return denied();
  if(name==='farm_cleanup_claim'||name==='farm_media_cleanup_claim')return new Response(JSON.stringify({code:'P0001',message:name==='farm_cleanup_claim'?'Invalid cleanup batch.':'Invalid media cleanup batch.'}),{status:400});
  if(name==='farm_admin_list')return new Response(JSON.stringify({code:'42501',message:'Recent administrator confirmation required.'}),{status:401});
  if(name==='farm_media_reserve')return new Response(JSON.stringify({code:'42501',message:'Active administrator session required.'}),{status:401});
  throw new Error('unexpected request');
 }});
 assert.deepEqual(report,{serviceOnlyCommandsVerified:4,authenticatedOnlyCommandDeniedToServiceRole:true,anonymousCommandsDenied:5,persistedFixturesCreated:false,authProviderCalled:false,emailSent:false,scope:'Authorization/invalid-input HTTP checks only; no authenticated member/non-member, Storage object, provider, concurrency or email flow was exercised.'});
 assert.equal(calls.length,10);
 for(const call of calls){
  assert.equal(call.options.method,'POST');assert.equal(call.options.redirect,'error');assert.match(call.url,/\/rest\/v1\/rpc\/farm_/);assert.ok(!call.url.includes('sb_secret'));
  const body=JSON.parse(call.options.body);assert.ok(Object.keys(body).every(key=>key.startsWith('p_')));
 }
 for(const call of calls.filter(call=>call.options.headers.apikey===config.publishableKey))assert.ok(JSON.stringify(JSON.parse(call.options.body)).length>0);
 assert.ok(!JSON.stringify(report).includes('sb_secret'));
});

test('probe fails closed on unexpected access, validation, missing routes and transport failures with details redacted',async()=>{
 for(const mode of ['anon-allowed','service-allowed','wrong-message','missing','network'])await assert.rejects(()=>probeStage2CommandAccess(config,{fetchImpl:async(url,options)=>{
  if(mode==='network')throw new Error('PRIVATE_TRANSPORT_DETAIL');
  if(options.headers.apikey===config.publishableKey)return mode==='anon-allowed'?new Response('null'):denied();
  const name=url.split('/').at(-1);
  if(mode==='missing')return new Response(JSON.stringify({code:'PGRST202'}),{status:404});
  if(mode==='service-allowed')return new Response('null');
  if(mode==='wrong-message'&&name==='farm_cleanup_claim')return new Response(JSON.stringify({code:'P0001',message:'PRIVATE_DATABASE_DETAIL'}),{status:400});
  if(name==='farm_content_list')return denied();
  if(name==='farm_cleanup_claim'||name==='farm_media_cleanup_claim')return new Response(JSON.stringify({code:'P0001',message:name==='farm_cleanup_claim'?'Invalid cleanup batch.':'Invalid media cleanup batch.'}),{status:400});
  if(name==='farm_admin_list')return new Response(JSON.stringify({code:'42501',message:'Recent administrator confirmation required.'}),{status:401});
  return new Response(JSON.stringify({code:'42501',message:'Active administrator session required.'}),{status:401});
 }}),error=>!error.message.includes('PRIVATE_'));
});
