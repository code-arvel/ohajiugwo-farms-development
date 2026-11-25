const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
// Consistency checks on the authenticated provider payload retained in sealed storage.
// This does not verify a JWT signature. The SQL command independently binds the
// identity to a revoked source, owned cleanup job, and actual provider session.
export function expiredCleanupSessionIdentity(accessToken,supabaseUrl,now){
 try{
  if(typeof accessToken!=='string'||accessToken.length>16000||typeof supabaseUrl!=='string'||!Number.isFinite(now))return null;
  const parts=accessToken.split('.');if(parts.length!==3)return null;
  const payload=JSON.parse(atob(parts[1].replaceAll('-','+').replaceAll('_','/')));
  if(!uuid.test(payload?.sub||'')||!uuid.test(payload?.session_id||'')||payload.iss!==supabaseUrl+'/auth/v1'||!Number.isSafeInteger(payload.exp)||payload.exp<=0||payload.exp*1000>now)return null;
  return{userId:payload.sub,providerSessionId:payload.session_id,expiresAt:new Date(payload.exp*1000).toISOString()};
 }catch{return null;}
}
