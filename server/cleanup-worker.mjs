import {unseal} from './security.mjs';
// Private scheduled/maintainer worker only; no public HTTP endpoint or automatic refresh/replay.
export function createCleanupWorker(config,{provider,rpc,now=Date.now}){
 return {async run({limit=5,budgetMs=20000}={}){
  if(!Number.isInteger(limit)||limit<1||limit>20||!Number.isFinite(budgetMs)||budgetMs<1||budgetMs>60000)throw new Error('Invalid cleanup limits.');
  const owner=crypto.randomUUID(),started=now(),summary={claimed:0,completed:0,retried:0,review:0,unconfirmed:0};
  let jobs;try{jobs=await rpc('farm_cleanup_claim',{p_owner:owner,p_limit:limit});}catch{throw new Error('Cleanup queue is unavailable; details withheld.');}
  if(!Array.isArray(jobs)||jobs.length>limit)throw new Error('Cleanup batch could not be verified.');summary.claimed=jobs.length;
  for(const job of jobs){
   let outcome='done';
   try{
    const payload=await unseal(job.encrypted_credentials,config.sessionKey,job.aad);
    const tokens=payload.invite?[payload.invite,...(Array.isArray(payload.previousProbes)?payload.previousProbes:[]),payload.probe].filter(Boolean):[payload];
    const unique=[...new Set(tokens.map(value=>value?.access_token))];
    if(!unique.length||unique.length>32||unique.some(value=>typeof value!=='string'||!value||value.length>16000)||!Number.isInteger(job.completed_tokens)||job.completed_tokens<0||job.completed_tokens>unique.length)throw new Error('Invalid private cleanup payload.');
    for(let index=job.completed_tokens;index<unique.length;index++){
     if(now()-started>=budgetMs){outcome='retry';break;}
     if(await rpc('farm_cleanup_renew',{p_id:job.id,p_owner:owner})!==true)throw Object.assign(new Error(),{lostLease:true});
     try{await provider.signOut(unique[index]);}catch(error){outcome=[401,403].includes(error.status)?'review':'retry';break;}
     if(await rpc('farm_cleanup_progress',{p_id:job.id,p_owner:owner,p_completed:index+1})!==true)throw Object.assign(new Error(),{lostLease:true});
    }
   }catch(error){if(error.lostLease){summary.unconfirmed++;continue;}outcome='review';}
   try{if(await rpc('farm_cleanup_finish',{p_id:job.id,p_owner:owner,p_outcome:outcome})!==true){summary.unconfirmed++;continue;}}
   catch{summary.unconfirmed++;continue;}
   summary[outcome==='done'?'completed':outcome==='retry'?'retried':'review']++;
  }
  return summary;
 }};
}
