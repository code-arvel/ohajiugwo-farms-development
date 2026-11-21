// Server only. Never import configuration into an administrator/public browser bundle.
const required=(env,key)=>{const value=env[key];if(typeof value!=='string'||!value.trim()||/[\r\n]/.test(value))throw new Error(`Missing or invalid ${key}.`);return value.trim();};
export function loadAdminConfig(env){
 const environment=required(env,'ADMIN_ENVIRONMENT');if(!['hosted-development','hosted-production'].includes(environment))throw new Error('Choose an explicit hosted environment.');
 const enabled=key=>env[key]===(environment==='hosted-production'?'confirmed-production':'confirmed-development-only');
 const origin=required(env,'ADMIN_ORIGIN'),url=new URL(origin);
 const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 if(url.origin!==origin||url.username||url.password||!['https:','http:'].includes(url.protocol)||(url.protocol==='http:'&&!loopback))throw new Error('Use an exact HTTPS origin, or loopback HTTP for local development.');
 if(environment==='hosted-production'&&(url.protocol!=='https:'||loopback||required(env,'PUBLIC_SITE_ORIGIN')!==origin))throw new Error('Production requires the exact public HTTPS canonical origin.');
 const projectRef=required(env,'SUPABASE_PROJECT_REF');
 if(!/^[a-z0-9]{20}$/.test(projectRef))throw new Error('Set the explicitly selected development project reference.');
 const supabaseUrl=required(env,'SUPABASE_URL');
 if(supabaseUrl!==`https://${projectRef}.supabase.co`)throw new Error('Supabase URL must match the explicitly selected development project.');
 const sessionKey=required(env,'ADMIN_SESSION_KEY');
 if(!/^[a-f0-9]{64}$/i.test(sessionKey))throw new Error('ADMIN_SESSION_KEY must be a random 32-byte hexadecimal key.');
 const reporting=enabled('ADMIN_ENABLE_REPORTING_PROVIDER_READS')?Object.freeze({propertyId:env.GA4_PROPERTY_ID||'',clientEmail:env.GA4_REPORTING_CLIENT_EMAIL||'',privateKey:typeof env.GA4_REPORTING_PRIVATE_KEY==='string'?env.GA4_REPORTING_PRIVATE_KEY.replaceAll('\\n','\n'):'',monitorId:env.BETTER_STACK_MONITOR_ID||'',monitorToken:env.BETTER_STACK_API_TOKEN||'',collectionStart:env.ANALYTICS_COLLECTION_START||null}):null;
 return Object.freeze({environment,reporting,releaseEnabled:enabled('ADMIN_ENABLE_RELEASES'),mediaMetadataEnabled:enabled('ADMIN_ENABLE_MEDIA_METADATA'),origin,secureCookies:url.protocol==='https:',accountLifecycleEnabled:enabled('ADMIN_ENABLE_ACCOUNT_LIFECYCLE'),accountInviteIssueEnabled:enabled('ADMIN_ENABLE_PROVIDER_INVITATION_ISSUE'),accountRecoveryIssueEnabled:enabled('ADMIN_ENABLE_PROVIDER_RECOVERY_ISSUE'),firstAdminEmailEnabled:enabled('ADMIN_ENABLE_FIRST_ADMIN_EMAIL'),privateMediaEnabled:enabled('ADMIN_ENABLE_PRIVATE_MEDIA'),projectRef,supabaseUrl,publishableKey:required(env,'SUPABASE_PUBLISHABLE_KEY'),secretKey:required(env,'SUPABASE_SECRET_KEY'),sessionKey,idleSeconds:1800,absoluteSeconds:43200});
}
