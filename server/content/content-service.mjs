import {validateHomepage,validatePosts} from '../../src/content/schema.mjs';
import {AuthError} from '../auth/sessions.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(status=400)=>new AuthError('The content change could not be completed.',status);
function clean(kind,id,revision,payload){
 try{
  const value=structuredClone(payload);
  if(kind==='homepage')validateHomepage(value);
  else if(kind==='post'){
   if(value.status!=='draft')throw new Error('Stage 2 stores draft content only.');
   if(value.mediaVersionId==='')delete value.mediaVersionId;
   delete value.reviewOnly;delete value.id;delete value.revision;
   validatePosts([{...value,id:id||crypto.randomUUID(),revision:revision||1,status:'draft',reviewOnly:true}]);
  }else throw new Error('Unsupported content kind.');
  if(new TextEncoder().encode(JSON.stringify(value)).length>1_000_000)throw new Error('Content is too large.');
  return value;
 }catch{throw fail(400);}
}
function row(value){
 if(!value||!uuid.test(value.id||'')||!['homepage','post'].includes(value.kind)||!Number.isSafeInteger(value.revision)||value.revision<1||!value.payload||typeof value.payload!=='object')throw fail(503);
 return {id:value.id,kind:value.kind,revision:value.revision,payload:value.payload,updatedAt:value.updated_at,deletedAt:value.deleted_at||null};
}
function status(error){if(error instanceof AuthError)throw error;if(error?.status===409||error?.code==='40001')throw fail(409);if(error?.status===401||error?.status===403)throw new AuthError('Your session has ended. Sign in again.',401);throw fail(503);}
export function createContentService({auth,provider}){
 async function actor(request,mutation=false){
  const current=await auth.authenticate(request,mutation?{requireMutation:true}:{});
  if(typeof current?.accessToken!=='string'||!current.accessToken)throw new AuthError('Your session has ended. Sign in again.');
  return current;
 }
 async function call(current,name,params){try{return await provider.userRpc(name,params,current.accessToken);}catch(error){status(error);}}
 return {
  async list(request){const current=await actor(request);try{const value=await call(current,'farm_content_list',{});if(!Array.isArray(value)||value.length>500)throw fail(503);return value.map(row);}catch(error){status(error);}},
  async read(request,id){if(!uuid.test(id||''))throw fail(400);const current=await actor(request);try{const value=await call(current,'farm_content_read',{p_id:id});return value?row(value):null;}catch(error){status(error);}},
  async history(request,id){if(!uuid.test(id||''))throw fail(400);const current=await actor(request);try{const value=await call(current,'farm_content_history',{p_id:id});if(!Array.isArray(value)||value.length>500)throw fail(503);return value;}catch(error){status(error);}},
  async listTrash(request){const current=await actor(request);try{const value=await call(current,'farm_content_trash_list',{});if(!Array.isArray(value)||value.length>500)throw fail(503);return value.map(row);}catch(error){status(error);}},
  async save(request,input){
   const current=await actor(request,true),id=input.id||crypto.randomUUID();
   if(!uuid.test(id)||!['homepage','post'].includes(input.kind)||(input.baseRevision!==null&&(!Number.isSafeInteger(input.baseRevision)||input.baseRevision<1)))throw fail(400);
   const payload=clean(input.kind,id,input.baseRevision,input.payload),params={p_id:input.id||null,p_kind:input.kind,p_base_revision:input.baseRevision,p_payload:payload};
   try{return row(await call(current,'farm_content_save',params));}catch(error){status(error);}
  },
  async restore(request,id,input){
   if(!uuid.test(id||'')||!Number.isSafeInteger(input.revision)||input.revision<1||!Number.isSafeInteger(input.baseRevision)||input.baseRevision<1)throw fail(400);
   const current=await actor(request,true);try{return row(await call(current,'farm_content_restore',{p_id:id,p_revision:input.revision,p_base_revision:input.baseRevision}));}catch(error){status(error);}
  },
  async trash(request,id,baseRevision){
   if(!uuid.test(id||'')||!Number.isSafeInteger(baseRevision)||baseRevision<1)throw fail(400);
   const current=await actor(request,true);try{if(await call(current,'farm_content_trash',{p_id:id,p_base_revision:baseRevision})!==true)throw fail(409);return{trashed:true};}catch(error){status(error);}
  },
  async untrash(request,id,baseRevision){
   if(!uuid.test(id||'')||!Number.isSafeInteger(baseRevision)||baseRevision<1)throw fail(400);
   const current=await actor(request,true);try{return row(await call(current,'farm_content_untrash',{p_id:id,p_base_revision:baseRevision}));}catch(error){status(error);}
  },
 };
}
