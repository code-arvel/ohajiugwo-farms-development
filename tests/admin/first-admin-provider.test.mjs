import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedAuthProvider} from '../../server/auth/provider.mjs';
const config={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',origin:'http://127.0.0.1:4322',secretKey:'sb_secret_fixture',publishableKey:'sb_publishable_fixture'};
test('first-admin provider methods use generated invite tokens and recipient-scoped password updates',async()=>{
 const calls=[];
 const provider=createHostedAuthProvider(config,{fetchImpl:async(url,options)=>{
  calls.push({url,options});
  return new Response(JSON.stringify(url.includes('/admin/generate_link')?{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test',hashed_token:'a'.repeat(64),verification_type:'invite',action_link:'NEVER OUTPUT THIS'}:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'}));
 }});
 assert.equal(typeof provider.generateInvite,'function');
 const generated=await provider.generateInvite('owner@example.test');
 assert.equal(generated.tokenHash,'a'.repeat(64));assert.equal(generated.user.email,'owner@example.test');
 assert.ok(!JSON.stringify(generated).includes('NEVER OUTPUT'));
 await provider.verifyInvite('a'.repeat(64));await provider.updatePassword('recipient-token','private password');
 assert.deepEqual(JSON.parse(calls[0].options.body),{type:'invite',email:'owner@example.test'});
 assert.equal(calls[0].options.headers.apikey,config.secretKey);
 assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'),config.origin+'/admin/accept');
 assert.deepEqual(JSON.parse(calls[1].options.body),{type:'invite',token_hash:'a'.repeat(64)});
 assert.equal(calls[1].options.headers.apikey,config.publishableKey);
 assert.equal(calls[2].options.method,'PUT');assert.equal(calls[2].options.headers.Authorization,'Bearer recipient-token');
 assert.equal(calls[2].options.headers.apikey,config.publishableKey);
 for(const {url,options} of calls){assert.equal(options.redirect,'error');assert.ok(!url.includes('private password'));assert.ok(!url.includes('recipient-token'));}
});
test('built-in sender invitation sends a fixed app redirect and never exposes action links',async()=>{
 let call;const provider=createHostedAuthProvider(config,{fetchImpl:async(url,options)=>{call={url,options};return new Response(JSON.stringify({id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test',action_link:'PRIVATE_ACTION_LINK'}));}});
 const redirect=config.origin+'/admin/accept#id=11111111-1111-4111-8111-111111111111&nonce='+('a'.repeat(43));
 const result=await provider.inviteUserByEmail('owner@example.test',redirect);
 assert.deepEqual(result,{user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'}});
 assert.equal(new URL(call.url).pathname,'/auth/v1/invite');assert.equal(new URL(call.url).searchParams.get('redirect_to'),redirect);
 assert.deepEqual(JSON.parse(call.options.body),{email:'owner@example.test'});assert.equal(call.options.headers.apikey,config.secretKey);
 assert.ok(!JSON.stringify(result).includes('PRIVATE_ACTION_LINK'));assert.ok(!JSON.stringify(call).includes('PRIVATE_ACTION_LINK'));
});
