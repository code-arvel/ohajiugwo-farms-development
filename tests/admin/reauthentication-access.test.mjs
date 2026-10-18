import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../../server/auth/reauthentication-access.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const config={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'sb_publishable_MOCK',secretKey:'sb_secret_MOCK'};
const prepared=()=>new Response(JSON.stringify({code:'P0001',message:'Invalid password confirmation input.'}),{status:400});
test('new 004 HTTP probe uses guaranteed-invalid/null inputs, verifies each service/anonymous boundary and emits safe scope only',async()=>{
 const calls=[],report=await module.probeReauthenticationAccess(config,{fetchImpl:async(url,options)=>{calls.push({url,options});return options.headers.apikey===config.publishableKey?new Response(JSON.stringify({code:'42501'}),{status:403}):url.endsWith('_prepare')?prepared():new Response('null');}});
 assert.equal(report.serviceCommandsVerified,3);assert.equal(report.anonymousCommandsDenied,3);assert.equal(calls.length,6);for(const call of calls){assert.equal(call.options.redirect,'error');assert.ok(!/auth\/v1/.test(call.url));const input=JSON.parse(call.options.body);assert.ok(Object.values(input).every(value=>value===null));}assert.ok(!JSON.stringify(report).includes('sb_secret'));assert.match(report.scope,/not.*provider/i);
});
test('anonymous success, wrong validation failure, nonnull service results and transport details fail closed with redacted errors',async()=>{
 for(const mode of ['anonymous','invalid-validation','nonnull','network','invalid-anonymous-key'])await assert.rejects(()=>module.probeReauthenticationAccess(config,{fetchImpl:async(url,options)=>{
 if(mode==='network')throw new Error('PRIVATE_NETWORK_DETAIL');if(options.headers.apikey===config.publishableKey&&mode==='invalid-anonymous-key')return new Response(JSON.stringify({code:'INVALID_API_KEY'}),{status:401});if(options.headers.apikey===config.publishableKey)return mode==='anonymous'?new Response('null'):new Response(JSON.stringify({code:'42501'}),{status:403});
 if(url.endsWith('_prepare'))return mode==='invalid-validation'?new Response('PRIVATE_DATABASE_DETAIL',{status:400}):prepared();return new Response(mode==='nonnull'?'{}':'null');
 }}),error=>!error.message.includes('PRIVATE_'));
});
