import {privateHeaders} from '../security.mjs';
import {AuthError} from '../auth/sessions.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
class RequestError extends Error{constructor(status){super('Request rejected.');this.status=status;}}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});
async function bytes(request){
 const type=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();if(!['image/jpeg','image/png','image/webp'].includes(type))throw new RequestError(415);
 const length=request.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>10_485_760))throw new RequestError(413);
 if(!request.body)throw new RequestError(400);const reader=request.body.getReader(),parts=[];let size=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>10_485_760){await reader.cancel();throw new RequestError(413);}parts.push(value);}}finally{reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.byteLength;}return{bytes:result,contentType:type};
}
function failure(error){const status=error instanceof RequestError||error instanceof AuthError?[400,401,403,404,409,413,415,428,503].includes(error.status)?error.status:503:503;const message=status===401?'Your session has ended. Sign in again.':status===413?'The photo is too large. Choose a smaller image.':status===415?'Choose a JPEG, PNG or WebP photo.':status===404?'The photo is unavailable.':status===409?'The photo upload could not be reserved. Try again.':'The photo request could not be completed. Try again shortly.';return json({error:message},status);}
export function createMediaHandler(config,{service}){
 return async request=>{
  try{
   const url=new URL(request.url);if(url.origin!==config.origin||url.search||request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==config.origin))throw new RequestError(403);
   if(request.method==='GET'&&url.pathname==='/admin/api/media')return json(await service.list(request));
   let match=url.pathname.match(/^\/admin\/api\/media\/([a-f0-9-]{36})\/([a-f0-9-]{36})\/preview$/i);
   if(request.method==='GET'&&match&&uuid.test(match[1])&&uuid.test(match[2])){const image=await service.preview(request,match[1],match[2]);return new Response(image,{status:200,headers:{...privateHeaders,'Content-Type':'image/webp','Content-Length':String(image.byteLength)}});}
   match=url.pathname.match(/^\/admin\/api\/media\/([a-f0-9-]{36})\/remove$/i);
   if(request.method==='POST'&&match&&uuid.test(match[1])){if(request.headers.get('origin')!==config.origin||!/^[A-Za-z0-9_-]{43}$/.test(request.headers.get('x-csrf-token')||''))throw new RequestError(403);return json(await service.remove(request,match[1]));}
   if(request.method==='POST'&&url.pathname==='/admin/api/media'){if(request.headers.get('origin')!==config.origin||!/^[A-Za-z0-9_-]{43}$/.test(request.headers.get('x-csrf-token')||''))throw new RequestError(403);return json(await service.upload(request,await bytes(request)));}
   return json({error:'Not found.'},404);
  }catch(error){return failure(error);}
 };
}
