// Prepared-only coordinator; activation requires independently verified off-site backup/restore.
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function createRetentionWorker({enabled=false,sourceRef,rpc,verifyBackupReceipt,now=Date.now}={}){return{async run({planId,limit=25}={}){
 if(enabled!==true)return{state:'disabled',prunedRevisions:0,queuedMedia:0};
 if(!uuid.test(planId||'')||!Number.isInteger(limit)||limit<1||limit>25||typeof sourceRef!=='string'||!sourceRef)throw Error('Bounded retention plan and source required.');
 const receipt=await verifyBackupReceipt();const time=Date.parse(receipt?.verifiedAt),age=now()-time;
 if(receipt?.sourceRef!==sourceRef||receipt.offsite!==true||receipt.restoreDrillVerified!==true||typeof receipt.setId!=='string'||!receipt.setId||!/^[a-f0-9]{64}$/.test(receipt.manifestSha256||'')||!Number.isFinite(time)||age<0||age>36*3600000)throw Error('Fresh independent backup/restore evidence required.');
 const id=await rpc('farm_retention_backup_record',{p_receipt:receipt});if(!uuid.test(id||''))throw Error('Backup evidence could not be recorded.');
 const value=await rpc('farm_retention_execute',{p_plan_id:planId,p_receipt_id:id,p_limit:limit});if(value?.state!=='queued'||!Number.isInteger(value.prunedRevisions)||value.prunedRevisions<0||value.prunedRevisions>limit||!Number.isInteger(value.queuedMedia)||value.queuedMedia<0||value.queuedMedia>limit)throw Error('Retention outcome could not be confirmed.');return value;
 }};}
