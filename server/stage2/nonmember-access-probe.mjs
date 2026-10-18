import {randomBytes,randomUUID} from 'node:crypto';

const sentinel=new TextEncoder().encode('ohajiugwo-authenticated-nonmember-probe');
const deniedStatuses=new Set([401,403]);
function apiHeaders(key,token){const headers={apikey:key,Accept:'application/json'};if(token)headers.Authorization=`Bearer ${token}`;else if(key.startsWith('eyJ'))headers.Authorization=`Bearer ${key}`;return headers;}
function safeFailure(message,status){return new Error(`${message}${Number.isInteger(status)?` (HTTP ${status})`:''}; sensitive details withheld.`);}
async function parseJson(response){try{return await response.json();}catch{return null;}}
async function request(fetchImpl,url,options){try{return await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw safeFailure('Hosted non-member check could not connect');}}
async function safeStorageCode(response){const body=await parseJson(response.clone());for(const key of ['code','statusCode','error']){const value=body?.[key];if((typeof value==='string'||typeof value==='number')&&/^[A-Za-z0-9_-]{1,40}$/.test(String(value)))return `${key}=${value}`;}return '';}
function objectDenied(response,code){return deniedStatuses.has(response.status)||(response.status===400&&code==='code=NoSuchKey')||(response.status===404&&['code=not_found','error=not_found','statusCode=404'].includes(code));}
function objectMissing(response,code){return (response.status===400&&code==='code=NoSuchKey')||(response.status===404&&['code=not_found','error=not_found','statusCode=404'].includes(code));}
function uuid(value){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}

