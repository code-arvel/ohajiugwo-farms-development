const DAY=86400000;
const iso=ms=>new Date(ms).toISOString().slice(0,10);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&iso(Date.parse(value))===value;
export function reportRange({period='28',start,end}={},now=Date.now()){
 const today=iso(now+3600000);let days;
 if(period==='custom'){
  if(!validDate(start)||!validDate(end)||start>end||end>today)throw new RangeError('Choose valid past dates in chronological order.');
  days=(Date.parse(end)-Date.parse(start))/DAY+1;if(days>366)throw new RangeError('Choose at most 366 days.');
 }else{if(!['7','28','90'].includes(String(period)))throw new RangeError('Choose 7, 28, 90 or custom.');days=Number(period);end=today;start=iso(Date.parse(end)-(days-1)*DAY);}
 return {timeZone:'Africa/Lagos',period:String(period),days,partial:end===today,current:{startDate:start,endDate:end},previous:{startDate:iso(Date.parse(start)-days*DAY),endDate:iso(Date.parse(start)-DAY)}};
}
export function evidenceState(value,source,now=Date.now(),maxAgeMs=86400000){
 if(!value)return {state:'unconfigured',source,observedAt:null};
 if(value.state==='error')return {state:'error',source:value.source||source,observedAt:value.observedAt||null};
 if(!value.observedAt)return {state:'empty',source:value.source||source,observedAt:null};
 const age=now-Date.parse(value.observedAt);if(!Number.isFinite(age)||age< -300000)return {state:'error',source:value.source||source,observedAt:null};
 return {state:age>maxAgeMs?'stale':'fresh',source:value.source||source,observedAt:value.observedAt,data:{status:String(value.status||'Observation supplied'),detail:String(value.detail||''),...(value.url?{url:String(value.url)}:{}),...(value.device?{device:String(value.device)}:{})}};
}
export function createReportingService({analytics=null,availability=null,evidence={},now=Date.now,collectionStart=null}={}){
 const read=async(adapter,source,range)=>{if(!adapter)return {state:'unconfigured',source,observedAt:null};try{return await adapter.read(range);}catch{return {state:'error',source,observedAt:null};}};
 return {async read(query={}){const range=reportRange(query,now());const [analyticsResult,availabilityResult]=await Promise.all([read(analytics,'GA4 Data API',range),read(availability,'Better Stack',range)]);return {range,collectionStart,analytics:analyticsResult,health:{availability:availabilityResult,...Object.fromEntries(['labMobile','labDesktop','field','links','publishing','backups'].map(key=>[key,evidenceState(evidence[key],key,now(),key==='backups'?36*3600000:86400000)]))}};}};
}
