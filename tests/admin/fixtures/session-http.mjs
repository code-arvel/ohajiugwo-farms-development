import {loadAdminConfig} from '../../../server/config.mjs';
import {createAuthService,AuthError} from '../../../server/auth/sessions.mjs';

export function sessionFixture({https=false,origin}={}){
 const config=loadAdminConfig({ADMIN_ENVIRONMENT:'hosted-development',ADMIN_ORIGIN:origin||(https?'https://admin.example.test':'http://127.0.0.1:4322'),SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_PUBLISHABLE_KEY:'mock-public',SUPABASE_SECRET_KEY:'mock-secret',ADMIN_SESSION_KEY:'ab'.repeat(32)});
 const userId='11111111-1111-4111-8111-111111111111',providerId='22222222-2222-4222-8222-222222222222';
 let active=true,allowed=true,ttl=3600,refreshes=0,closeFailure;const rows=new Map(),calls=[];
 const tokens=expires=>({access_token:'header.'+btoa(JSON.stringify({sub:userId,session_id:providerId,role:'authenticated',iss:config.supabaseUrl+'/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+expires})).replace(/=+$/,'')+'.MOCK_SIGNATURE',refresh_token:'MOCK_PRIVATE_REFRESH'});
 const provider={signIn:async()=>{calls.push('signIn');return tokens(ttl);},getUser:async()=>({id:userId,email:'owner@example.test',email_confirmed_at:'2026-10-16T00:00:00Z'}),refresh:async()=>{refreshes++;return tokens(3600);},signOut:async()=>{calls.push('signOut');}};
 const rpc=async(name,p)=>{
  calls.push(name);
  if(name==='farm_auth_attempt')return allowed;
  if(name==='farm_session_open'){if(!active)throw new AuthError('MOCK_PRIVATE_NONMEMBER',403);const row={id:crypto.randomUUID(),user_id:p.p_user_id,provider_session_id:p.p_provider_session_id,cookie_hash:p.p_cookie_hash,encrypted_credentials:p.p_encrypted_credentials,csrf_hash:p.p_csrf_hash,refresh_version:0};rows.set(row.cookie_hash,row);return row;}
  const row=rows.get(p.p_cookie_hash);
  if(name==='farm_session_read')return active&&row&&!row.revoked_at?{...row}:null;
  if(name==='farm_session_close'){if(closeFailure==='throw')throw new Error('MOCK_PRIVATE_DATABASE');if(closeFailure==='null')return null;if(row)row.revoked_at=true;return row||null;}
  if(name==='farm_session_cleanup_done')return null;
  if(name==='farm_session_refresh_claim')return active&&row&&!row.revoked_at?{...row}:null;
  if(name==='farm_session_refresh_finish'){if(!active||!row||row.revoked_at)return false;row.encrypted_credentials=p.p_encrypted_credentials;row.refresh_version++;return true;}
  if(name==='farm_session_refresh_release')return null;
  throw new Error('Unexpected mock command');
 };
 return {config,provider,calls,rows,service:createAuthService(config,{provider,rpc}),setActive:value=>active=value,setAllowed:value=>allowed=value,setTtl:value=>ttl=value,setCloseFailure:value=>closeFailure=value,get refreshes(){return refreshes;}};
}
