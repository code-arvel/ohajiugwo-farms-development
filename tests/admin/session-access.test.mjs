import test from 'node:test';import assert from 'node:assert/strict';
import {probeSessionCommandAccess} from '../../server/auth/session-access.mjs';
const config={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'sb_publishable_test',secretKey:'sb_secret_test'};
test('HTTP probe verifies service access and anonymous denial without bootstrap or account creation',async()=>{
 const calls=[];const report=await probeSessionCommandAccess(config,{fetchImpl:async(url,options)=>{calls.push({url,options});return options.headers.apikey===config.secretKey?new Response('null'):new Response('denied',{status:403});}});
 assert.equal(report.serviceCommandVerified,true);assert.equal(report.anonymousCommandDenied,true);
 assert.equal(calls.length,2);for(const call of calls){assert.match(call.url,/\/rpc\/farm_session_read$/);assert.equal(call.options.redirect,'manual');assert.ok(!call.url.includes('sb_secret'));}
 assert.ok(!JSON.stringify(report).includes('sb_secret'));
});
test('anonymous success or an unavailable/missing server command cannot become a passing result',async()=>{
 for(const failure of ['anonymous-success','service-missing','network']){
  await assert.rejects(()=>probeSessionCommandAccess(config,{fetchImpl:async(url,options)=>{
   if(failure==='network')throw new Error('private provider detail');
   if(options.headers.apikey===config.secretKey)return failure==='service-missing'?new Response('secret details',{status:404}):new Response('null');
   return new Response('null');
  }}),e=>!e.message.includes('private provider detail')&&!e.message.includes('secret details'));
 }
});
