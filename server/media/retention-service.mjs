import {AuthError} from '../auth/sessions.mjs';
export function createRetentionService({auth,provider}){
 return{async prepare(request){
  const current=await auth.authenticate(request,{requireMutation:true});if(typeof current?.accessToken!=='string'||!current.accessToken)throw new AuthError('Your session has ended. Sign in again.',401);
  let plan;try{plan=await provider.userRpc('farm_media_retention_prepare',{},current.accessToken);}catch(error){throw new AuthError('The retention plan could not be prepared.',error?.code==='42501'?401:503);}
  if(!plan||typeof plan.id!=='string'||plan.preparedOnly!==true||plan.deleteEnabled!==false||!Array.isArray(plan.expiredRevisionIds)||!Array.isArray(plan.purgeMediaIds))throw new AuthError('The retention plan could not be prepared.',503);
  return plan;
 }};
}
