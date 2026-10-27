import {AuthError} from './sessions.mjs';
// Server-only REST adapter. Public browser code never imports this module.
export function createHostedAuthProvider(config,{fetchImpl=fetch}={}){
 async function request(path,{method='POST',body,token,privileged=false}={}){
  const key=privileged?config.secretKey:config.publishableKey,headers={apikey:key,Accept:'application/json'};
  if(token)headers.Authorization=`Bearer ${token}`;
  else if(key.startsWith('eyJ'))headers.Authorization=`Bearer ${key}`;
  if(body!==undefined)headers['Content-Type']='application/json';
  let response;
  try{response=await fetchImpl(config.supabaseUrl+path,{method,headers,redirect:'manual',signal:AbortSignal.timeout(12000),...(body!==undefined?{body:JSON.stringify(body)}:{})});}
  catch(error){
   const failure=new AuthError('Authentication service is temporarily unavailable.',503);failure.failureKind='transport';failure.transportType=['TypeError','TimeoutError','AbortError'].includes(error?.name)?error.name:'other';
   const text=typeof error?.message==='string'?error.message:'';
   failure.transportReason=/illegal invocation/i.test(text)?'illegal_invocation':/header|bytestring|byte string/i.test(text)?'invalid_header':/url/i.test(text)?'invalid_url':/dns|resolve|hostname/i.test(text)?'dns':/tls|ssl|certificate/i.test(text)?'tls':/fetch failed|failed to fetch/i.test(text)?'fetch_failed':/timeout|timed out/i.test(text)?'timeout':'other';
   throw failure;
  }
  if(!response.ok){const failure=new AuthError('Authentication request could not be completed.',response.status);failure.failureKind='http';throw failure;}
  if(response.status===204)return null;
  const text=await response.text();if(!text)return null;
  try{return JSON.parse(text);}catch{throw new AuthError('Authentication response could not be verified.',503);}
 }
 return {
  // Generating an invite can create an Auth identity. Never call during local tests without an injected transport.
  generateInvite:async email=>{
   const redirect=config.origin+'/admin/accept';
   const result=await request('/auth/v1/admin/generate_link?redirect_to='+encodeURIComponent(redirect),{privileged:true,body:{type:'invite',email}});
   if(result?.verification_type!=='invite'||typeof result.hashed_token!=='string')throw new AuthError('Invitation response could not be verified.',503);
   return {user:{id:result.id,email:result.email},tokenHash:result.hashed_token};
  },
  // Unlike generateInvite, this endpoint sends through Supabase Auth's configured
  // sender. The email template must append {{ .TokenHash }} to {{ .RedirectTo }};
  // it never returns the action link or token to this process.
  inviteUserByEmail:async(email,redirectTo)=>{
   const result=await request('/auth/v1/invite?redirect_to='+encodeURIComponent(redirectTo),{privileged:true,body:{email}});
   const user=result?.user||result;
   if(!user||typeof user.id!=='string'||typeof user.email!=='string')throw new AuthError('Invitation response could not be verified.',503);
   return {user:{id:user.id,email:user.email}};
  },
  generateRecovery:async email=>{
   const redirect=config.origin+'/admin/accept';
   const result=await request('/auth/v1/admin/generate_link?redirect_to='+encodeURIComponent(redirect),{privileged:true,body:{type:'recovery',email}});
   if(result?.verification_type!=='recovery'||typeof result.hashed_token!=='string')throw new AuthError('Recovery response could not be verified.',503);
   return {user:{id:result.id,email:result.email},tokenHash:result.hashed_token};
  },
  verifyInvite:tokenHash=>request('/auth/v1/verify',{body:{type:'invite',token_hash:tokenHash}}),
  verifyRecovery:tokenHash=>request('/auth/v1/verify',{body:{type:'recovery',token_hash:tokenHash}}),
  updatePassword:(token,password)=>request('/auth/v1/user',{method:'PUT',token,body:{password}}),
  signIn:(email,password)=>request('/auth/v1/token?grant_type=password',{body:{email,password}}),
  getUser:token=>request('/auth/v1/user',{method:'GET',token}),
  refresh:refresh_token=>request('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token}}),
  signOut:token=>request('/auth/v1/logout?scope=local',{token}),
  rpc:(name,params)=>{
   if(!/^farm_[a-z0-9_]{1,70}$/.test(name))return Promise.reject(new AuthError('Invalid server operation.',400));
   return request('/rest/v1/rpc/'+name,{privileged:true,body:params});
  },
  userRpc:(name,params,accessToken)=>{
   if(!/^farm_[a-z0-9_]{1,70}$/.test(name)||typeof accessToken!=='string'||!accessToken)return Promise.reject(new AuthError('Invalid authenticated operation.',400));
   return request('/rest/v1/rpc/'+name,{body:params,token:accessToken});
  },
 };
}
