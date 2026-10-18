const deniedStatus=new Set([401,403]);
const serviceProbes=[
 ['farm_cleanup_claim',{p_owner:'11111111-1111-4111-8111-111111111111',p_limit:0},{status:400,code:'P0001',message:'Invalid cleanup batch.'}],
 ['farm_admin_list',{p_actor_cookie_hash:null},{status:[401,403],code:'42501',message:'Recent administrator confirmation required.'}],
 ['farm_media_reserve',{p_actor_cookie_hash:null,p_mime_type:'image/png',p_byte_size:12},{status:[401,403],code:'42501',message:'Active administrator session required.'}],
 ['farm_media_cleanup_claim',{p_owner:'11111111-1111-4111-8111-111111111111',p_limit:0},{status:400,code:'P0001',message:'Invalid media cleanup batch.'}],
];
const authenticatedOnly=['farm_content_list',{}];

function headers(key){const value={apikey:key,'Content-Type':'application/json',Accept:'application/json'};if(key.startsWith('eyJ'))value.Authorization=`Bearer ${key}`;return value;}
async function request(config,name,params,key,fetchImpl){
 let response;
 try{response=await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(key),body:JSON.stringify(params),redirect:'error',signal:AbortSignal.timeout(12000)});}
 catch{throw new Error('Stage 2 command access check could not connect; details withheld.');}
 let body;
 try{body=await response.json();}catch{throw new Error('Stage 2 command access response could not be verified; details withheld.');}
 return {status:response.status,body};
}
function matchesError(result,expected){return (Array.isArray(expected.status)?expected.status.includes(result.status):result.status===expected.status)&&result.body?.code===expected.code&&result.body?.message===expected.message;}
function isPermissionDenied(result){return deniedStatus.has(result.status)&&result.body?.code==='42501'&&typeof result.body?.message==='string'&&result.body.message.toLowerCase().includes('permission denied for function');}
function safeResultLabel(name,result){const code=typeof result?.body?.code==='string'&&/^[A-Z0-9]{1,10}$/.test(result.body.code)?result.body.code:'unclassified';return `${name} returned HTTP ${Number.isInteger(result?.status)?result.status:'unknown'} (${code}).`;}

// Uses invalid limits or a missing administrator session. SQL guards reject each
// service request before mutation. It never calls Auth or Storage and sends no email.
export async function probeStage2CommandAccess(config,{fetchImpl=fetch}={}){
 for(const [name,params,expected] of serviceProbes){
  const result=await request(config,name,params,config.secretKey,fetchImpl);if(!matchesError(result,expected))throw new Error(`Stage 2 service command boundary was not verified: ${safeResultLabel(name,result)} Details withheld.`);
 }
 for(const [name,params] of serviceProbes){
  const result=await request(config,name,params,config.publishableKey,fetchImpl);if(!isPermissionDenied(result))throw new Error(`Anonymous denial for a Stage 2 service command was not verified: ${safeResultLabel(name,result)} Details withheld.`);
 }
 const [name,params]=authenticatedOnly;
 const serviceResult=await request(config,name,params,config.secretKey,fetchImpl);if(!isPermissionDenied(serviceResult))throw new Error(`Content commands were not denied to the service role: ${safeResultLabel(name,serviceResult)} Details withheld.`);
 const anonymousResult=await request(config,name,params,config.publishableKey,fetchImpl);if(!isPermissionDenied(anonymousResult))throw new Error(`Content commands were not denied anonymously: ${safeResultLabel(name,anonymousResult)} Details withheld.`);
 return {serviceOnlyCommandsVerified:serviceProbes.length,authenticatedOnlyCommandDeniedToServiceRole:true,anonymousCommandsDenied:serviceProbes.length+1,persistedFixturesCreated:false,authProviderCalled:false,emailSent:false,scope:'Authorization/invalid-input HTTP checks only; no authenticated member/non-member, Storage object, provider, concurrency or email flow was exercised.'};
}
