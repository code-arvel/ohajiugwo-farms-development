import {AuthError} from './sessions.mjs';
import {newToken,sessionDigest,seal} from '../security.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const email=value=>typeof value==='string'&&value.length<=254&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
const failed=()=>new AuthError('Administrator operation could not be completed.',409);
function invitation(row,now){
 if(!row||!uuid.test(row.id||'')||!email(row.recipient_email)||!Number.isFinite(Date.parse(row.expires_at)))throw new AuthError('Administrator operation could not be completed.',503);
 const state=Date.parse(row.expires_at)<=now()?'expired':row.issue_state==='review'?'needs_review':row.issue_state==='ready'?'ready_for_delivery':'pending';
 return{id:row.id,email:row.recipient_email,state,expiresAt:row.expires_at};
}
function inventory(value){
 if(!value||!Array.isArray(value.admins)||!Array.isArray(value.invitations)||!Array.isArray(value.passwordResets)||value.admins.length>100||value.invitations.length>100||value.passwordResets.length>100)throw new AuthError('Administrator information is temporarily unavailable.',503);
 const admins=value.admins.map(row=>{
  if(!row||!uuid.test(row.id||'')||!email(row.email)||typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt)))throw new AuthError('Administrator information is temporarily unavailable.',503);
  return{id:row.id,email:row.email,createdAt:row.createdAt};
 });
 const invitations=value.invitations.map(row=>{
  if(!row||!uuid.test(row.id||'')||!email(row.email)||!['queued','sent'].includes(row.state)||!['new','issuing','ready','review'].includes(row.issueState)||!Number.isFinite(Date.parse(row.expiresAt)))throw new AuthError('Administrator information is temporarily unavailable.',503);
  return{id:row.id,email:row.email,state:row.state,issueState:row.issueState,expiresAt:row.expiresAt};
 });
 const passwordResets=value.passwordResets.map(row=>{
  if(!row||!uuid.test(row.id||'')||!uuid.test(row.userId||'')||!email(row.email)||row.state!=='queued'||!['new','issuing','ready','review'].includes(row.issueState)||!Number.isFinite(Date.parse(row.expiresAt)))throw new AuthError('Administrator information is temporarily unavailable.',503);
  return{id:row.id,userId:row.userId,email:row.email,state:row.state,issueState:row.issueState,expiresAt:row.expiresAt};
 });
 return{admins,invitations,passwordResets};
}
export function createAccountLifecycleService(configOrDependencies,maybeDependencies){
 const config=maybeDependencies?configOrDependencies:{};
 const {auth,rpc,provider,effects,now=Date.now}=maybeDependencies||configOrDependencies;
 async function actor(request,mutation=false){
  const result=await auth.authenticate(request,mutation?{requireRecent:true,requireMutation:true}:{requireRecent:true});
  if(!result?.cookieHash)throw new AuthError('Your session has ended. Sign in again.');
  return result;
 }
 return{
  async list(request){const current=await actor(request);try{return inventory(await rpc('farm_admin_list',{p_actor_cookie_hash:current.cookieHash}));}catch(error){if(error instanceof AuthError)throw error;throw new AuthError('Administrator information is temporarily unavailable.',503);}},
  async cancel(request,id){if(!uuid.test(id||''))throw new AuthError('Request rejected.',400);const current=await actor(request,true);try{if(await rpc('farm_admin_invite_cancel',{p_actor_cookie_hash:current.cookieHash,p_id:id})!==true)throw failed();return{cancelled:true};}catch(error){if(error instanceof AuthError)throw error;throw new AuthError('Administrator operation could not be completed.',503);}},
  async revoke(request,id){if(!uuid.test(id||''))throw new AuthError('Request rejected.',400);const current=await actor(request,true);try{if(await rpc('farm_admin_revoke',{p_actor_cookie_hash:current.cookieHash,p_target_id:id})!==true)throw failed();return{revoked:true};}catch(error){if(error instanceof AuthError)throw error;throw new AuthError('Administrator operation could not be completed.',503);}},
  async prepare(request,value){
   const current=await actor(request,true),recipient=typeof value==='string'?value.trim().toLowerCase():'';if(!email(recipient))throw new AuthError('Enter a valid email address.',400);
   try{const nonce=newToken(),nonceHash=await sessionDigest(nonce);
    const row=await rpc('farm_admin_invite_prepare',{p_actor_cookie_hash:current.cookieHash,p_email:recipient,p_nonce_hash:nonceHash,p_encrypted_nonce:await seal({nonce},config.sessionKey,nonceHash)});
    return invitation(row,now);
   }catch(error){if(error instanceof AuthError)throw error;throw new AuthError('Invitation could not be prepared.',503);}
  },
  async resend(request,id){
   if(!uuid.test(id||''))throw new AuthError('Request rejected.',400);const current=await actor(request,true);
   try{const nonce=newToken(),nonceHash=await sessionDigest(nonce),row=await rpc('farm_admin_invite_resend',{p_actor_cookie_hash:current.cookieHash,p_id:id,p_nonce_hash:nonceHash,p_encrypted_nonce:await seal({nonce},config.sessionKey,nonceHash)});return invitation(row,now);}
   catch(error){if(error instanceof AuthError)throw error;throw new AuthError('Invitation could not be renewed.',503);}
  },
  async issue(request,id){
   if(!uuid.test(id||''))throw new AuthError('Request rejected.',400);const current=await actor(request,true);
   if(config.accountInviteIssueEnabled!==true||!provider||!effects||!config?.sessionKey)throw new AuthError('Invitation services are temporarily unavailable.',503);
   const owner=crypto.randomUUID();let row,effect,captured=false;
   try{
    row=await rpc('farm_admin_invite_claim',{p_actor_cookie_hash:current.cookieHash,p_id:id,p_owner:owner});
    if(!row){const existing=await rpc('farm_invitation_read',{p_id:id});if(existing?.invited_by===current.user.id&&existing.issue_state==='ready')return invitation(existing,now);throw failed();}
    effect=await effects.begin('invite_issue',await sessionDigest(id),{invitationId:id,userId:row.user_id||null,email:row.recipient_email});
    const generated=await provider.generateInvite(row.recipient_email);
    if(!uuid.test(generated?.user?.id||'')||generated.user.email?.toLowerCase()!==row.recipient_email||typeof generated.tokenHash!=='string'||!/^[-A-Za-z0-9_]{32,512}$/.test(generated.tokenHash))throw failed();
    await effects.capture(effect,{tokenHash:generated.tokenHash});captured=true;
    const encrypted=await seal({tokenHash:generated.tokenHash},config.sessionKey,`first-admin:${id}:${row.generation}`);
    if(await rpc('farm_admin_invite_issue_effect_finish',{p_effect_id:effect.id,p_effect_owner:effect.owner,p_actor_cookie_hash:current.cookieHash,p_id:id,p_invitation_owner:owner,p_user_id:generated.user.id,p_encrypted_invite:encrypted})!==true)throw failed();
    return invitation({...row,user_id:generated.user.id,issue_state:'ready',state:'queued'},now);
   }catch(error){
    if(effect)try{if(captured)await rpc('farm_admin_invite_issue_effect_review',{p_effect_id:effect.id,p_effect_owner:effect.owner});else await effects.release(effect,{rejected:[400,401,403,409].includes(error?.status)});}catch{}
    if(error instanceof AuthError&&error.status===409)throw error;
    throw new AuthError('Invitation could not be prepared. Review the invitation list before retrying.',503);
   }finally{if(row)try{await rpc('farm_admin_invite_release',{p_id:id,p_owner:owner});}catch{}}
  },
  async prepareReset(request,userId){
   if(!uuid.test(userId||''))throw new AuthError('Request rejected.',400);const current=await actor(request,true);
   try{const nonce=newToken(),nonceHash=await sessionDigest(nonce),row=await rpc('farm_admin_reset_prepare',{p_actor_cookie_hash:current.cookieHash,p_user_id:userId,p_nonce_hash:nonceHash,p_encrypted_nonce:await seal({nonce},config.sessionKey,nonceHash)});return invitation(row,now);}
   catch(error){if(error instanceof AuthError)throw error;throw new AuthError('Password recovery could not be prepared.',503);}
  },
  async issueReset(request,id){
   if(!uuid.test(id||''))throw new AuthError('Request rejected.',400);const current=await actor(request,true);
   if(config.accountRecoveryIssueEnabled!==true||!provider?.generateRecovery||!effects||!config?.sessionKey)throw new AuthError('Password recovery services are temporarily unavailable.',503);
   const owner=crypto.randomUUID();let row,effect,captured=false;
   try{
    row=await rpc('farm_admin_reset_claim',{p_actor_cookie_hash:current.cookieHash,p_id:id,p_owner:owner});
    if(!row){const existing=await rpc('farm_invitation_read',{p_id:id});if(existing?.purpose==='password_reset'&&existing.invited_by===current.user.id&&existing.issue_state==='ready')return invitation(existing,now);throw failed();}
    effect=await effects.begin('reset_issue',await sessionDigest(id),{resetId:id,userId:row.user_id,email:row.recipient_email});
    const generated=await provider.generateRecovery(row.recipient_email);
    if(generated?.user?.id!==row.user_id||generated.user.email?.toLowerCase()!==row.recipient_email||typeof generated.tokenHash!=='string'||!/^[-A-Za-z0-9_]{32,512}$/.test(generated.tokenHash))throw failed();
    await effects.capture(effect,{tokenHash:generated.tokenHash});captured=true;
    const encrypted=await seal({tokenHash:generated.tokenHash},config.sessionKey,`first-admin:${id}:${row.generation}`);
    if(await rpc('farm_admin_reset_issue_effect_finish',{p_effect_id:effect.id,p_effect_owner:effect.owner,p_actor_cookie_hash:current.cookieHash,p_id:id,p_reset_owner:owner,p_user_id:row.user_id,p_encrypted_recovery:encrypted})!==true)throw failed();
    return invitation({...row,issue_state:'ready',state:'queued'},now);
   }catch(error){
    if(effect)try{if(captured)await rpc('farm_admin_reset_issue_effect_review',{p_effect_id:effect.id,p_effect_owner:effect.owner});else await effects.release(effect,{rejected:[400,401,403,409].includes(error?.status)});}catch{}
    if(error instanceof AuthError&&error.status===409)throw error;
    throw new AuthError('Password recovery could not be prepared. Review the account list before retrying.',503);
   }finally{if(row)try{await rpc('farm_admin_reset_release',{p_id:id,p_owner:owner});}catch{}}
  },
  async cancelReset(request,id){if(!uuid.test(id||''))throw new AuthError('Request rejected.',400);const current=await actor(request,true);try{if(await rpc('farm_admin_reset_cancel',{p_actor_cookie_hash:current.cookieHash,p_id:id})!==true)throw failed();return{cancelled:true};}catch(error){if(error instanceof AuthError)throw error;throw new AuthError('Password recovery could not be cancelled.',503);}},
 };
}
