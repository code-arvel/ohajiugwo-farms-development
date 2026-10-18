import {loadAdminConfig} from '../server/config.mjs';
import {createHostedAuthProvider} from '../server/auth/provider.mjs';
import {createCleanupWorker} from '../server/cleanup-worker.mjs';
import {createPrivateStorageProvider} from '../server/media/storage-provider.mjs';
import {createMediaCleanupWorker} from '../server/media/media-cleanup-worker.mjs';
const summaryKeys=['claimed','completed','retried','review','unconfirmed'];
function safeSummary(value){
 if(!value||typeof value!=='object'||summaryKeys.some(key=>!Number.isInteger(value[key])||value[key]<0))throw new Error('Invalid cleanup summary.');
 return Object.fromEntries(summaryKeys.map(key=>[key,value[key]]));
}
// Separate Worker preparation: Pages Functions have no cron handler. No fetch/public route.
export function createCleanupScheduledHandler({
 loadConfig:loadConfigImpl=loadAdminConfig,
 createProvider:createProviderImpl=createHostedAuthProvider,
 createWorker:createWorkerImpl=createCleanupWorker,
 createStorage:createStorageImpl=createPrivateStorageProvider,
 createMediaWorker:createMediaWorkerImpl=createMediaCleanupWorker,
 log:logImpl=line=>console.log(line),
 error:errorImpl=()=>console.error('Cleanup worker failed; private details withheld.')
}={}){
 return {scheduled(_event,env,context){
  if(env?.ADMIN_ENABLE_CLEANUP_WORKER!=='confirmed-development-only')return;
  const task=(async()=>{
   const config=loadConfigImpl(env),provider=createProviderImpl(config);
   const authReport=await createWorkerImpl(config,{provider,rpc:provider.rpc}).run();
   const reports={cleanup:safeSummary(authReport)};
   if(env?.ADMIN_ENABLE_MEDIA_CLEANUP_WORKER==='confirmed-development-only'){
    const mediaReport=await createMediaWorkerImpl({rpc:provider.rpc,storage:createStorageImpl(config)}).run();
    reports.mediaCleanup=safeMediaSummary(mediaReport);
   }
   logImpl(JSON.stringify(reports));
  })().catch(()=>{errorImpl('Cleanup worker failed; private details withheld.');});
  context.waitUntil(task);
 }};
}
function safeMediaSummary(value){
 const keys=['claimed','completed','retried','review','unconfirmed'];
 if(!value||typeof value!=='object'||keys.some(key=>!Number.isInteger(value[key])||value[key]<0))throw new Error('Invalid media cleanup summary.');
 return Object.fromEntries(keys.map(key=>[key,value[key]]));
}
export default createCleanupScheduledHandler();
