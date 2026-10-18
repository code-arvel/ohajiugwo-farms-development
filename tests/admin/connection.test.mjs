import test from 'node:test';import assert from 'node:assert/strict';
import {inspectHostedProject} from '../../server/hosted-inspection.mjs';
const config={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'sb_publishable_test',secretKey:'sb_secret_test'};
test('hosted inspection is read-only and returns no credentials, user records or connection details',async()=>{
 const calls=[];const mock=async(url,options)=>{calls.push({url,options});const path=new URL(url).pathname;
 const data=path.endsWith('/settings')?{disable_signup:true,external:{anonymous_users:false},secret:'must-not-return'}:path.endsWith('/users')?{users:[{email:'private@example.test'}]}:path.endsWith('/bucket')?[{id:'farm-photographs',public:false}]:{paths:{'/other_table':{},'/farm_content':{}}};
 return new Response(JSON.stringify(data),{status:200});};
 const report=await inspectHostedProject(config,{fetchImpl:mock});
 assert.equal(report.credentialsVerified,true);assert.equal(report.publicSignupDisabled,true);assert.equal(report.photoBucket,'private');assert.equal(report.editorSchemaPresent,true);
 for(const {options} of calls){assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.ok(!options.body);assert.ok(!options.headers.Authorization);}
 assert.ok(!JSON.stringify(report).includes('private@example'));assert.ok(!JSON.stringify(report).includes('must-not-return'));assert.ok(!JSON.stringify(report).includes('sb_secret'));
});
test('inspection fails safely without printing provider errors containing secrets',async()=>{
 await assert.rejects(()=>inspectHostedProject(config,{fetchImpl:async()=>new Response('sb_secret_sensitive',{status:401})}),e=>e.message==='Hosted project inspection failed at Auth settings (HTTP 401).');
 await assert.rejects(()=>inspectHostedProject(config,{fetchImpl:async()=>{throw new Error('password=private');}}),e=>!e.message.includes('private'));
});
test('unknown Auth settings and absent or public storage are never reported as secured',async()=>{
 const mock=async url=>{const path=new URL(url).pathname;return new Response(JSON.stringify(path.endsWith('/settings')?{}:path.endsWith('/bucket')?[{id:'farm-photographs',public:true}]:{}));};
 const report=await inspectHostedProject(config,{fetchImpl:mock});assert.equal(report.publicSignupDisabled,null);assert.equal(report.anonymousSigninDisabled,null);assert.equal(report.photoBucket,'PUBLIC — must be corrected');assert.equal(report.editorSchemaPresent,false);
});
