import {newToken,sessionDigest,seal,unseal} from '../security.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const opaque=/^[A-Za-z0-9_-]{43}$/;
const providerHash=/^[A-Za-z0-9_-]{32,512}$/;
export class FirstAdminError extends Error {
 constructor(status=400){super(status===429?'Too many attempts. Try again later.':status===503?'Administrator setup is temporarily unavailable.':'Administrator setup could not be completed.');this.status=status;}
}
const deny=()=>new FirstAdminError();
const aad=row=>`first-admin:${row.id}:${row.generation}`;
const emailAddress=value=>{
 if(typeof value!=='string'||value.length>254)throw deny();
 const email=value.trim().toLowerCase();
 if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))throw deny();
 return email;
};
function summary(row,now){
 let state=row.state;
 if(['queued','sent'].includes(state))state=Date.parse(row.expires_at)<=now?'expired':row.issue_state==='review'?'needs_review':row.issue_state==='ready'?'ready_for_delivery':'pending';
 return {id:row.id,state,generation:row.generation,expiresAt:row.expires_at};
}
// This service never sends mail or grants an app session. Its RPCs must be service-only.
// Real provider calls are possible only for the explicit server caller; CLI/production routes stay closed.
export function createFirstAdminService(config,{provider,rpc,now=Date.now,effects,verifyLink,operations={}}){
 const verifyProviderLink=verifyLink||((tokenHash)=>provider.verifyInvite(tokenHash));
 const effectOperations={verify:'invite_verify',refresh:'invite_refresh',proof:'password_proof',...operations};
 async function guarded(work){
  try{return await work();}catch(error){if(error instanceof FirstAdminError)throw error;throw new FirstAdminError(503);}
 }
 async function read(id){if(!uuid.test(id||''))throw deny();const row=await rpc('farm_bootstrap_read',{p_id:id});if(!row)throw deny();return row;}
 async function release(id,owner){try{await rpc('farm_bootstrap_release',{p_id:id,p_owner:owner});}catch{/* Lease expires in the DB. Never hide the original outcome. */}}
 async function verified(tokens,row){
  if(typeof tokens?.access_token!=='string'||!tokens.access_token||typeof tokens.refresh_token!=='string'||!tokens.refresh_token)throw deny();
  const user=await provider.getUser(tokens.access_token);
  if(user?.id!==row.user_id||user.email?.toLowerCase()!==row.recipient_email||!user.email_confirmed_at)throw deny();
  return user;
 }
 async function attempts(id,ip){
  // Keyed scopes avoid storing raw account IDs/IP addresses in abuse counters.
  const key=await crypto.subtle.importKey('raw',Uint8Array.from(config.sessionKey.match(/../g),x=>parseInt(x,16)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  for(const [label,value,limit] of [['first-admin-link',id,5],['first-admin-ip',String(ip).slice(0,256),20]]){
   const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(label+'\0'+value)));
   const scope=btoa(String.fromCharCode(...digest)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
   if(await rpc('farm_auth_attempt',{p_scope_hash:scope,p_limit:limit,p_window_seconds:900})!==true)throw new FirstAdminError(429);
  }
 }
 const prepare=email=>guarded(async()=>{
  email=emailAddress(email);const nonce=newToken(),nonceHash=await sessionDigest(nonce);
  const row=await rpc('farm_bootstrap_prepare',{p_email:email,p_nonce_hash:nonceHash,p_encrypted_nonce:await seal({nonce},config.sessionKey,nonceHash)});
  if(!row||!uuid.test(row.id))throw new FirstAdminError(503);
  return summary(row,now());
 });
 const issue=id=>guarded(async()=>{
  if(!uuid.test(id||''))throw deny();const owner=crypto.randomUUID();
  const row=await rpc('farm_bootstrap_claim',{p_id:id,p_owner:owner,p_phase:'issue',p_nonce_hash:null});
  if(!row)throw deny();
  try{
   if(row.issue_state==='ready')return summary(row,now());
   const generated=await provider.generateInvite(row.recipient_email);
   if(!uuid.test(generated?.user?.id||'')||generated.user.email?.toLowerCase()!==row.recipient_email||!providerHash.test(generated.tokenHash||''))throw deny();
   const encrypted=await seal({tokenHash:generated.tokenHash},config.sessionKey,aad(row));
   if(await rpc('farm_bootstrap_issue_finish',{p_id:id,p_owner:owner,p_user_id:generated.user.id,p_encrypted_invite:encrypted})!==true)throw deny();
   return summary({...row,issue_state:'ready'},now());
  }finally{await release(id,owner);}
 });
 const status=id=>guarded(async()=>summary(await read(id),now()));
 const cancel=id=>guarded(async()=>{
  if(!uuid.test(id||'')||await rpc('farm_bootstrap_cancel',{p_id:id})!==true)throw deny();
  return {cancelled:true};
 });
 const accept=input=>guarded(async()=>{
  const {id,nonce,tokenHash,password,clientIp='unknown'}=input||{};
  if(!uuid.test(id||'')||!opaque.test(nonce||'')||!providerHash.test(tokenHash||'')||typeof password!=='string'||[...password].length<12||new TextEncoder().encode(password).length>72)throw deny();
  await attempts(id,clientIp);
  const nonceHash=await sessionDigest(nonce),owner=crypto.randomUUID();
  const row=await rpc('farm_bootstrap_claim',{p_id:id,p_owner:owner,p_phase:'accept',p_nonce_hash:nonceHash});
  if(!row){
   // A request whose response was lost may still hold the lease. Valid-link retries must not become terminal errors.
   const pending=await rpc('farm_bootstrap_read',{p_id:id});
   if(pending?.nonce_hash===nonceHash&&['queued','sent'].includes(pending.state)&&pending.issue_state==='ready'
    &&Date.parse(pending.expires_at)>now()&&new Date(pending.lease_until).getTime()>now())throw new FirstAdminError(503);
   throw deny();
  }
  let progress,probe;
  const tracked=[];
  async function begin(operation){if(!effects)return null;const item={effect:await effects.begin(operation,await sessionDigest(id),{invitationId:id,userId:row.user_id,email:row.recipient_email}),tokens:null,attached:false};tracked.push(item);return item;}
  async function capture(item,tokens){if(item){item.tokens=tokens;await effects.capture(item.effect,tokens);}}
  async function persist(value,item){const params={p_id:id,p_owner:owner,p_encrypted_credentials:await seal(value,config.sessionKey,aad(row))};
   const result=item?await effects.firstAdminProgress(item.effect,{p_id:id,p_invitation_owner:owner,p_encrypted_credentials:params.p_encrypted_credentials}):await rpc('farm_bootstrap_progress',params);
   if(result!==true)throw deny();if(item)item.attached=true;
  }
  try{
   const expected=await unseal(row.encrypted_invite,config.sessionKey,aad(row));
   if(expected.tokenHash!==tokenHash)throw deny();
   if(row.encrypted_credentials)progress=await unseal(row.encrypted_credentials,config.sessionKey,aad(row));
   else{
    const item=await begin(effectOperations.verify),invite=await verifyProviderLink(tokenHash);await capture(item,invite);
    try{await verified(invite,row);}catch(error){if(!effects)try{await provider.signOut(invite?.access_token);}catch{}throw error;}
    progress={invite};
    await persist(progress,item);
   }
   try{await verified(progress.invite,row);}catch(error){
    // Only a known provider invalidation permits refresh; outages do not trigger token rotation.
    if(![401,403].includes(error.status))throw error;
    const item=await begin(effectOperations.refresh),refreshed=await provider.refresh(progress.invite.refresh_token);await capture(item,refreshed);
    await verified(refreshed,row);
    progress={...progress,invite:refreshed};
    // Persist rotation under the existing DB lease before using the new credentials.
    await persist(progress,item);
   }
   // A timed-out password update may have succeeded. Password sign-in proves the selected password before activation.
   try{await provider.updatePassword(progress.invite.access_token,password);}catch{/* Require a successful password sign-in below, including on retries. */}
   const item=await begin(effectOperations.proof);probe=await provider.signIn(row.recipient_email,password);await capture(item,probe);
   await verified(probe,row);
   // A prior failed activation may have left a probe needing cleanup. Never overwrite its only durable copy.
   const previousProbes=[...(progress.previousProbes||[]),...(progress.probe?[progress.probe]:[])];
   progress={...progress,probe,previousProbes};
   await persist(progress,item);
   if(await rpc('farm_bootstrap_activate',{p_id:id,p_owner:owner,p_nonce_hash:nonceHash,p_generation:row.generation,p_user_id:row.user_id})!==true)throw deny();
   let cleaned=true;
   for(const tokens of [progress.invite,...progress.previousProbes,progress.probe])try{await provider.signOut(tokens.access_token);}catch{cleaned=false;}
   if(cleaned)try{await rpc('farm_bootstrap_cleanup_done',{p_id:id});}catch{cleaned=false;}
   return {activated:true,signInRequired:true,providerCleanupPending:!cleaned};
  }catch(error){
   // Keep the saved invite session available for a legitimate retry. The password probe grants no app access.
   if(effects){for(const item of tracked){if(item.attached)continue;let cleaned=false;
    if(item.tokens){const result=await effects.abort(item.effect);if(result?.safe)try{await provider.signOut(item.tokens.access_token);cleaned=true;}catch{}}
    await effects.release(item.effect,{cleaned,rejected:!item.tokens&&[400,401,403,429].includes(error.status)});
   }}else if(probe)try{await provider.signOut(probe.access_token);}catch{}
   throw error;
  }finally{await release(id,owner);}
 });
 return {prepare,issue,status,cancel,accept};
}
