import {privateHeaders} from '../security.mjs';
import {AuthError} from './sessions.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});
class RequestError extends Error{constructor(status){super('Request rejected.');this.status=status;}}
async function boundedBody(request,allowed=[]){
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new RequestError(415);
 if(Number(request.headers.get('content-length'))>2048)throw new RequestError(413);
 if(!request.body)throw new RequestError(400);
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new RequestError(413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new RequestError(400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!allowed.includes(key)))throw new RequestError(400);
 return body;
}
function responseError(error){
 const status=(error instanceof RequestError||error instanceof AuthError)&&[400,401,403,409,413,415,428,429,503].includes(error.status)?error.status:503;
 const message=status===401?'Your session has ended. Sign in again.':status===428?'Confirm your password to continue.':status===409?'That administrator action is no longer available.':status===503?'Administrator services are temporarily unavailable. Try again shortly.':'Request could not be completed.';
 return json({error:message},status);
}
export function createAccountLifecycleHandler(config,{service}){
 return async request=>{
  try{
   const url=new URL(request.url);if(url.origin!==config.origin||request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==config.origin))throw new RequestError(403);
   if(url.search)throw new RequestError(400);
   if(url.pathname==='/admin/api/accounts'&&request.method==='GET')return json(await service.list(request));
   if(request.method!=='POST')return json({error:'Method not allowed.'},405);
   if(request.headers.get('origin')!==config.origin||!/^[A-Za-z0-9_-]{43}$/.test(request.headers.get('x-csrf-token')||''))throw new RequestError(403);
   if(url.pathname==='/admin/api/accounts/invitations/prepare'){
    const body=await boundedBody(request,['email']);if(Object.keys(body).length!==1||typeof body.email!=='string')throw new RequestError(400);
    return json(await service.prepare(request,body.email));
   }
   if(url.pathname==='/admin/api/accounts/password-resets/prepare'){
    const body=await boundedBody(request,['userId']);if(Object.keys(body).length!==1||typeof body.userId!=='string')throw new RequestError(400);
    return json(await service.prepareReset(request,body.userId));
   }
   let match=url.pathname.match(/^\/admin\/api\/accounts\/password-resets\/([a-f0-9-]{36})\/issue$/i);
   if(match&&uuid.test(match[1])){await boundedBody(request);return json(await service.issueReset(request,match[1]));}
   match=url.pathname.match(/^\/admin\/api\/accounts\/password-resets\/([a-f0-9-]{36})\/cancel$/i);
   if(match&&uuid.test(match[1])){await boundedBody(request);return json(await service.cancelReset(request,match[1]));}
   match=url.pathname.match(/^\/admin\/api\/accounts\/invitations\/([a-f0-9-]{36})\/issue$/i);
   if(match&&uuid.test(match[1])){await boundedBody(request);return json(await service.issue(request,match[1]));}
   match=url.pathname.match(/^\/admin\/api\/accounts\/invitations\/([a-f0-9-]{36})\/resend$/i);
   if(match&&uuid.test(match[1])){await boundedBody(request);return json(await service.resend(request,match[1]));}
   await boundedBody(request);
   match=url.pathname.match(/^\/admin\/api\/accounts\/invitations\/([a-f0-9-]{36})\/cancel$/i);
   if(match&&uuid.test(match[1]))return json(await service.cancel(request,match[1]));
   match=url.pathname.match(/^\/admin\/api\/accounts\/([a-f0-9-]{36})\/revoke$/i);
   if(match&&uuid.test(match[1]))return json(await service.revoke(request,match[1]));
   return json({error:'Not found.'},404);
  }catch(error){return responseError(error);}
 };
}
