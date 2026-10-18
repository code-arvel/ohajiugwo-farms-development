import {newToken,sessionDigest,seal,unseal,sessionCookie,parseSessionCookie,checkMutation} from '../security.mjs';
export class AuthError extends Error{constructor(message,status=401){super(message);this.name='AuthError';this.status=status;}}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reject=()=>new AuthError('Your session has ended. Sign in again.');
function claims(token,config){
 try{
  if(typeof token!=='string'||token.length>16000)throw new Error();
  const parts=token.split('.');if(parts.length!==3)throw new Error();
  const data=JSON.parse(atob(parts[1].replaceAll('-','+').replaceAll('_','/')));
  if(!uuid.test(data.sub)||!uuid.test(data.session_id)||data.iss!==config.supabaseUrl+'/auth/v1'||data.role!=='authenticated'||data.aud!=='authenticated'||!Number.isFinite(data.exp))throw new Error();
  return data;
 }catch{throw reject();}
}
async function scopeHash(label,value,key){
 const raw=Uint8Array.from(key.match(/../g),v=>parseInt(v,16));
 const hmac=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=new Uint8Array(await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode(label+'\0'+value)));
 return btoa(String.fromCharCode(...signed)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
// Provider and repository dependencies are server-only. No HTTP login route is enabled here.
export function createAuthService(config,{provider,rpc,now=Date.now,effects}){
 async function verified(tokens,expectedUser,expectedProvider){
  if(typeof tokens?.refresh_token!=='string'||!tokens.refresh_token)throw reject();
  const data=claims(tokens.access_token,config);
  if(data.exp<=now()/1000)throw reject();
  const user=await provider.getUser(tokens.access_token);
  if(!user?.email_confirmed_at||user.id!==data.sub||(expectedUser&&user.id!==expectedUser)||(expectedProvider&&data.session_id!==expectedProvider))throw reject();
  return {user,data};
 }
 async function cleanup(row,tokens){
  try{await provider.signOut(tokens.access_token);if(row?.id){if(effects){if(await rpc('farm_cleanup_session_ack',{p_session_id:row.id})!==true)return false;}else await rpc('farm_session_cleanup_done',{p_session_id:row.id});}return true;}catch{return false;}
 }
 async function login({email,password,clientIp='unknown'}){
  let tokens,row,effect;
  try{
   if(typeof email!=='string'||typeof password!=='string'||!password||password.length>1024||email.length>254)throw new AuthError('Unable to sign in with those details.');
   email=email.trim().toLowerCase();if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw new AuthError('Unable to sign in with those details.');
   const [accountScope,ipScope]=await Promise.all([scopeHash('login-account',email,config.sessionKey),scopeHash('login-ip',String(clientIp),config.sessionKey)]);
   const [accountAllowed,ipAllowed]=await Promise.all([rpc('farm_auth_attempt',{p_scope_hash:accountScope,p_limit:5,p_window_seconds:900}),rpc('farm_auth_attempt',{p_scope_hash:ipScope,p_limit:20,p_window_seconds:900})]);
   if(accountAllowed!==true||ipAllowed!==true)throw new AuthError('Too many sign-in attempts. Wait before trying again.',429);
   if(effects)effect=await effects.begin('login',accountScope,{email});
   tokens=await provider.signIn(email,password);
   if(effects)await effects.capture(effect,tokens);
   const {user,data}=await verified(tokens),cookieToken=newToken(),cookieHash=await sessionDigest(cookieToken),csrfToken=newToken();
   const encrypted=await seal({...tokens,csrfToken},config.sessionKey,cookieHash);
   const params={p_user_id:user.id,p_provider_session_id:data.session_id,p_cookie_hash:cookieHash,p_encrypted_credentials:encrypted,p_csrf_hash:await sessionDigest(csrfToken)};
   row=effects?await effects.open(effect,params):await rpc('farm_session_open',params);
   if(row?.user_id!==user.id||row.cookie_hash!==cookieHash||row.provider_session_id!==data.session_id)throw reject();
   return {cookie:sessionCookie(cookieToken,config),csrfToken,user:{id:user.id,email:user.email}};
  }catch(error){
   let cleaned=false;if(tokens){
    if(effects&&effect){const result=await effects.abort(effect);if(result?.safe)cleaned=result.cleaned===true||await cleanup(result.session||row,tokens);}
    else{if(row?.cookie_hash)try{await rpc('farm_session_close',{p_cookie_hash:row.cookie_hash});}catch{}cleaned=await cleanup(row,tokens);}
   }
   if(effect)await effects.release(effect,{cleaned,rejected:!tokens&&[400,401,403,429].includes(error.status)});
   if(error.status===429)throw error;
   if(error.status&&error.status<500)throw new AuthError('Unable to sign in with those details.');
   throw new AuthError('Sign-in is temporarily unavailable. Try again shortly.',503);
  }
 }
 async function read(request){
  const token=parseSessionCookie(request.headers.get('cookie'),config);if(!token)throw reject();
  const hash=await sessionDigest(token),row=await rpc('farm_session_read',{p_cookie_hash:hash});
  if(!row||row.cookie_hash!==hash)throw reject();
  let data;
  try{data=await unseal(row.encrypted_credentials,config.sessionKey,hash);}catch{throw reject();}
  if(await sessionDigest(data.csrfToken||'')!==row.csrf_hash)throw reject();
  return {hash,row,tokens:data};
 }
 async function fresh(record){
  let {row,tokens,hash}=record;
  if(claims(tokens.access_token,config).exp>now()/1000+30)return tokens;
  const owner=crypto.randomUUID(),claim=await rpc('farm_session_refresh_claim',{p_cookie_hash:hash,p_owner:owner});
  if(!claim)throw new AuthError('Your session is refreshing. Try again shortly.',503);
  try{
   const current=await unseal(claim.encrypted_credentials,config.sessionKey,hash);
   // A prior worker may have refreshed between read and lease acquisition.
   let next=current;
   if(claims(current.access_token,config).exp<=now()/1000+30){
    const rotated=await provider.refresh(current.refresh_token);await verified(rotated,row.user_id,row.provider_session_id);next={...rotated,csrfToken:current.csrfToken};
   }
   const complete=await rpc('farm_session_refresh_finish',{p_cookie_hash:hash,p_owner:owner,p_version:claim.refresh_version,p_encrypted_credentials:await seal(next,config.sessionKey,hash)});
   if(complete!==true)throw reject();
   return next;
  }catch(error){
   if(error.status===401||error.status===403)try{await rpc('farm_session_close',{p_cookie_hash:hash});}catch{}
   throw error;
  }finally{try{await rpc('farm_session_refresh_release',{p_cookie_hash:hash,p_owner:owner});}catch{}}
 }
 async function authenticate(request,{requireRecent=false,requireMutation=false}={}){
  let record,mutationRejected=false;
  try{
   record=await read(request);const tokens=await fresh(record);
   if(requireMutation)try{await checkMutation(request,config,tokens.csrfToken);}catch{mutationRejected=true;throw new AuthError('Request rejected.',403);}
   const {user}=await verified(tokens,record.row.user_id,record.row.provider_session_id);
   const confirmedAt=Date.parse(record.row.reauthenticated_at);
   if(requireRecent&&(!Number.isFinite(confirmedAt)||confirmedAt>now()||now()-confirmedAt>=300000))throw new AuthError('Confirm your password before continuing.',428);
   const actor={user:{id:user.id,email:user.email},sessionId:record.row.id,csrfToken:tokens.csrfToken};
   Object.defineProperty(actor,'accessToken',{value:tokens.access_token,enumerable:false});
   Object.defineProperty(actor,'cookieHash',{value:record.hash,enumerable:false});
   return actor;
  }catch(error){
   if(!mutationRejected&&(error.status===401||error.status===403)&&record)try{await rpc('farm_session_close',{p_cookie_hash:record.hash});}catch{}
   if(mutationRejected)throw error;
   if(error.status===401||error.status===403)throw reject();
   if(error instanceof AuthError)throw error;
   throw new AuthError('Session verification is temporarily unavailable.',503);
  }
 }
 async function reauthenticate(request,{password,clientIp='unknown'}={}){
  let record,current,proof,pending,newHash,cookieToken,csrfToken,user,proofProvider,effect,finishing=false;
  const matches=row=>row&&row.cookie_hash===newHash&&row.user_id===record.row.user_id&&row.provider_session_id===proofProvider&&!row.revoked_at;
  function response(row,providerCleanupPending){
   const seconds=Math.floor((Date.parse(row.absolute_expires_at)-now())/1000);
   if(!matches(row)||!Number.isFinite(seconds)||seconds<1)throw reject();
   return {cookie:sessionCookie(cookieToken,{...config,absoluteSeconds:Math.min(config.absoluteSeconds,seconds)}),csrfToken,user:{id:user.id,email:user.email},providerCleanupPending};
  }
  try{
   record=await read(request);
   try{await checkMutation(request,config,record.tokens.csrfToken);}catch{throw new AuthError('Request rejected.',403);}
   current=await fresh(record);({user}=await verified(current,record.row.user_id,record.row.provider_session_id));
   if(typeof password!=='string'||!password||password.length>1024)throw new AuthError('Password confirmation failed.',401);
   const scopes=await Promise.all([scopeHash('reauth-account',user.id,config.sessionKey),scopeHash('reauth-ip',String(clientIp),config.sessionKey)]);
   const limits=await Promise.all(scopes.map((hash,index)=>rpc('farm_auth_attempt',{p_scope_hash:hash,p_limit:index?20:5,p_window_seconds:900})));
   if(limits.some(value=>value!==true))throw new AuthError('Too many attempts. Wait before trying again.',429);
   if(effects)effect=await effects.begin('reauthenticate',scopes[0],{userId:user.id,email:user.email,parentSessionId:record.row.id});
   proof=await provider.signIn(user.email,password);
   proofProvider=claims(proof?.access_token,config).session_id;
   // Never revoke the original provider session if a provider unexpectedly reuses it.
   if(proofProvider===record.row.provider_session_id){proof=null;if(effect)await effects.release(effect,{cleaned:true});throw new AuthError('Fresh password confirmation is unavailable.',503);}
   if(effects)await effects.capture(effect,proof);
   cookieToken=newToken();newHash=await sessionDigest(cookieToken);csrfToken=newToken();
   const params={p_old_cookie_hash:record.hash,p_user_id:user.id,p_old_provider_session_id:record.row.provider_session_id,p_provider_session_id:proofProvider,p_cookie_hash:newHash,p_encrypted_credentials:await seal({...proof,csrfToken},config.sessionKey,newHash),p_csrf_hash:await sessionDigest(csrfToken)};
   pending=effects?await effects.stage(effect,params):await rpc('farm_session_reauth_prepare',params);
   if(!pending||pending.cookie_hash!==newHash||pending.user_id!==user.id||pending.provider_session_id!==proofProvider)throw reject();
   // Persist revoked cleanup work before the verification network call can fail.
   await verified(proof,user.id);
   finishing=true;
   const result=await rpc('farm_session_reauth_finish',{p_old_cookie_hash:record.hash,p_cookie_hash:newHash});
   if(!matches(result?.session))throw reject();
   let cleaned=false;
   try{const previous=result.previous;if(previous?.id===record.row.id&&previous.revoked_at&&previous.cookie_hash===record.hash)cleaned=await cleanup(previous,await unseal(previous.encrypted_credentials,config.sessionKey,record.hash));}catch{}
   return response(result.session,!cleaned);
  }catch(error){
   if(finishing)try{const confirmed=await rpc('farm_session_read',{p_cookie_hash:newHash});if(matches(confirmed))return response(confirmed,true);}catch{}
   let cleaned=false;
   if(proof){
    // Abort a staged row before cleanup, so a delayed finish cannot activate revoked credentials.
    let staged,canClean=!finishing;
    if(effects&&effect){const result=await effects.abort(effect);canClean=result?.safe===true;staged=result?.session;cleaned=result?.cleaned===true;}
    else if(newHash)try{staged=await rpc('farm_session_reauth_abort',{p_cookie_hash:newHash});canClean=Boolean(staged)||!finishing;}catch{}
    if(canClean&&!cleaned)try{cleaned=await cleanup(staged,proof);}catch{}
   }
   if(effect)await effects.release(effect,{cleaned,rejected:!proof&&[400,401,403,429].includes(error.status)});
   if(error instanceof AuthError&&[403,429].includes(error.status))throw error;
   if(error.status===400||error.status===401)throw new AuthError('Password confirmation failed. Check your password and try again.',401);
   throw new AuthError('Password confirmation is temporarily unavailable. Try again shortly.',503);
  }
 }
 async function logout(request){
  let record;
  try{record=await read(request);}catch(error){if(error.status===401)return {cookie:sessionCookie('',config),providerCleanupPending:false};throw new AuthError('Logout could not be completed. Try again.',503);}
  try{await checkMutation(request,config,record.tokens.csrfToken);}catch{throw new AuthError('Request rejected.',403);}
  const closed=await rpc('farm_session_close',{p_cookie_hash:record.hash});
  if(!closed)throw new AuthError('Logout could not be completed. Try again.',503);
  const cleaned=await cleanup(closed,record.tokens);
  return {cookie:sessionCookie('',config),providerCleanupPending:!cleaned};
 }
 return {login,authenticate,logout,reauthenticate};
}
