// Server only. Never import configuration into an administrator/public browser bundle.
const required=(env,key)=>{const value=env[key];if(typeof value!=='string'||!value.trim()||/[\r\n]/.test(value))throw new Error(`Missing or invalid ${key}.`);return value.trim();};
export function loadAdminConfig(env){
 if(required(env,'ADMIN_ENVIRONMENT')!=='hosted-development')throw new Error('Only the hosted-development environment is implemented.');
 const origin=required(env,'ADMIN_ORIGIN'),url=new URL(origin);
 const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 if(url.origin!==origin||url.username||url.password||!['https:','http:'].includes(url.protocol)||(url.protocol==='http:'&&!loopback))throw new Error('Use an exact HTTPS origin, or loopback HTTP for local development.');
 const projectRef=required(env,'SUPABASE_PROJECT_REF');
 if(!/^[a-z0-9]{20}$/.test(projectRef))throw new Error('Set the explicitly selected development project reference.');
 const supabaseUrl=required(env,'SUPABASE_URL');
 if(supabaseUrl!==`https://${projectRef}.supabase.co`)throw new Error('Supabase URL must match the explicitly selected development project.');
 const sessionKey=required(env,'ADMIN_SESSION_KEY');
 if(!/^[a-f0-9]{64}$/i.test(sessionKey))throw new Error('ADMIN_SESSION_KEY must be a random 32-byte hexadecimal key.');
 return Object.freeze({environment:'hosted-development',origin,secureCookies:url.protocol==='https:',accountLifecycleEnabled:env.ADMIN_ENABLE_ACCOUNT_LIFECYCLE==='confirmed-development-only',accountInviteIssueEnabled:env.ADMIN_ENABLE_PROVIDER_INVITATION_ISSUE==='confirmed-development-only',accountRecoveryIssueEnabled:env.ADMIN_ENABLE_PROVIDER_RECOVERY_ISSUE==='confirmed-development-only',privateMediaEnabled:env.ADMIN_ENABLE_PRIVATE_MEDIA==='confirmed-development-only',projectRef,supabaseUrl,publishableKey:required(env,'SUPABASE_PUBLISHABLE_KEY'),secretKey:required(env,'SUPABASE_SECRET_KEY'),sessionKey,idleSeconds:1800,absoluteSeconds:43200});
}
