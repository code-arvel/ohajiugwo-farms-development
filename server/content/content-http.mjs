import {privateHeaders} from '../security.mjs';
import {AuthError} from '../auth/sessions.mjs';

class RequestError extends Error{constructor(status){super('Request rejected.');this.status=status;}}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});
async function readBody(request){
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new RequestError(415);
 if(Number(request.headers.get('content-length'))>1_100_000)throw new RequestError(413);
 if(!request.body)throw new RequestError(400);
 const reader=request.body.getReader(),parts=[];let size=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1_100_000){await reader.cancel();throw new RequestError(413);}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.byteLength;}
 let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new RequestError(400);}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new RequestError(400);
 return body;
}
function errorResponse(error){
 const status=(error instanceof RequestError||error instanceof AuthError)&&[400,401,403,409,413,415,428,503].includes(error.status)?error.status:503;
 const message=status===401?'Your session has ended. Sign in again.':status===428?'Confirm your password to continue.':status===409?'This content changed elsewhere. Reload it before saving.':status===503?'Content is temporarily unavailable. Try again shortly.':'Request could not be completed.';
 return json({error:message},status);
}
export function createContentHandler(config,{service}){
 return async request=>{
  try{
   const url=new URL(request.url);if(url.origin!==config.origin||request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==config.origin))throw new RequestError(403);
   if(url.search)throw new RequestError(400);
   if(request.method==='GET'){
    if(url.pathname==='/admin/api/content/trash')return json(await service.listTrash(request));
    if(url.pathname==='/admin/api/content')return json(await service.list(request));
    let match=url.pathname.match(/^\/admin\/api\/content\/([a-f0-9-]{36})(?:\/(history))?$/i);if(match&&/^[a-f0-9-]{36}$/i.test(match[1]))return json(match[2]?await service.history(request,match[1]):await service.read(request,match[1]));
    return json({error:'Not found.'},404);
   }
   if(request.method!=='POST')return json({error:'Method not allowed.'},405);
   if(request.headers.get('origin')!==config.origin||!/^[A-Za-z0-9_-]{43}$/.test(request.headers.get('x-csrf-token')||''))throw new RequestError(403);
   const body=await readBody(request);
   if(url.pathname==='/admin/api/content'){
    if(Object.keys(body).sort().join(',')!=='baseRevision,id,kind,payload')throw new RequestError(400);
    return json(await service.save(request,body));
   }
   let match=url.pathname.match(/^\/admin\/api\/content\/([a-f0-9-]{36})\/(save|restore|trash|untrash)$/i);if(!match||!uuidMatch(match[1]))return json({error:'Not found.'},404);
   const [,id,action]=match;
   if(action==='save'){
    if(Object.keys(body).sort().join(',')!=='baseRevision,kind,payload')throw new RequestError(400);
    return json(await service.save(request,{...body,id}));
   }
   if(action==='restore'){
    if(Object.keys(body).sort().join(',')!=='baseRevision,revision')throw new RequestError(400);
    return json(await service.restore(request,id,body));
   }
   if(Object.keys(body).sort().join(',')!=='baseRevision')throw new RequestError(400);
   if(action==='untrash')return json(await service.untrash(request,id,body.baseRevision));
   return json(await service.trash(request,id,body.baseRevision));
  }catch(error){return errorResponse(error);}
 };
}
const uuidMatch=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value||'');
