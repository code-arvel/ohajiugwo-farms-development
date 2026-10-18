import {createFirstAdminService} from './first-admin.mjs';

// Additional administrators share the audited recipient/password acceptance
// workflow; only their SQL lease/activation commands differ from bootstrap.
export function createAdditionalAdminAcceptanceService(config,{provider,rpc,effects,now=Date.now}){
 const mappedRpc=async(name,params)=>{
  switch(name){
   case 'farm_bootstrap_read':return rpc('farm_invitation_read',{p_id:params.p_id});
   case 'farm_bootstrap_claim':
    if(params.p_phase!=='accept')return null;
    return rpc('farm_admin_invite_accept_claim',{p_id:params.p_id,p_owner:params.p_owner,p_nonce_hash:params.p_nonce_hash});
   case 'farm_bootstrap_progress':return rpc('farm_admin_invite_accept_progress',{p_id:params.p_id,p_owner:params.p_owner,p_encrypted_credentials:params.p_encrypted_credentials});
   case 'farm_bootstrap_activate':return rpc('farm_admin_invite_activate',{p_id:params.p_id,p_owner:params.p_owner,p_nonce_hash:params.p_nonce_hash,p_generation:params.p_generation,p_user_id:params.p_user_id});
   case 'farm_bootstrap_release':return rpc('farm_admin_invite_release',{p_id:params.p_id,p_owner:params.p_owner});
   case 'farm_bootstrap_cleanup_done':return rpc('farm_admin_invite_cleanup_done',{p_id:params.p_id});
   default:return rpc(name,params);
  }
 };
 const acceptanceEffects=effects?{
  ...effects,
  firstAdminProgress:(effect,params)=>rpc('farm_admin_invite_accept_effect_progress',{p_effect_id:effect.id,p_effect_owner:effect.owner,p_id:params.p_id,p_invitation_owner:params.p_owner,p_encrypted_credentials:params.p_encrypted_credentials}),
 }:undefined;
 const acceptance=createFirstAdminService(config,{provider,rpc:mappedRpc,effects:acceptanceEffects,now});
 return{accept:input=>acceptance.accept(input)};
}

export function createPasswordResetAcceptanceService(config,{provider,rpc,effects,now=Date.now}){
 const mappedRpc=async(name,params)=>{
  switch(name){
   case 'farm_bootstrap_read':return rpc('farm_invitation_read',{p_id:params.p_id});
   case 'farm_bootstrap_claim':
    if(params.p_phase!=='accept')return null;
    return rpc('farm_admin_reset_accept_claim',{p_id:params.p_id,p_owner:params.p_owner,p_nonce_hash:params.p_nonce_hash});
   case 'farm_bootstrap_progress':return rpc('farm_admin_reset_accept_progress',{p_id:params.p_id,p_owner:params.p_owner,p_encrypted_credentials:params.p_encrypted_credentials});
   case 'farm_bootstrap_activate':return rpc('farm_admin_reset_activate',{p_id:params.p_id,p_owner:params.p_owner,p_nonce_hash:params.p_nonce_hash,p_generation:params.p_generation,p_user_id:params.p_user_id});
   case 'farm_bootstrap_release':return rpc('farm_admin_reset_release',{p_id:params.p_id,p_owner:params.p_owner});
   case 'farm_bootstrap_cleanup_done':return rpc('farm_admin_invite_cleanup_done',{p_id:params.p_id});
   default:return rpc(name,params);
  }
 };
 const acceptanceEffects=effects?{
  ...effects,
  firstAdminProgress:(effect,params)=>rpc('farm_admin_reset_accept_effect_progress',{p_effect_id:effect.id,p_effect_owner:effect.owner,p_id:params.p_id,p_reset_owner:params.p_owner,p_encrypted_credentials:params.p_encrypted_credentials}),
 }:undefined;
 const acceptance=createFirstAdminService(config,{provider,rpc:mappedRpc,effects:acceptanceEffects,now,verifyLink:tokenHash=>provider.verifyRecovery(tokenHash),operations:{verify:'reset_verify',refresh:'reset_refresh',proof:'reset_proof'}});
 return{accept:input=>acceptance.accept(input)};
}

export function createInvitationAcceptanceService(config,{provider,rpc,effects,now=Date.now,firstAdmin}){
 const bootstrap=firstAdmin||createFirstAdminService(config,{provider,rpc,effects,now});
 const additional=createAdditionalAdminAcceptanceService(config,{provider,rpc,effects,now});
 const reset=createPasswordResetAcceptanceService(config,{provider,rpc,effects,now});
 return{
  async accept(input){
   const row=await rpc('farm_invitation_read',{p_id:input?.id});
   if(row?.purpose==='password_reset')return reset.accept(input);
   return row?.invited_by?additional.accept(input):bootstrap.accept(input);
  },
 };
}
