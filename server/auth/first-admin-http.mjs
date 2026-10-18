import {newToken,seal,unseal,checkMutation,privateHeaders} from '../security.mjs';
import {FirstAdminError} from './first-admin.mjs';

const cookieName=config=>config.secureCookies?'__Secure-ohajiugwo_first_admin_csrf':'ohajiugwo_first_admin_csrf_local';
const csrfCookie=(config,value)=>`${cookieName(config)}=${value}; Path=/admin/accept; Max-Age=${value?600:0}; HttpOnly; SameSite=Lax${config.secureCookies?'; Secure':''}`;
const receiptName=config=>config.secureCookies?'__Secure-ohajiugwo_first_admin_receipt':'ohajiugwo_first_admin_receipt_local';
async function hasReceipt(config,request,now){
 try{
  const id=request.headers.get('x-first-admin-invitation-id');if(!id)return false;
  const cookies=String(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(receiptName(config)+'='));
  if(cookies.length!==1)return false;const value=cookies[0].slice(receiptName(config).length+1);if(value.length>2048)return false;
  const receipt=await unseal(value,config.sessionKey,config.origin+':first-admin-receipt');
  return receipt.id===id&&Number.isFinite(receipt.issuedAt)&&now>=receipt.issuedAt&&now-receipt.issuedAt<300000;
 }catch{return false;}
}
const cookieValue=(config,request)=>{
 const matches=String(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName(config)+'='));
 if(matches.length!==1)throw new FirstAdminError(403);
 const value=matches[0].slice(cookieName(config).length+1);
 if(value.length>2048||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))throw new FirstAdminError(403);
 return value;
};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8',...headers}});
async function boundedBody(request){
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new FirstAdminError(415);
 if(Number(request.headers.get('content-length'))>4096)throw new FirstAdminError(413);
 if(!request.body)throw new FirstAdminError();
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new FirstAdminError(413);}chunks.push(value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new FirstAdminError();}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(x=>!['id','nonce','tokenHash','password'].includes(x)))throw new FirstAdminError();
 return body;
}
// Shared acceptance adapter; default hosting routes remain disabled.
// A future browser shell must remove the invitation fragment before making any request.
export function createFirstAdminHandler(config,{service,now=Date.now,getClientIp=()=> 'unknown'}){
 return async request=>{
  try{
   const url=new URL(request.url);
   if(url.pathname!=='/admin/accept')return json({error:'Not found.'},404);
   if(url.search)return json({error:'Invalid request.'},400);
   if(url.origin!==config.origin)throw new FirstAdminError(403);
   if(request.method==='GET'){
    if(await hasReceipt(config,request,now()))return json({completed:true});
    const csrfToken=newToken(),cookie=await seal({csrfToken,issuedAt:now()},config.sessionKey,config.origin+':first-admin-csrf');
    return json({step:'accept_invitation',csrfToken},200,{'Set-Cookie':csrfCookie(config,cookie)});
   }
   if(request.method!=='POST')return json({error:'Method not allowed.'},405,{Allow:'GET, POST'});
   let csrf;
   try{
    csrf=await unseal(cookieValue(config,request),config.sessionKey,config.origin+':first-admin-csrf');
    if(!Number.isFinite(csrf.issuedAt)||now()<csrf.issuedAt||now()-csrf.issuedAt>=600000)throw new Error();
    await checkMutation(request,config,csrf.csrfToken);
   }catch{throw new FirstAdminError(403);}
   const body=await boundedBody(request);
   const result=await service.accept({...body,clientIp:getClientIp(request)});
   const response=json(result,200,{'Set-Cookie':csrfCookie(config,'')});
   const receipt=await seal({id:body.id,issuedAt:now()},config.sessionKey,config.origin+':first-admin-receipt');
   response.headers.append('Set-Cookie',`${receiptName(config)}=${receipt}; Path=/admin/accept; Max-Age=300; HttpOnly; SameSite=Lax${config.secureCookies?'; Secure':''}`);
   return response;
  }catch(error){
   const status=error instanceof FirstAdminError?error.status:503;
   return json({error:status===429?'Too many attempts. Try again later.':status===503?'Administrator setup is temporarily unavailable.':'Administrator setup could not be completed.'},status,status===429?{'Retry-After':'900'}:{});
  }
 };
}
