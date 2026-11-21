import {stat} from 'node:fs/promises';
import {loadAdminConfig} from '../server/config.mjs';
import {createHostedAuthProvider} from '../server/auth/provider.mjs';
import {inspectCleanupReview,classifyCleanupProviderResponse} from '../server/cleanup-review.mjs';
try{
 if(process.argv.length!==4||process.argv[2]!=='--confirm-project')throw Error();
 if(((await stat('.env.admin')).mode&0o077)!==0)throw Error();
 const config=loadAdminConfig(process.env);
 if(process.argv[3]!==config.projectRef)throw Error();
 const provider=createHostedAuthProvider(config);
 const inspectToken=async token=>{
  const response=await fetch(config.supabaseUrl+'/auth/v1/user',{method:'GET',headers:{apikey:config.publishableKey,Authorization:`Bearer ${token}`},redirect:'manual',signal:AbortSignal.timeout(12000)});
  if(response.ok)return classifyCleanupProviderResponse(response.status);
  let data;try{data=await response.json();}catch{}
  // Provider messages are inspected privately and discarded, never printed.
  return classifyCleanupProviderResponse(response.status,data);
 };
 console.log(JSON.stringify(await inspectCleanupReview(config,{rpc:provider.rpc,inspectToken}),null,2));
}catch{console.error('Cleanup review inspection stopped. Check project confirmation, migration 011 and private local configuration; details withheld.');process.exitCode=1;}
