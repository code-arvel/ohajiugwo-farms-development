import {AuthError} from '../auth/sessions.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const limits={displayName:160,altText:500,description:2000,credit:300,licence:300,source:2048,provenance:2000,folder:120};
const fail=(status=400)=>new AuthError(status===409?'This photograph was changed by another administrator. Reload before saving.':'The photograph details could not be completed.',status);
export function validateEditorial(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(limits,k)&&!['tags','focalPoint'].includes(k)))throw fail();
 const result={};
 for(const [key,max] of Object.entries(limits))if(Object.hasOwn(value,key)){
  if(typeof value[key]!=='string'||value[key].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value[key]))throw fail();
  result[key]=value[key].trim();
 }
 if(result.source){try{const url=new URL(result.source);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw fail();}catch{throw fail();}}
 if(Object.hasOwn(value,'tags')){if(!Array.isArray(value.tags)||value.tags.length>20||value.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>50||/[\u0000-\u001f\u007f]/.test(t)))throw fail();result.tags=[...new Set(value.tags.map(t=>t.trim()))];}
 if(Object.hasOwn(value,'focalPoint')){const p=value.focalPoint;if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==2||!Object.hasOwn(p,'x')||!Object.hasOwn(p,'y')||![p.x,p.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw fail();result.focalPoint={x:p.x,y:p.y};}
 return result;
}
function metadata(value){if(!value||!uuid.test(value.id||'')||!Number.isSafeInteger(value.revision)||value.revision<1||!value.technical||typeof value.technical!=='object')throw fail(503);return{...value,editorial:validateEditorial(value.editorial||{})};}
export function createMediaMetadataService({auth,provider}){
 async function call(request,name,params,mutation=false){
  const current=await auth.authenticate(request,mutation?{requireMutation:true}:{});
  if(typeof current?.accessToken!=='string'||!current.accessToken)throw fail(401);
  try{return await provider.userRpc(name,params,current.accessToken);}catch(error){if(['PT409','40001'].includes(error?.code)||error?.status===409)throw fail(409);if(error?.code==='42501'||[401,403].includes(error?.status))throw fail(401);if(error?.code==='P0002')throw fail(404);if(error?.code==='22023')throw fail(400);throw fail(503);}
 }
 function checkId(id){if(!uuid.test(id||''))throw fail();}
 function base(input){if(!Number.isSafeInteger(input?.baseRevision)||input.baseRevision<1)throw fail();return input.baseRevision;}
 return{
  async listTrash(request){const values=await call(request,'farm_media_trash_list',{});if(!Array.isArray(values)||values.length>200)throw fail(503);return values.map(metadata);},
  async read(request,id){checkId(id);return metadata(await call(request,'farm_media_metadata_read',{p_id:id}));},
  async save(request,id,input){checkId(id);return metadata(await call(request,'farm_media_metadata_save',{p_id:id,p_base_revision:base(input),p_editorial:validateEditorial(input.editorial)},true));},
  async usage(request,id){checkId(id);const value=await call(request,'farm_media_usage',{p_id:id});if(!value||!Array.isArray(value.revisions)||!Array.isArray(value.releases)||value.revisions.length>5000||value.releases.length>5000)throw fail(503);return value;},
  async restore(request,id,input){checkId(id);return metadata(await call(request,'farm_media_restore',{p_id:id,p_base_revision:base(input)},true));},
 };
}
