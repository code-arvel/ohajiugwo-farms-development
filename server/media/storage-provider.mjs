import {AuthError} from '../auth/sessions.mjs';

const fail=()=>new AuthError('Private photo storage is temporarily unavailable.',503);
const pathPattern=/^(?:staging\/[0-9a-f-]{36}\/source|media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(?:original|preview)\.webp)$/i;
function validPath(path){if(typeof path!=='string'||!pathPattern.test(path))throw fail();return path.split('/').map(encodeURIComponent).join('/');}
export function createPrivateStorageProvider(config,{fetchImpl=fetch}={}){
 const headers={apikey:config.secretKey,Authorization:`Bearer ${config.secretKey}`};
 async function request(path,init={}){let response;try{response=await fetchImpl(config.supabaseUrl+path,{redirect:'error',signal:AbortSignal.timeout(30000),...init});}catch{throw fail();}if(!response.ok)throw fail();return response;}
 return {
  async put(path,bytes,contentType){
   if(!(bytes instanceof Uint8Array)||!['image/jpeg','image/png','image/webp'].includes(contentType))throw fail();
   await request(`/storage/v1/object/farm-photographs/${validPath(path)}`,{method:'POST',headers:{...headers,'Content-Type':contentType,'x-upsert':'false'},body:bytes});
  },
  async get(path){
   const response=await request(`/storage/v1/object/authenticated/farm-photographs/${validPath(path)}`,{headers:{...headers,Accept:'image/webp'}});
   const length=Number(response.headers.get('content-length'));if(Number.isFinite(length)&&length>10_485_760)throw fail();
   const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>10_485_760)throw fail();return bytes;
  },
  async delete(paths){
   if(!Array.isArray(paths)||paths.length<1||paths.length>200)throw fail();
   const safe=paths.map(validPath).map(path=>decodeURIComponent(path).split('/').join('/'));
   await request('/storage/v1/object/farm-photographs',{method:'DELETE',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({prefixes:safe})});
  },
 };
}
