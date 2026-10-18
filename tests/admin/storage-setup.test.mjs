import test from 'node:test';import assert from 'node:assert/strict';
import {configurePhotoBucket} from '../../server/storage-setup.mjs';
const config={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',secretKey:'sb_secret_test'};
const bucket={id:'farm-photographs',public:false,file_size_limit:10485760,allowed_mime_types:['image/jpeg','image/png','image/webp']};
test('creates only the agreed private bucket through Storage API after schema is present',async()=>{
 const calls=[];const fetchImpl=async(url,options)=>{calls.push({url,options});const path=new URL(url).pathname;
 return new Response(JSON.stringify(path==='/rest/v1/'?{paths:{'/farm_content':{}}}:options.method==='POST'?{name:bucket.id}:path==='/storage/v1/bucket'?[]:bucket));};
 const report=await configurePhotoBucket(config,{fetchImpl});assert.equal(report.status,'created and verified');
 const writes=calls.filter(c=>c.options.method==='POST');assert.equal(writes.length,1);assert.deepEqual(JSON.parse(writes[0].options.body),{...bucket,name:'farm-photographs'});
 for(const c of calls)assert.equal(c.options.redirect,'error');assert.ok(!JSON.stringify(report).includes('sb_secret'));
});
test('existing exact private configuration is preserved without writes; unsafe configuration stops',async()=>{
 for(const existing of [bucket,{...bucket,public:true},{...bucket,file_size_limit:9999}]){
 let writes=0;const fetchImpl=async(url,options)=>{if(options.method!=='GET')writes++;return new Response(JSON.stringify(new URL(url).pathname==='/rest/v1/'?{paths:{'/farm_content':{}}}:[existing]));};
 if(existing===bucket)assert.equal((await configurePhotoBucket(config,{fetchImpl})).status,'already configured; unchanged');
 else await assert.rejects(()=>configurePhotoBucket(config,{fetchImpl}));assert.equal(writes,0);
 }
});
test('missing schema, provider failures and failed post-write verification never report success or leak errors',async()=>{
 await assert.rejects(()=>configurePhotoBucket(config,{fetchImpl:async()=>new Response(JSON.stringify({paths:{}}))}),/Apply and verify/);
 await assert.rejects(()=>configurePhotoBucket(config,{fetchImpl:async()=>new Response('private-provider-details',{status:401})}),e=>!e.message.includes('private-provider'));
 const fetchImpl=async(url,options)=>new Response(JSON.stringify(new URL(url).pathname==='/rest/v1/'?{paths:{'/farm_content':{}}}:new URL(url).pathname==='/storage/v1/bucket'&&options.method==='GET'?[]:{...bucket,public:true}));
 await assert.rejects(()=>configurePhotoBucket(config,{fetchImpl}),/not verified/);
});
