import {newToken,sessionDigest} from '../security.mjs';
import {createHostedAuthProvider} from './provider.mjs';
export async function probeSessionCommandAccess(config,{fetchImpl=fetch}={}){
 const provider=createHostedAuthProvider(config,{fetchImpl}),params={p_cookie_hash:await sessionDigest(newToken())};
 const result=await provider.rpc('farm_session_read',params);
 if(result!==null)throw new Error('Unexpected server session response; access probe stopped.');
 const headers={apikey:config.publishableKey,'Content-Type':'application/json'};
 if(config.publishableKey.startsWith('eyJ'))headers.Authorization=`Bearer ${config.publishableKey}`;
 let response;
 try{response=await fetchImpl(config.supabaseUrl+'/rest/v1/rpc/farm_session_read',{method:'POST',headers,body:JSON.stringify(params),redirect:'manual',signal:AbortSignal.timeout(12000)});}
 catch{throw new Error('Anonymous command check could not connect; details withheld.');}
 // A 404 is a denial only because the identical service-role route was verified above.
 if(![401,403,404].includes(response.status))throw new Error('Anonymous command denial was not verified. Do not enable administrator routes.');
 return {serviceCommandVerified:true,anonymousCommandDenied:true,scope:'HTTP command access only. Full account, authenticated non-member, concurrency and Storage tests remain separate.'};
}
