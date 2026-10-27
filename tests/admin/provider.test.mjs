import test from 'node:test';import assert from 'node:assert/strict';
import {createHostedAuthProvider} from '../../server/auth/provider.mjs';
const config={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'sb_publishable_test',secretKey:'sb_secret_test'};
test('provider works with Workers redirect modes and refuses redirect responses without forwarding credentials',async()=>{
 let calls=0;
 const provider=createHostedAuthProvider(config,{fetchImpl:async(_url,options)=>{
  if(!['manual','follow'].includes(options.redirect))throw new TypeError('Invalid redirect value');
  calls++;assert.equal(options.redirect,'manual');
  return calls===1?Response.json({id:'fixture'}):new Response(null,{status:307,headers:{Location:'https://other.example.test/steal'}});
 }});
 assert.deepEqual(await provider.rpc('farm_invitation_read',{}),{id:'fixture'});
 await assert.rejects(provider.rpc('farm_invitation_read',{}),error=>error.status===307);
 assert.equal(calls,2);
});
test('provider failure metadata distinguishes HTTP responses from transport exceptions without raw detail',async()=>{
 for(const [fetchImpl,kind] of [
  [async()=>new Response('PRIVATE detail',{status:503}),'http'],
  [async()=>{throw new TypeError('PRIVATE network detail');},'transport']
 ]){
  await assert.rejects(createHostedAuthProvider(config,{fetchImpl}).rpc('farm_invitation_read',{}),error=>error.failureKind===kind&&error.status===503&&!JSON.stringify(error).includes('PRIVATE'));
 }
});
test('transport diagnostics classify fixed runtime failures without retaining provider text',async()=>{
 const provider=createHostedAuthProvider(config,{fetchImpl:async()=>{throw new TypeError('Failed to fetch PRIVATE details');}});
 await assert.rejects(provider.rpc('farm_invitation_read',{}),error=>error.transportReason==='fetch_failed'&&!JSON.stringify(error).includes('PRIVATE'));
});
test('provider uses server secret only for RPC and public key plus verified user JWT for user calls',async()=>{
 const calls=[],provider=createHostedAuthProvider(config,{fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({ok:true}));}});
 await provider.signIn('owner@example.test','private-password');await provider.getUser('user-jwt');await provider.refresh('private-refresh');await provider.signOut('user-jwt');await provider.rpc('farm_session_read',{p_cookie_hash:'hash'});
 assert.equal(calls[0].options.headers.apikey,config.publishableKey);assert.ok(!calls[0].options.headers.Authorization);
 assert.equal(calls[1].options.headers.Authorization,'Bearer user-jwt');assert.equal(calls[4].options.headers.apikey,config.secretKey);assert.ok(!calls[4].options.headers.Authorization);
 assert.equal(new URL(calls[3].url).searchParams.get('scope'),'local');
 for(const {url,options}of calls){assert.equal(options.redirect,'manual');assert.ok(!url.includes('private-password'));assert.ok(!url.includes('private-refresh'));assert.ok(!url.includes('sb_secret'));}
});
test('provider rejects arbitrary RPC names and redacts network, HTTP and malformed responses',async()=>{
 let calls=0;const provider=createHostedAuthProvider(config,{fetchImpl:async()=>{calls++;return new Response('SECRET PROVIDER RESPONSE',{status:401});}});
 await assert.rejects(()=>provider.rpc('../admin/users',{}));assert.equal(calls,0);
 await assert.rejects(()=>provider.signIn('email','secret'),e=>e.status===401&&!e.message.includes('SECRET'));
 for(const fetchImpl of [async()=>{throw new Error('private detail');},async()=>new Response('not json')]){
  await assert.rejects(()=>createHostedAuthProvider(config,{fetchImpl}).getUser('token'),e=>e.status===503&&!e.message.includes('private detail'));
 }
});
test('legacy service JWT is a bearer only on the selected server-side project',async()=>{
 let headers;await createHostedAuthProvider({...config,secretKey:'eyJ.legacy.token'},{fetchImpl:async(url,options)=>{headers=options.headers;return new Response('null');}}).rpc('farm_session_read',{});
 assert.equal(headers.Authorization,'Bearer eyJ.legacy.token');
});
test('content RPCs use the session user JWT and publishable key, never the service secret',async()=>{
 let call;const provider=createHostedAuthProvider(config,{fetchImpl:async(url,options)=>{call={url,options};return new Response(JSON.stringify({saved:true}));}});
 await provider.userRpc('farm_content_save',{p_id:null},'SESSION_USER_JWT');
 assert.equal(new URL(call.url).pathname,'/rest/v1/rpc/farm_content_save');assert.equal(call.options.headers.apikey,config.publishableKey);assert.equal(call.options.headers.Authorization,'Bearer SESSION_USER_JWT');
 await assert.rejects(()=>provider.userRpc('not_a_farm_command',{},'SESSION_USER_JWT'));
});
test('provider password recovery link uses the fixed acceptance origin and recovery verification type',async()=>{
 const calls=[],provider=createHostedAuthProvider({...config,origin:'https://admin.example.test'},{fetchImpl:async(url,options)=>{calls.push({url,options});return calls.length===1?new Response(JSON.stringify({verification_type:'recovery',id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test',hashed_token:'hashed-token'})):new Response(JSON.stringify({access_token:'access',refresh_token:'refresh'}));}});
 const recovery=await provider.generateRecovery('owner@example.test');assert.equal(recovery.user.email,'owner@example.test');assert.equal(recovery.tokenHash,'hashed-token');
 await provider.verifyRecovery(recovery.tokenHash);
 assert.equal(JSON.parse(calls[0].options.body).type,'recovery');assert.equal(JSON.parse(calls[0].options.body).email,'owner@example.test');assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'),'https://admin.example.test/admin/accept');
 assert.deepEqual(JSON.parse(calls[1].options.body),{type:'recovery',token_hash:'hashed-token'});
});