// Creates a confirmed, synthetic Auth identity without invoking invite, verify,
// recovery or email APIs. Its JWT tests direct non-member authorization only.
export async function probeAuthenticatedNonmemberAccess(config,{fetchImpl=fetch,uuidImpl=randomUUID}={}){
 const identityEmail=`stage2-probe-${uuidImpl()}@example.invalid`;
 const identityPassword=randomBytes(36).toString('base64url');
 const objectPath=`staging/${uuidImpl()}/source`,encoded=objectPath.split('/').map(encodeURIComponent).join('/');
 const objectUrl=`${config.supabaseUrl}/storage/v1/object/farm-photographs/${encoded}`;
 const authenticatedObjectUrl=`${config.supabaseUrl}/storage/v1/object/authenticated/farm-photographs/${encoded}`;
 let identityMayExist=false,userId=null,objectMayExist=false,accessToken=null;
 let contentDenied=false,storageDenied=false,probeError=null;
 const adminHeaders=apiHeaders(config.secretKey),publicHeaders=apiHeaders(config.publishableKey);
 try{
  identityMayExist=true;
  const created=await request(fetchImpl,`${config.supabaseUrl}/auth/v1/admin/users`,{method:'POST',headers:{...adminHeaders,'Content-Type':'application/json'},body:JSON.stringify({email:identityEmail,password:identityPassword,email_confirm:true,user_metadata:{stage2_probe:'authenticated-nonmember'}})});
  if(!created.ok){identityMayExist=created.status>=500;throw safeFailure('Synthetic test identity creation was rejected',created.status);}
  const createdBody=await parseJson(created);
  if(!uuid(createdBody?.id)||createdBody?.email!==identityEmail||!createdBody?.email_confirmed_at)throw safeFailure('Synthetic test identity response could not be verified');
  userId=createdBody.id;

  const signedIn=await request(fetchImpl,`${config.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{...publicHeaders,'Content-Type':'application/json'},body:JSON.stringify({email:identityEmail,password:identityPassword})});
  if(!signedIn.ok)throw safeFailure('Synthetic test identity could not sign in',signedIn.status);
  const authBody=await parseJson(signedIn);
  if(authBody?.user?.id!==userId||authBody?.user?.email!==identityEmail||typeof authBody?.access_token!=='string'||!authBody.access_token)throw safeFailure('Synthetic user session could not be verified');
  accessToken=authBody.access_token;

  const rpc=await request(fetchImpl,`${config.supabaseUrl}/rest/v1/rpc/farm_content_list`,{method:'POST',headers:{...apiHeaders(config.publishableKey,accessToken),'Content-Type':'application/json'},body:'{}'});
  const rpcBody=await parseJson(rpc);
  if(!deniedStatuses.has(rpc.status)||rpcBody?.code!=='42501'||rpcBody?.message!=='Active administrator session required.')throw safeFailure('Authenticated non-member content access was not denied as expected',rpc.status);
  contentDenied=true;

  objectMayExist=true;
  const uploaded=await request(fetchImpl,objectUrl,{method:'POST',headers:{...adminHeaders,'Content-Type':'image/png','x-upsert':'false'},body:sentinel});
  if(!uploaded.ok)throw safeFailure('Temporary private Storage fixture could not be created',uploaded.status);
  const serviceRead=await request(fetchImpl,authenticatedObjectUrl,{headers:adminHeaders});
  if(!serviceRead.ok)throw safeFailure('Temporary private Storage fixture could not be confirmed',serviceRead.status);
  const stored=new Uint8Array(await serviceRead.arrayBuffer());
  if(stored.length!==sentinel.length||stored.some((byte,index)=>byte!==sentinel[index]))throw safeFailure('Temporary private Storage fixture did not match');
  const nonmemberRead=await request(fetchImpl,authenticatedObjectUrl,{headers:apiHeaders(config.publishableKey,accessToken)});
  const storageCode=await safeStorageCode(nonmemberRead);
  if(!objectDenied(nonmemberRead,storageCode)){try{await nonmemberRead.body?.cancel();}catch{}throw safeFailure('Authenticated non-member private Storage access was not denied',nonmemberRead.status);}
  try{await nonmemberRead.body?.cancel();}catch{}
  storageDenied=true;
 }catch(error){probeError=error instanceof Error?error:safeFailure('Hosted non-member check failed');}

 const cleanupErrors=[];
 if(objectMayExist){
  try{
   const deletion=await request(fetchImpl,`${config.supabaseUrl}/storage/v1/object/farm-photographs`,{method:'DELETE',headers:{...adminHeaders,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[objectPath]})});
   if(!deletion.ok)throw safeFailure('Temporary private Storage fixture cleanup was rejected',deletion.status);
   const check=await request(fetchImpl,authenticatedObjectUrl,{headers:adminHeaders});
   const code=await safeStorageCode(check);
   if(!objectMissing(check,code))throw safeFailure('Temporary private Storage fixture removal could not be verified',check.status);
  }catch(error){cleanupErrors.push(error);}
 }
 if(identityMayExist){
  try{
   if(!userId){
    let listingComplete=false;
    for(let page=1;page<=100;page++){
     const listed=await request(fetchImpl,`${config.supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`,{headers:adminHeaders});
     if(!listed.ok)throw safeFailure('Synthetic test identity cleanup lookup was rejected',listed.status);
     const body=await parseJson(listed),users=Array.isArray(body?.users)?body.users:[];
     const match=users.find(user=>user?.email===identityEmail);
     if(match?.id&&uuid(match.id)){userId=match.id;break;}
     if(users.length<1000){listingComplete=true;break;}
    }
    if(!userId&&!listingComplete)throw safeFailure('Synthetic test identity cleanup lookup was incomplete');
   }
   if(userId){
    const deletion=await request(fetchImpl,`${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,{method:'DELETE',headers:adminHeaders});
    if(!deletion.ok)throw safeFailure('Synthetic test identity deletion was rejected',deletion.status);
    const check=await request(fetchImpl,`${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,{headers:adminHeaders});
    if(check.status!==404)throw safeFailure('Synthetic test identity deletion could not be verified',check.status);
   }
  }catch(error){cleanupErrors.push(error);}
 }
 accessToken=null;
 if(cleanupErrors.length){throw new Error(`Hosted non-member check cleanup needs owner review; check the synthetic Auth user ${identityEmail} and/or Storage path ${objectPath} in the farm-photographs bucket. Sensitive details withheld.`);}
 if(probeError)throw probeError;
 if(!contentDenied||!storageDenied)throw safeFailure('Hosted non-member authorization result was incomplete');
 return {authenticatedNonmemberContentDenied:true,authenticatedNonmemberStorageReadDenied:true,temporaryIdentityDeleted:true,temporaryObjectDeleted:true,emailSent:false,scope:'Direct hosted Auth/JWT and private Storage authorization only; member access, app previews, provider email, concurrency and deployed HTTPS remain separate.'};
}
