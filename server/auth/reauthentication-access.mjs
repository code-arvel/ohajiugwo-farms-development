// HTTP exposure/grant check for NEW 004 commands only. No Auth calls or persisted fixtures.
// NULL equality never matches a session. prepare rejects NULL before locks/inserts.
export async function probeReauthenticationAccess(config,{fetchImpl=fetch}={}){
 const commands=[
  ['farm_session_reauth_prepare',{p_old_cookie_hash:null,p_user_id:null,p_old_provider_session_id:null,p_provider_session_id:null,p_cookie_hash:null,p_encrypted_credentials:null,p_csrf_hash:null}],
  ['farm_session_reauth_finish',{p_old_cookie_hash:null,p_cookie_hash:null}],
  ['farm_session_reauth_abort',{p_cookie_hash:null}],
 ];
 async function request(name,params,key){
  const headers={apikey:key,'Content-Type':'application/json',Accept:'application/json'};if(key.startsWith('eyJ'))headers.Authorization=`Bearer ${key}`;
  try{const response=await fetchImpl(config.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(params),redirect:'error',signal:AbortSignal.timeout(12000)});return {status:response.status,body:await response.json()};}
  catch{throw new Error('Reauthentication HTTP check could not be verified; private details withheld.');}
 }
 for(const [name,params] of commands){
  const service=await request(name,params,config.secretKey);
  const expected=name.endsWith('_prepare')?service.status===400&&service.body?.code==='P0001'&&service.body?.message==='Invalid password confirmation input.':service.status===200&&service.body===null;
  if(!expected)throw new Error('Service access to a new reauthentication command was not verified.');
  const anonymous=await request(name,params,config.publishableKey);
  if(!([401,403].includes(anonymous.status)&&anonymous.body?.code==='42501')&&!(anonymous.status===404&&anonymous.body?.code==='PGRST202'))throw new Error('Anonymous reauthentication command denial was not verified.');
 }
 return {serviceCommandsVerified:3,anonymousCommandsDenied:3,persistedFixturesCreated:false,scope:'New 004 HTTP command exposure/access only; not provider/password/browser, authenticated non-member, concurrency or cleanup verification.'};
}
