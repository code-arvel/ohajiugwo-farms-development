// Isolated repository/provider model. This is not a PostgreSQL/RLS test.
import assert from 'node:assert/strict';
import {unseal} from '../../../server/security.mjs';
export const config={environment:'hosted-development',origin:'http://127.0.0.1:4322',secureCookies:false,projectRef:'abcdefghijklmnopqrst',supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',sessionKey:'ab'.repeat(32),publishableKey:'fixture-public',secretKey:'fixture-secret'};
export const userId='11111111-1111-4111-8111-111111111111';
export function fixture(){
 let row=null,active=0,member=null,now=Date.now(),password=null,otpUsed=false;
 const calls=[],fail=new Set(),tokenHash='f'.repeat(64),user={id:userId,email:'owner@example.test',email_confirmed_at:new Date(now).toISOString()};
 const tokens={access_token:'private-invitation-access',refresh_token:'private-invitation-refresh',user};
 const valid=()=>row&&['queued','sent'].includes(row.state)&&Date.parse(row.expires_at)>now&&active===0;
 const held=p=>valid()&&row.lease_owner===p.p_owner&&row.lease_until>now;
 const rpc=async(name,p={})=>{
  calls.push(name);
  if(fail.has(name))throw new Error('PRIVATE DATABASE DETAIL');
  if(name==='farm_auth_attempt')return true;
  if(name==='farm_bootstrap_prepare'){
   if(active||valid())throw new Error('closed or pending');
   row={id:crypto.randomUUID(),recipient_email:p.p_email,nonce_hash:p.p_nonce_hash,encrypted_nonce:p.p_encrypted_nonce,generation:1,state:'queued',issue_state:'new',expires_at:new Date(now+86400000).toISOString(),lease_owner:null,lease_until:0};
   return structuredClone(row);
  }
  if(name==='farm_bootstrap_read')return row?.id===p.p_id?structuredClone(row):null;
  if(name==='farm_bootstrap_claim'){
   if(!valid()||row.id!==p.p_id||(row.lease_until>now)||(p.p_phase==='accept'&&(row.nonce_hash!==p.p_nonce_hash||row.issue_state!=='ready')))return null;
   if(p.p_phase==='issue'&&row.issue_state==='issuing'){row.issue_state='review';return null;}
   if(p.p_phase==='issue'&&row.issue_state==='review')return null;
   row.lease_owner=p.p_owner;row.lease_until=now+120000;
   if(p.p_phase==='issue'&&row.issue_state==='new')row.issue_state='issuing';
   row.lease_phase=p.p_phase;return structuredClone(row);
  }
  if(name==='farm_bootstrap_issue_finish'){
   if(!held(p)||row.lease_phase!=='issue'||member==='revoked')return false;
   row.user_id=p.p_user_id;row.encrypted_invite=p.p_encrypted_invite;row.issue_state='ready';member='pending';return true;
  }
  if(name==='farm_bootstrap_progress'){
   if(!held(p)||row.lease_phase!=='accept')return false;
   row.encrypted_credentials=p.p_encrypted_credentials;row.provider_cleanup_pending=true;return true;
  }
  if(name==='farm_bootstrap_activate'){
   if(!held(p)||row.lease_phase!=='accept'||row.generation!==p.p_generation||row.nonce_hash!==p.p_nonce_hash||row.user_id!==p.p_user_id||member!=='pending'||!password)return false;
   row.state='accepted';member='active';active=1;row.encrypted_invite=null;row.encrypted_nonce=null;row.lease_owner=null;row.lease_until=0;return true;
  }
  if(name==='farm_bootstrap_release'){
   if(row?.lease_owner===p.p_owner){if(row.issue_state==='issuing')row.issue_state='review';row.lease_owner=null;row.lease_until=0;}return null;
  }
  if(name==='farm_bootstrap_cleanup_done'){row.provider_cleanup_pending=false;row.encrypted_credentials=null;return null;}
  if(name==='farm_bootstrap_cancel'){
   if(!valid()||row.lease_until>now)return false;
   row.state='cancelled';row.generation++;row.encrypted_invite=null;row.encrypted_nonce=null;return true;
  }
  assert.fail('Unexpected RPC '+name);
 };
 const provider={
  generateInvite:async email=>{calls.push('generateInvite');if(fail.has('generateInvite'))throw new Error('PRIVATE PROVIDER DETAIL');assert.equal(email,user.email);return {user:{id:user.id,email:user.email},tokenHash};},
  verifyInvite:async hash=>{calls.push('verifyInvite');if(fail.has('verifyInvite')||otpUsed)throw new Error('PRIVATE VERIFY DETAIL');assert.equal(hash,tokenHash);otpUsed=true;return {...tokens};},
  getUser:async token=>{calls.push('getUser');if(fail.has('getUser'))throw new Error('PRIVATE USER DETAIL');assert.ok(['private-invitation-access','private-password-access'].includes(token));return {...user};},
  updatePassword:async(token,value)=>{calls.push('updatePassword');if(fail.has('updatePassword'))throw new Error('PRIVATE PASSWORD DETAIL');assert.equal(token,tokens.access_token);password=value;return {...user};},
  signIn:async(email,value)=>{calls.push('signIn');if(fail.has('signIn')||value!==password)throw new Error('PRIVATE SIGNIN DETAIL');assert.equal(email,user.email);return {...tokens,access_token:'private-password-access'};},
  signOut:async()=>{calls.push('signOut');if(fail.has('signOut'))throw new Error('PRIVATE CLEANUP DETAIL');},
 };
 return {config,provider,rpc,calls,fail,user,get row(){return row;},get active(){return active;},get member(){return member;},advance:ms=>now+=ms,clock:()=>now,
  setMember:value=>member=value,setActive:value=>active=value,
  async inputs(){return {id:row.id,nonce:(await unseal(row.encrypted_nonce,config.sessionKey,row.nonce_hash)).nonce,tokenHash,password:'a good private password'};},
 };
}
