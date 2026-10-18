const content=new TextEncoder().encode('ohajiugwo-private-storage-probe');
function headers(key){const value={apikey:key,Accept:'application/json'};if(key.startsWith('eyJ'))value.Authorization=`Bearer ${key}`;return value;}
function hidden(){return new Error('Private Storage access boundary could not be verified; details withheld.');}
async function safeCategory(response){try{const body=await response.clone().json();for(const key of ['code','statusCode','error']){const value=body?.[key];if((typeof value==='string'||typeof value==='number')&&/^[A-Za-z0-9_-]{1,40}$/.test(String(value)))return `${key}=${value}`;}}catch{}return 'no-safe-error-code';}
function deniedObjectRead(response,category){return [401,403].includes(response.status)||(response.status===400&&category==='code=NoSuchKey')||(response.status===404&&['code=not_found','error=not_found','statusCode=404'].includes(category));}

export async function probePrivateStorageAccess(config,{fetchImpl=fetch,uuid=()=>crypto.randomUUID()}={}){
 const path=`staging/${uuid()}/source`,encoded=path.split('/').map(encodeURIComponent).join('/');
 const objectUrl=`${config.supabaseUrl}/storage/v1/object/farm-photographs/${encoded}`;
 const authenticatedUrl=`${config.supabaseUrl}/storage/v1/object/authenticated/farm-photographs/${encoded}`;
 const service=headers(config.secretKey),anonymous=headers(config.publishableKey);
 let cleanupRequired=false,accessVerified=false,phase='upload',lastStatus,lastCategory;
 try{
  let response;
  cleanupRequired=true; // The upload outcome may be lost after Storage commits it.
  try{response=await fetchImpl(objectUrl,{method:'POST',headers:{...service,'Content-Type':'image/png','x-upsert':'false'},body:content,redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw hidden();}lastStatus=response.status;
  if(!response.ok)throw hidden();
  phase='service-object-check';try{response=await fetchImpl(authenticatedUrl,{headers:service,redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw hidden();}lastStatus=response.status;
  if(!response.ok)throw hidden();
  let stored;try{stored=new Uint8Array(await response.arrayBuffer());}catch{throw hidden();}
  if(stored.length!==content.length||stored.some((byte,index)=>byte!==content[index]))throw hidden();
  phase='anonymous-object-read';try{response=await fetchImpl(authenticatedUrl,{headers:anonymous,redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw hidden();}lastStatus=response.status;lastCategory=await safeCategory(response);
  if(!deniedObjectRead(response,lastCategory)){try{await response.body?.cancel();}catch{}throw hidden();}
  try{await response.body?.cancel();}catch{}
  accessVerified=true;
 }catch{
  accessVerified=false;
 }
 if(cleanupRequired){
  try{
   const response=await fetchImpl(`${config.supabaseUrl}/storage/v1/object/farm-photographs`,{method:'DELETE',headers:{...service,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]}),redirect:'error',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw new Error();
   const check=await fetchImpl(authenticatedUrl,{headers:service,redirect:'error',signal:AbortSignal.timeout(12000)});
   if(![400,404].includes(check.status)){try{await check.body?.cancel();}catch{}throw new Error();}
   try{await check.body?.cancel();}catch{}
  }catch{throw new Error(`Temporary Storage test object cleanup could not be verified. Remove ${path} from the farm-photographs bucket.`);}
 }
 if(!accessVerified){const outcome=Number.isInteger(lastStatus)?`${phase} returned HTTP ${lastStatus}${lastCategory?` (${lastCategory})`:''}`:`${phase} connection failed`;throw new Error(`Private Storage access boundary was not verified (${outcome}); temporary object removed when upload succeeded.`);}
 return {privateBucketAnonymousReadDenied:true,temporaryObjectDeleted:true,accountCreated:false,authProviderCalled:false,emailSent:false,scope:'Anonymous direct-object read denial only; authenticated non-member access, application preview, Images binding and concurrent Storage behavior remain unverified.'};
}
