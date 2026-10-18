// Server-only, read-only inspection. Never return raw provider errors or user records.
export async function inspectHostedProject(config,{fetchImpl=fetch}={}){
 async function get(path,key,label){
  const headers={apikey:key,Accept:'application/json'};
  if(key.startsWith('eyJ'))headers.Authorization=`Bearer ${key}`; // Legacy JWT keys only.
  let response;
  try{response=await fetchImpl(config.supabaseUrl+path,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(12000)});}
  catch{throw new Error(`Hosted project inspection could not reach ${label}. Check network access locally; credentials are withheld.`);}
  if(!response.ok)throw new Error(`Hosted project inspection failed at ${label} (HTTP ${response.status}).`);
  try{return await response.json();}catch{throw new Error(`Hosted project inspection received an invalid response at ${label}.`);}
 }
 const settings=await get('/auth/v1/settings',config.publishableKey,'Auth settings');
 await get('/auth/v1/admin/users?page=1&per_page=1',config.secretKey,'administrator API access');
 const buckets=await get('/storage/v1/bucket',config.secretKey,'Storage settings');
 const schema=await get('/rest/v1/',config.secretKey,'Data API schema');
 const photo=Array.isArray(buckets)?buckets.find(b=>b.id==='farm-photographs'):undefined;
 return {credentialsVerified:true,publicSignupDisabled:typeof settings.disable_signup==='boolean'?settings.disable_signup:null,anonymousSigninDisabled:typeof settings.external?.anonymous_users==='boolean'?!settings.external.anonymous_users:null,photoBucket:!photo?'not configured':photo.public===false?'private':'PUBLIC — must be corrected',editorSchemaPresent:!!schema.paths?.['/farm_content'],scope:'Read-only API inspection. RLS, session enforcement, email delivery and migrations are not verified by this check.'};
}
