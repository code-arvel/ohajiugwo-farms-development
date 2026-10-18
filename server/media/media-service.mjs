import {AuthError} from '../auth/sessions.mjs';

const MAX_BYTES=10_485_760,MAX_DIMENSION=4096,ALLOWED=new Set(['image/jpeg','image/png','image/webp']);
const denied=(status=503)=>new AuthError('The photograph could not be processed. Try again shortly.',status);
function signature(bytes,type){
 if(type==='image/png')return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);
 if(type==='image/jpeg')return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==='image/webp')return bytes.length>=12&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP';
 return false;
}
async function checksum(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');}
function reservation(value){
 if(!value||typeof value.id!=='string'||typeof value.media_id!=='string'||typeof value.version_id!=='string'||typeof value.upload_path!=='string'||typeof value.original_path!=='string'||typeof value.preview_path!=='string')throw denied();
 for(const path of [value.upload_path,value.original_path,value.preview_path])if(!path||path.length>512||path.startsWith('/')||path.includes('..'))throw denied();
 return value;
}
export function createMediaService({auth,rpc,storage,processor}){
 async function call(name,params){try{return await rpc(name,params);}catch{throw denied();}}
 async function actor(request,mutation=false){const current=await auth.authenticate(request,mutation?{requireMutation:true}:{});if(!/^[A-Za-z0-9_-]{43}$/.test(current?.cookieHash||''))throw new AuthError('Your session has ended. Sign in again.',401);return current;}
 return {
  async list(request){
   const current=await actor(request);const values=await call('farm_media_list',{p_actor_cookie_hash:current.cookieHash});
   if(!Array.isArray(values)||values.length>200)throw denied();
   return values.map(value=>{
    const metadata=value?.metadata;
    if(!value||!/^[a-f0-9-]{36}$/i.test(value.id||'')||!/^[a-f0-9-]{36}$/i.test(value.versionId||'')||!metadata||!Number.isInteger(metadata.width)||metadata.width<1||metadata.width>4096||!Number.isInteger(metadata.height)||metadata.height<1||metadata.height>4096||metadata.mimeType!=='image/webp'||!Number.isInteger(metadata.byteSize)||metadata.byteSize<1||metadata.byteSize>MAX_BYTES)throw denied();
    return {id:value.id,versionId:value.versionId,metadata:{width:metadata.width,height:metadata.height,mimeType:metadata.mimeType,byteSize:metadata.byteSize},createdAt:typeof value.createdAt==='string'?value.createdAt:'',previewUrl:`/admin/api/media/${value.id}/${value.versionId}/preview`};
   });
  },
  async preview(request,mediaId,versionId){
   const current=await actor(request);if(!/^[a-f0-9-]{36}$/i.test(mediaId||'')||!/^[a-f0-9-]{36}$/i.test(versionId||''))throw denied(404);
   const path=await call('farm_media_preview_path',{p_actor_cookie_hash:current.cookieHash,p_media_id:mediaId,p_version_id:versionId});if(typeof path!=='string')throw denied(404);
   try{return await storage.get(path);}catch{throw denied();}
  },
  async remove(request,mediaId){
   const current=await actor(request,true);if(!/^[a-f0-9-]{36}$/i.test(mediaId||''))throw denied(400);
   try{if(await call('farm_media_remove',{p_actor_cookie_hash:current.cookieHash,p_media_id:mediaId})!==true)throw denied(404);return{removed:true};}catch(error){if(error instanceof AuthError)throw error;throw denied();}
  },
  async upload(request,{bytes,contentType}){
   const current=await actor(request,true);
   if(!(bytes instanceof Uint8Array)||bytes.byteLength<12||bytes.byteLength>MAX_BYTES||!ALLOWED.has(contentType)||!signature(bytes,contentType))throw denied(400);
   let slot,stored=[],owner=crypto.randomUUID(),finalizeAttempted=false;
   try{
    slot=reservation(await call('farm_media_reserve',{p_actor_cookie_hash:current.cookieHash,p_mime_type:contentType,p_byte_size:bytes.byteLength}));
    if(await call('farm_media_claim',{p_actor_cookie_hash:current.cookieHash,p_id:slot.id,p_owner:owner})!==true)throw denied(409);
    await storage.put(slot.upload_path,bytes,contentType);stored.push(slot.upload_path);
    const processed=await processor.process(bytes,{contentType,maxDimension:MAX_DIMENSION,format:'image/webp',metadata:'none'});
    if(!processed||!(processed.original instanceof Uint8Array)||!(processed.preview instanceof Uint8Array)||processed.original.byteLength<1||processed.preview.byteLength<1||processed.original.byteLength>MAX_BYTES||processed.preview.byteLength>MAX_BYTES||processed.contentType!=='image/webp'||!Number.isInteger(processed.width)||!Number.isInteger(processed.height)||processed.width<1||processed.height<1||processed.width>MAX_DIMENSION||processed.height>MAX_DIMENSION)throw denied();
    await storage.put(slot.original_path,processed.original,'image/webp');stored.push(slot.original_path);
    await storage.put(slot.preview_path,processed.preview,'image/webp');stored.push(slot.preview_path);
    await storage.delete([slot.upload_path]);stored=stored.filter(path=>path!==slot.upload_path);
    finalizeAttempted=true;
    if(await call('farm_media_ready',{p_actor_cookie_hash:current.cookieHash,p_id:slot.id,p_owner:owner,p_width:processed.width,p_height:processed.height,p_mime_type:'image/webp',p_byte_size:processed.original.byteLength,p_checksum:await checksum(processed.original)})!==true)throw denied();
    return {mediaId:slot.media_id,versionId:slot.version_id,state:'ready',width:processed.width,height:processed.height,mimeType:'image/webp'};
   }catch(error){
    // A lost acknowledgement after publication is uncertain. Preserve all outputs for
    // reconciliation; deleting them could break a row that committed successfully.
    if(slot&&!finalizeAttempted){try{await storage.delete([slot.upload_path,slot.original_path,slot.preview_path].filter(Boolean));}catch{}try{await call('farm_media_quarantine',{p_actor_cookie_hash:current.cookieHash,p_id:slot.id});}catch{}}
    if(error instanceof AuthError&&[400,401,409].includes(error.status))throw error;
    throw denied();
   }
  },
 };
}
