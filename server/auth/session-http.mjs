import {newToken,seal,unseal,checkMutation,privateHeaders} from '../security.mjs';
import {AuthError} from './sessions.mjs';

class RequestError extends Error{constructor(status){super('Request rejected.');this.status=status;}}
const contextName=config=>config.secureCookies?'__Secure-ohajiugwo_login_csrf':'ohajiugwo_login_csrf_local';
const contextCookie=(config,value)=>`${contextName(config)}=${value}; Path=/admin/api/login; Max-Age=${value?600:0}; HttpOnly; SameSite=Lax${config.secureCookies?'; Secure':''}`;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8',...headers}});
const projection=value=>({user:{id:value.user.id,email:value.user.email},csrfToken:value.csrfToken});
async function loginContext(config,request,now){
 try{
  const cookies=String(request.headers.get('cookie')||'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(contextName(config)+'='));
  if(cookies.length!==1)throw new Error();
  const value=cookies[0].slice(contextName(config).length+1);if(value.length>2048)throw new Error();
  const context=await unseal(value,config.sessionKey,config.origin+':login-csrf');
  if(!Number.isFinite(context.issuedAt)||now<context.issuedAt||now-context.issuedAt>=600000)throw new Error();
  await checkMutation(request,config,context.csrfToken);
 }catch{throw new RequestError(403);}
}
async function body(request,allowed){
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new RequestError(415);
 if(Number(request.headers.get('content-length'))>4096)throw new RequestError(413);
 if(!request.body)throw new RequestError(400);
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new RequestError(413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 let result;try{result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new RequestError(400);}
 if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).some(key=>!allowed.includes(key)))throw new RequestError(400);
 return result;
}

// Shared session adapter; hosting routes remain disabled by default.
// getClientIp must be supplied by a trusted server transport, never a forwarded browser header.
export function createSessionHandler(config,{service,now=Date.now,getClientIp=()=> 'unknown'}){
 return async request=>{
  let login=false;
  try{
   const url=new URL(request.url),routes=['/admin/api/login','/admin/api/session','/admin/api/logout','/admin/api/reauthenticate'];
   if(!routes.includes(url.pathname))return json({error:'Not found.'},404);
   if(url.origin!==config.origin||request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==config.origin))throw new RequestError(403);
   if(url.search)throw new RequestError(400);
   login=url.pathname==='/admin/api/login';
   const methods=login?['GET','POST']:url.pathname==='/admin/api/session'?['GET']:['POST'];
   if(!methods.includes(request.method))return json({error:'Method not allowed.'},405,{Allow:methods.join(', ')});
   if(login&&request.method==='GET'){
    const csrfToken=newToken(),encrypted=await seal({csrfToken,issuedAt:now()},config.sessionKey,config.origin+':login-csrf');
    return json({csrfToken},200,{'Set-Cookie':contextCookie(config,encrypted)});
   }
   if(url.pathname==='/admin/api/session')return json(projection(await service.authenticate(request)));
   if(request.headers.get('origin')!==config.origin||!/^[A-Za-z0-9_-]{43}$/.test(request.headers.get('x-csrf-token')||''))throw new RequestError(403);
   if(login){
    await loginContext(config,request,now());
    const input=await body(request,['email','password']);
    const result=await service.login({email:input.email,password:input.password,clientIp:getClientIp(request)});
    const response=json(projection(result),200,{'Set-Cookie':result.cookie});
    response.headers.append('Set-Cookie',contextCookie(config,''));return response;
   }
   if(url.pathname==='/admin/api/reauthenticate'){
    const input=await body(request,['password']);
    const result=await service.reauthenticate(request,{password:input.password,clientIp:getClientIp(request)});
    return json({...projection(result),providerCleanupPending:result.providerCleanupPending},200,{'Set-Cookie':result.cookie});
   }
   await body(request,[]);
   const result=await service.logout(request);
   return json({signedOut:true,providerCleanupPending:result.providerCleanupPending},200,{'Set-Cookie':result.cookie});
  }catch(error){
   const status=(error instanceof RequestError||error instanceof AuthError)&&[400,401,403,413,415,429,503].includes(error.status)?error.status:503;
   const message=status===429?'Too many attempts. Try again later.':status===401?(login?'Unable to sign in with those details.':'Your session has ended. Sign in again.'):status===503?'Authentication is temporarily unavailable. Try again shortly.':'Request could not be completed.';
   return json({error:message},status,status===429?{'Retry-After':'900'}:{});
  }
 };
}
