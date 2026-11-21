import {unseal} from './security.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reasons=new Set(['expired_jwt','session_not_found','rejected','unavailable','verified']);
// Supabase supports legacy {code:HTTP-status,error_code,msg} and versioned {code,message} responses.
// Return only a closed classification; never return provider body text.
export function classifyCleanupProviderResponse(status,data){
 if(!Number.isInteger(status)||status<100||status>599)return{status:null,reason:'unavailable'};
 if(status>=200&&status<300)return{status,reason:'verified'};
 const code=typeof data?.error_code==='string'?data.error_code:typeof data?.code==='string'?data.code:null;
 const reason=code==='session_not_found'?'session_not_found':code==='bad_jwt'&&/expired/i.test(String(data?.msg||data?.message||''))?'expired_jwt':status>=500?'unavailable':'rejected';
 return{status,reason};
}
// Maintainer-only read path. Never refresh, revoke, claim, acknowledge or requeue.
export async function inspectCleanupReview(config,{rpc,inspectToken,now=Date.now,limit=5}){
 if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('Invalid review limit.');
 const rows=await rpc('farm_cleanup_review_read',{p_limit:limit});
 if(!Array.isArray(rows)||rows.length>limit)throw Error('Review inventory unavailable.');
 const jobs=[];
 for(const row of rows){
  if(!uuid.test(row?.id||'')||row.source_kind!=='session'||row.state!=='review')throw Error('Review inventory unavailable.');
  const report={id:row.id,sourceKind:'session',appSessionRevoked:row.source_revoked===true,sourceMatches:row.source_matches===true,payloadReadable:false,identityMatches:null,accessExpired:null,providerStatus:null,providerReason:null};
  let access;
  try{
   const payload=await unseal(row.encrypted_credentials,config.sessionKey,row.aad);report.payloadReadable=true;
   access=payload.access_token;if(typeof access!=='string'||access.length>16000)throw Error();
   const parts=access.split('.');if(parts.length!==3)throw Error();
   const claims=JSON.parse(atob(parts[1].replaceAll('-','+').replaceAll('_','/')));
   report.identityMatches=claims.sub===row.source_user_id&&claims.session_id===row.provider_session_id&&uuid.test(claims.sub||'')&&uuid.test(claims.session_id||'');
   report.accessExpired=Number.isFinite(claims.exp)?claims.exp<=now()/1000:null;
   // Local JWT parsing is diagnostic only; only the provider verifies authenticity.
   if(report.appSessionRevoked&&report.sourceMatches&&report.identityMatches){
    try{const result=await inspectToken(access);report.providerStatus=Number.isInteger(result?.status)&&result.status>=100&&result.status<=599?result.status:null;report.providerReason=reasons.has(result?.reason)?result.reason:'unavailable';}catch{report.providerReason='unavailable';}
   }
  }catch{/* Keep the record under review; never expose its contents or exception. */}
  access=null;jobs.push(report);
 }
 return{jobs,scope:'Read-only review inspection. No cleanup acknowledgement, refresh or session revocation.'};
}
