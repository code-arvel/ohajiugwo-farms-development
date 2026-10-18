// Durable private Storage-object cleanup. Only paths produced by the SQL ledger are accepted.
const pathPattern=/^(?:staging\/[0-9a-f-]{36}\/source|media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(?:original|preview)\.webp)$/i;
function safePaths(paths){
 if(!Array.isArray(paths)||paths.length<1||paths.length>200||paths.some(path=>typeof path!=='string'||path.length>256||!pathPattern.test(path)))throw new Error('Invalid private media cleanup payload.');
 return paths;
}
export function createMediaCleanupWorker({rpc,storage,now=Date.now}){
 return {async run({limit=5,budgetMs=15000}={}){
  if(!Number.isInteger(limit)||limit<1||limit>20||!Number.isFinite(budgetMs)||budgetMs<1||budgetMs>60000)throw new Error('Invalid media cleanup limits.');
  const owner=crypto.randomUUID(),started=now(),summary={claimed:0,completed:0,retried:0,review:0,unconfirmed:0};
  try{await rpc('farm_media_expired_cleanup_enqueue',{p_limit:Math.min(50,limit*2)});}catch{throw new Error('Expired media reconciliation is unavailable; details withheld.');}
  let jobs;try{jobs=await rpc('farm_media_cleanup_claim',{p_owner:owner,p_limit:limit});}catch{throw new Error('Media cleanup queue is unavailable; details withheld.');}
  if(!Array.isArray(jobs)||jobs.length>limit)throw new Error('Media cleanup batch could not be verified.');summary.claimed=jobs.length;
  for(let index=0;index<jobs.length;index++){
   const job=jobs[index];
   if(now()-started>=budgetMs){
    for(const pending of jobs.slice(index)){
     try{if(await rpc('farm_media_cleanup_finish',{p_id:pending.id,p_owner:owner,p_success:false})!==true){summary.unconfirmed++;continue;}if(pending.attempts>=8)summary.review++;else summary.retried++;}
     catch{summary.unconfirmed++;}
    }
    break;
   }
   let paths;
   try{if(!job||typeof job.id!=='string'||!Number.isInteger(job.attempts)||job.attempts<1)throw new Error();paths=safePaths(job.paths);}catch{
    try{if(await rpc('farm_media_cleanup_finish',{p_id:job?.id,p_owner:owner,p_success:false})!==true){summary.unconfirmed++;continue;}if(job?.attempts>=8)summary.review++;else summary.retried++;}catch{summary.unconfirmed++;}
    continue;
   }
   let success=false;try{await storage.delete(paths);success=true;}catch{}
   try{
    if(await rpc('farm_media_cleanup_finish',{p_id:job.id,p_owner:owner,p_success:success})!==true){summary.unconfirmed++;continue;}
    if(success)summary.completed++;else if(job.attempts>=8)summary.review++;else summary.retried++;
   }catch{summary.unconfirmed++;}
  }
  return summary;
 }};
}
