// Node-heavy runner only. No environment reads, implicit credentials or live defaults.
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function runRelease({enabled=false,rpc,build,deployments,sleep=wait,polls=10}){
 if(enabled!==true)return{state:'disabled'};
 if(typeof rpc!=='function'||typeof build!=='function'||!deployments||!Number.isInteger(polls)||polls<1||polls>30)throw Error('Complete bounded release runner required.');
 const owner=crypto.randomUUID();let job;try{job=await rpc('farm_release_claim',{p_owner:owner});}catch{return{state:'unavailable'};}if(job===null)return{state:'idle'};if(!uuid.test(job?.id||''))return{state:'unconfirmed'};
 const update=(action,id=null,hash=null)=>rpc('farm_release_worker_update',{p_id:job.id,p_owner:owner,p_action:action,p_deployment_id:id,p_artifact_hash:hash});
 let submitted=false,artifact,leaseLost=false,heartbeat=null;
 const timer=setInterval(()=>{if(!heartbeat)heartbeat=update('renew').then(value=>{if(value!==true)leaseLost=true;}).catch(()=>{leaseLost=true;}).finally(()=>{heartbeat=null;});},30000);timer.unref?.();
 try{
  if(await update('renew')!==true)return{state:'unconfirmed',id:job.id};
  if(job.snapshot?.withdrawnIds?.length&&deployments.supportsVerifiedRetirement!==true)throw Error('Withdrawal retirement capability unavailable.');
  artifact=await build(job);if(leaseLost||!/^[a-f0-9]{64}$/.test(artifact?.artifactHash||''))throw Error('Build ownership unavailable.');
  if(await update('built',null,artifact.artifactHash)!==true)return{state:'unconfirmed',id:job.id};
  if(await update('renew')!==true)return{state:'unconfirmed',id:job.id};
  // Mark submission uncertainty BEFORE invoking an external side effect.
  submitted=true;const deployment=await deployments.submit({release:job,artifact});
  if(leaseLost||typeof deployment?.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(deployment.id))throw Error('Submission requires review.');
  if(await update('submitted',deployment.id,artifact.artifactHash)!==true)return{state:'unconfirmed',id:job.id};
  for(let attempt=0;attempt<polls;attempt++){
   const proof=await deployments.status(deployment.id,{releaseId:job.id,artifactHash:artifact.artifactHash});
   if(proof?.state==='failed'&&proof.id===deployment.id){const ok=await update('failed',deployment.id,artifact.artifactHash);return{state:ok===true?'failed':'unconfirmed',id:job.id};}
   if(proof?.state==='published'){
    if((job.snapshot?.withdrawnIds?.length&&proof.retirementVerified!==true)||proof.id!==deployment.id||proof.releaseId!==job.id||proof.artifactHash!==artifact.artifactHash||proof.production!==true)throw Error('Provider evidence mismatch.');
    const ok=await update('confirm',deployment.id,artifact.artifactHash);return{state:ok===true?'published':'unconfirmed',id:job.id};
   }
   if(attempt+1<polls)await sleep(1000);
  }
  throw Error('Deployment outcome needs review.');
 }catch{
  try{const ok=await update(submitted?'uncertain':'failed',null,artifact?.artifactHash||null);return{state:ok===true?(submitted?'review':'failed'):'unconfirmed',id:job.id};}catch{return{state:'unconfirmed',id:job.id};}
 }finally{clearInterval(timer);if(heartbeat)await heartbeat;}
}
export async function reconcileRelease({job,rpc,deployments}){
 if(!uuid.test(job?.id||'')||job.state!=='review'||!/^[a-f0-9]{64}$/.test(job.artifactHash||''))throw Error('A reviewed deployment inventory is required.');
 const id=job.deploymentId||(await deployments.find({releaseId:job.id,artifactHash:job.artifactHash}))?.id;if(!id)return{state:'review',id:job.id};
 const proof=await deployments.status(id,{releaseId:job.id,artifactHash:job.artifactHash});if(proof?.id!==id||!['failed','published'].includes(proof.state))return{state:'review',id:job.id};
 if(proof.state==='published'&&((job.snapshot?.withdrawnIds?.length&&proof.retirementVerified!==true)||proof.production!==true||proof.releaseId!==job.id||proof.artifactHash!==job.artifactHash))return{state:'review',id:job.id};
 const ok=await rpc('farm_release_reconcile',{p_id:job.id,p_deployment_id:id,p_outcome:proof.state,p_artifact_hash:job.artifactHash});return{state:ok===true?proof.state:'unconfirmed',id:job.id};
}
