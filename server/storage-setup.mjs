const id='farm-photographs';
const expected={id,public:false,file_size_limit:10485760,allowed_mime_types:['image/jpeg','image/png','image/webp']};
function matches(bucket){return bucket?.id===id&&bucket.public===false&&Number(bucket.file_size_limit)===expected.file_size_limit&&Array.isArray(bucket.allowed_mime_types)&&[...bucket.allowed_mime_types].sort().join(',')===[...expected.allowed_mime_types].sort().join(',');}
export async function configurePhotoBucket(config,{fetchImpl=fetch}={}){
 async function request(path,method='GET',body){
  const headers={apikey:config.secretKey,Accept:'application/json'};
  if(config.secretKey.startsWith('eyJ'))headers.Authorization=`Bearer ${config.secretKey}`;
  if(body)headers['Content-Type']='application/json';
  let response;
  try{response=await fetchImpl(config.supabaseUrl+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(12000),...(body?{body:JSON.stringify(body)}:{})});}
  catch{throw new Error('Storage setup connection failed; credentials and provider details withheld.');}
  if(!response.ok)throw new Error(`Storage setup request failed (HTTP ${response.status}); no provider details printed.`);
  try{return await response.json();}catch{throw new Error('Storage setup response could not be verified.');}
 }
 const schema=await request('/rest/v1/');
 if(!schema.paths?.['/farm_content'])throw new Error('Apply and verify the reviewed database foundation before creating Storage.');
 const buckets=await request('/storage/v1/bucket');
 if(!Array.isArray(buckets))throw new Error('Storage bucket list could not be verified.');
 const existing=buckets.find(bucket=>bucket.id===id);
 if(existing){if(!matches(existing))throw new Error('Existing photograph bucket differs from the reviewed private configuration; no changes made.');return {status:'already configured; unchanged',bucket:id,public:false};}
 await request('/storage/v1/bucket','POST',{...expected,name:id});
 const created=await request('/storage/v1/bucket/'+id);
 if(!matches(created))throw new Error('Photograph bucket creation was not verified. Inspect the selected project before proceeding.');
 return {status:'created and verified',bucket:id,public:false};
}
