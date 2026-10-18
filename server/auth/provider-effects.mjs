import {seal} from '../security.mjs';
// Durable write-ahead intent. The live composition requires this before credential-producing calls.
export function createProviderEffects(config,{rpc}){
 return {
  async begin(operation,scope,context){
   const id=crypto.randomUUID(),owner=crypto.randomUUID();
   const row=await rpc('farm_effect_begin',{p_id:id,p_scope_hash:scope,p_operation:operation,p_owner:owner,p_encrypted_context:await seal(context,config.sessionKey,'effect-context:'+id)});
   if(row?.id!==id||row.owner!==owner||row.state!=='started')throw new Error('Provider operation requires reconciliation.');
   return {id,owner};
  },
  async capture(effect,tokens){
   if(await rpc('farm_effect_capture',{p_id:effect.id,p_owner:effect.owner,p_encrypted_credentials:await seal(tokens,config.sessionKey,'provider-effect:'+effect.id)})!==true)throw new Error('Provider result could not be durably recorded.');
  },
  async abort(effect){try{return await rpc('farm_effect_abort',{p_id:effect.id,p_owner:effect.owner});}catch{return {safe:false};}},
  firstAdminProgress(effect,params){return rpc('farm_effect_bootstrap_progress',{p_effect_id:effect.id,p_owner:effect.owner,...params});},
  open(effect,params){return rpc('farm_effect_session_open',{p_effect_id:effect.id,p_owner:effect.owner,...params});},
  stage(effect,params){return rpc('farm_effect_session_stage',{p_effect_id:effect.id,p_owner:effect.owner,...params});},
  async release(effect,{cleaned=false,rejected=false}={}){
   try{return await rpc(cleaned?'farm_effect_cleaned':'farm_effect_release',{p_id:effect.id,p_owner:effect.owner,...(cleaned?{}:{p_known_rejected:rejected})});}catch{return false;}
  },
 };
}
