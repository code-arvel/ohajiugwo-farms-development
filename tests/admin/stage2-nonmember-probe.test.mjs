import test from 'node:test';
import assert from 'node:assert/strict';
import {probeAuthenticatedNonmemberAccess} from '../../server/stage2/nonmember-access-probe.mjs';

const config={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'sb_publishable_MOCK',secretKey:'sb_secret_MOCK'};
const userId='11111111-1111-4111-8111-111111111111';
const token='user-access-token-never-print';

function mockFetch({denyContent=true,denyStorage=true,denyServiceAfterDelete=false}={}){
 const calls=[];let storageExists=false;
 const fetchImpl=async(url,options={})=>{
  calls.push({url:String(url),options});
  const pathname=new URL(url).pathname;
  if(pathname==='/auth/v1/admin/users'&&options.method==='POST'){
   const body=JSON.parse(options.body);assert.equal(body.email_confirm,true);assert.equal(typeof body.email,'string');assert.match(body.email,/^stage2-probe-[0-9a-f-]+@example\.invalid$/);assert.equal(typeof body.password,'string');
   return Response.json({id:userId,email:body.email,email_confirmed_at:'2026-10-18T00:00:00Z'});
  }
  if(pathname==='/auth/v1/token')return Response.json({access_token:token,user:{id:userId,email:JSON.parse(options.body).email,email_confirmed_at:'2026-10-18T00:00:00Z'}});
  if(pathname==='/rest/v1/rpc/farm_content_list')return denyContent?Response.json({code:'42501',message:'Active administrator session required.'},{status:403}):Response.json([]);
  if(pathname==='/storage/v1/object/farm-photographs/staging/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/source'&&options.method==='POST'){storageExists=true;return new Response(null,{status:200});}
  if(pathname==='/storage/v1/object/authenticated/farm-photographs/staging/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/source'){
   if(options.headers.apikey===config.secretKey)return storageExists?new Response('ohajiugwo-authenticated-nonmember-probe',{status:200}):denyServiceAfterDelete?Response.json({code:'Unauthorized'},{status:403}):Response.json({code:'NoSuchKey'},{status:400});
   return denyStorage?Response.json({code:'NoSuchKey'},{status:400}):new Response('sentinel',{status:200});
  }
  if(pathname==='/storage/v1/object/farm-photographs'&&options.method==='DELETE'){storageExists=false;return new Response(null,{status:200});}
  if(pathname==='/auth/v1/admin/users/'+userId&&options.method==='DELETE')return new Response(null,{status:204});
  if(pathname==='/auth/v1/admin/users/'+userId&&(options.method??'GET')==='GET')return Response.json({message:'User not found'},{status:404});
  throw new Error(`unexpected ${options.method} ${pathname}`);
 };
 return {fetchImpl,calls};
}

test('temporary non-member probe denies content and private object reads, then removes every fixture without email flows',async()=>{
 const {fetchImpl,calls}=mockFetch();
 const report=await probeAuthenticatedNonmemberAccess(config,{fetchImpl,uuidImpl:()=> 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'});
 assert.deepEqual(report,{authenticatedNonmemberContentDenied:true,authenticatedNonmemberStorageReadDenied:true,temporaryIdentityDeleted:true,temporaryObjectDeleted:true,emailSent:false,scope:'Direct hosted Auth/JWT and private Storage authorization only; member access, app previews, provider email, concurrency and deployed HTTPS remain separate.'});
 assert.equal(calls.some(call=>call.url.includes('generate_link')||call.url.includes('/invite')||call.url.includes('/verify')),false);
 const create=calls.find(call=>call.url.endsWith('/auth/v1/admin/users')&&call.options.method==='POST');
 assert.equal(create.options.headers.apikey,config.secretKey);assert.equal(create.options.headers.Authorization,undefined);
 const signIn=calls.find(call=>call.url.includes('/auth/v1/token?grant_type=password'));
 assert.equal(signIn.options.headers.apikey,config.publishableKey);assert.equal(signIn.options.headers.Authorization,undefined);
 const rpc=calls.find(call=>call.url.endsWith('/farm_content_list'));
 assert.equal(rpc.options.headers.Authorization,`Bearer ${token}`);assert.equal(rpc.options.headers.apikey,config.publishableKey);
 const userStorage=calls.find(call=>call.url.includes('/storage/v1/object/authenticated/')&&call.options.headers.Authorization===`Bearer ${token}`);
 assert.ok(userStorage);
 assert.ok(calls.some(call=>call.url.endsWith(`/auth/v1/admin/users/${userId}`)&&call.options.method==='DELETE'));
 assert.ok(calls.some(call=>call.url.endsWith('/storage/v1/object/farm-photographs')&&call.options.method==='DELETE'));
 assert.ok(!JSON.stringify(report).includes(token));
});

test('probe cleans up identity and object and fails closed when a non-member gains access',async()=>{
 for(const mode of ['content','storage']){
  const {fetchImpl}=mockFetch({denyContent:mode!=='content',denyStorage:mode!=='storage'});
  await assert.rejects(()=>probeAuthenticatedNonmemberAccess(config,{fetchImpl,uuidImpl:()=> 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}),/non-member|authorization/i);
 }
});

test('permission failure from service-role verification is not mistaken for proof that the temporary object was deleted',async()=>{
 const {fetchImpl}=mockFetch({denyServiceAfterDelete:true});
 await assert.rejects(()=>probeAuthenticatedNonmemberAccess(config,{fetchImpl,uuidImpl:()=> 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}),/cleanup needs owner review/);
});
