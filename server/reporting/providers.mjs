// Server-only adapters. Never import into public/browser bundles.
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function requestJson(fetcher,url,init,{sleep=wait}={}){
 for(let attempt=0;attempt<3;attempt++){
  try{const response=await fetcher(url,{...init,signal:AbortSignal.timeout(8000),redirect:'error'});if(response.ok)return await response.json();if(response.status!==429&&response.status<500)throw Object.assign(new Error('Provider request rejected.'),{permanent:true});}catch(error){if(error.permanent||attempt===2)throw new Error('Provider unavailable.');}
  if(attempt===2)throw new Error('Provider unavailable.');await sleep(250*2**attempt);
 }
}
function cached(source,load,{now=Date.now,cacheMs=300000,maxEntries=32}={}){
 const entries=new Map(),pending=new Map();return {async read(range){const key=JSON.stringify(range||{}),old=entries.get(key);if(old&&now()-old.cachedAt<cacheMs)return structuredClone(old.value);if(pending.has(key))return structuredClone(await pending.get(key));const task=(async()=>{try{const result=await load(range);const value={source,observedAt:new Date(now()).toISOString(),...result};if(entries.size>=maxEntries)entries.delete(entries.keys().next().value);entries.set(key,{cachedAt:now(),value});return value;}catch{return old?{...old.value,state:'stale',refreshFailed:true}:{source,state:'error',observedAt:null};}finally{pending.delete(key);}})();pending.set(key,task);return structuredClone(await task);}};
}
const number=value=>{const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error('Invalid metric.');return n;};
function cells(report,dimensions,metrics){return (report.rows||[]).map(row=>{if(row.dimensionValues?.length!==dimensions||row.metricValues?.length!==metrics)throw new Error('Invalid report.');return {dimensions:row.dimensionValues.map(item=>String(item.value)),metrics:row.metricValues.map(item=>number(item.value))};});}
const safePath=value=>/^\/(?!\/)/.test(value)&&!/^\/(admin|preview|draft|test)(?:\/|$)/i.test(value)&&!/[?#@\s]/.test(value);
export function createGA4Adapter({propertyId,getAccessToken,fetcher=fetch,now=Date.now,sleep=wait,cacheMs=300000}={}){
 if(!/^\d+$/.test(propertyId||'')||typeof getAccessToken!=='function')throw new Error('GA4 server configuration required.');
 return cached('GA4 Data API',async range=>{
  const dateRanges=[{...range.current,name:'current'},{...range.previous,name:'previous'}];
  const base={dateRanges,limit:'20',dimensionFilter:{notExpression:{filter:{fieldName:'pagePath',stringFilter:{matchType:'FULL_REGEXP',value:'/(admin|preview|draft|test)(/.*)?'}}}}};
  const requests=[{...base,metrics:[{name:'sessions'},{name:'screenPageViews'}]}, {...base,dimensions:[{name:'pagePath'}],metrics:[{name:'screenPageViews'}],orderBys:[{metric:{metricName:'screenPageViews'},desc:true}]},{...base,dimensions:[{name:'sessionSource'}],metrics:[{name:'sessions'}],orderBys:[{metric:{metricName:'sessions'},desc:true}]},{...base,dimensions:[{name:'customEvent:placement'}],metrics:[{name:'eventCount'}],dimensionFilter:{andGroup:{expressions:[base.dimensionFilter,{filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:'email_click'}}}]}}}];
  const token=await getAccessToken();if(typeof token!=='string'||!token)throw new Error('Token unavailable.');
  const result=await requestJson(fetcher,`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({requests})},{sleep});
  if(!Array.isArray(result.reports)||result.reports.length!==4)throw new Error('Incomplete report.');
  for(const report of result.reports)if(report.metadata?.timeZone&&report.metadata.timeZone!=='Africa/Lagos')throw new Error('Property timezone must be Africa/Lagos.');
  const totals=cells(result.reports[0],1,2),data={current:{sessions:0,views:0},previous:{sessions:0,views:0}};
  for(const row of totals){const period=row.dimensions[0];if(!(period in data))throw new Error('Invalid date range.');data[period]={sessions:row.metrics[0],views:row.metrics[1]};}
  for(const [index,key] of [[1,'topPages'],[2,'referrers'],[3,'emailClicks']])data[key]=cells(result.reports[index],2,1).filter(row=>['current','previous'].includes(row.dimensions[1])&&(key!=='topPages'||safePath(row.dimensions[0]))&&(key!=='referrers'||/^[a-zA-Z0-9.() _-]{1,160}$/.test(row.dimensions[0]))&&(key!=='emailClicks'||['header','hero','about','products','contact','footer'].includes(row.dimensions[0]))).map(row=>({label:row.dimensions[0].slice(0,160),period:row.dimensions[1],count:row.metrics[0]}));
  return {state:totals.some(row=>row.metrics.some(Boolean))?'fresh':'empty',data,limited:true};
 },{now,cacheMs});
}
export function createBetterStackAdapter({monitorId,token,fetcher=fetch,now=Date.now,sleep=wait}={}){
 if(!/^\d+$/.test(monitorId||'')||!token)throw new Error('Monitor server configuration required.');
 return cached('Better Stack',async()=>{const result=await requestJson(fetcher,`https://incidents.betterstack.com/api/v2/monitors/${monitorId}`,{headers:{Authorization:`Bearer ${token}`}},{sleep});const a=result.data?.attributes;if(!a||!['up','down','validating','paused','pending','maintenance'].includes(a.status))throw new Error('Invalid monitor result.');if(!a.last_checked_at)return {state:'empty',observedAt:null,data:{status:a.status}};const age=now()-Date.parse(a.last_checked_at);if(!Number.isFinite(age)||age< -300000)throw new Error('Invalid monitor timestamp.');return {state:age>600000?'stale':'fresh',observedAt:a.last_checked_at,data:{status:a.status}};},{now,cacheMs:60000});
}
export function createServiceAccountTokenProvider({clientEmail,privateKey,fetcher=fetch,now=Date.now,sleep=wait}={}){
 if(!clientEmail||!privateKey)throw new Error('Server identity required.');let saved=null,pending=null;
 const encode=value=>btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');const json=value=>encode(new TextEncoder().encode(JSON.stringify(value)));
 return async()=>{if(saved&&saved.expiresAt>now()+60000)return saved.token;if(pending)return pending;pending=(async()=>{const issued=Math.floor(now()/1000);const unsigned=`${json({alg:'RS256',typ:'JWT'})}.${json({iss:clientEmail,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600})}`;const raw=privateKey.replace(/-----[^-]+-----|\s/g,'');const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(raw),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));const result=await requestJson(fetcher,'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${encode(new Uint8Array(signature))}`})},{sleep});if(typeof result.access_token!=='string'||!result.access_token||!Number.isFinite(Number(result.expires_in)))throw new Error('Invalid token response.');saved={token:result.access_token,expiresAt:now()+Math.min(3600,Number(result.expires_in))*1000};return saved.token;})();try{return await pending;}finally{pending=null;}};
}
