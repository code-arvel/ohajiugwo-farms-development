// Loopback-only dummy implementation. Never used by hosting/application composition.
import {createAdminApplication} from '../../../server/application.mjs';
import {homepageContent,samplePosts} from '../../../src/content/seed.mjs';
import {toDocument} from '../../../src/content/article.mjs';
import {AuthError} from '../../../server/auth/sessions.mjs';
export function createWorkspaceFixture(origin,assets,{readinessFeatures=false}={}){
 const config={origin,environment:'hosted-development',secureCookies:false,sessionKey:'ab'.repeat(32),projectRef:'abcdefghijklmnopqrst',supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'MOCK_PUBLIC',secretKey:'MOCK_SECRET',accountLifecycleEnabled:true,privateMediaEnabled:true,idleSeconds:1800,absoluteSeconds:43200};
 if(readinessFeatures){config.releaseEnabled=true;config.mediaMetadataEnabled=true;}
 const actor={user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'},csrfToken:'c'.repeat(43)};Object.defineProperties(actor,{accessToken:{value:'DUMMY_USER_JWT'},cookieHash:{value:'d'.repeat(43)}});
 const makePayload=sample=>{const value=structuredClone(sample);delete value.id;delete value.revision;delete value.reviewOnly;value.body=toDocument(value);delete value.blocks;value.status='draft';return value;};
 const now=()=>new Date().toISOString();const state={failContent:false,rows:[{id:crypto.randomUUID(),kind:'homepage',revision:1,payload:structuredClone(homepageContent),updated_at:now(),deleted_at:null},...samplePosts.slice(0,2).map(post=>({id:crypto.randomUUID(),kind:'post',revision:1,payload:makePayload(post),updated_at:now(),deleted_at:null}))]};
 const releases=[];
 const history=new Map(state.rows.map(row=>[row.id,[{revision:1,payload:structuredClone(row.payload),created_at:now()}]]));
 const provider={rpc:async name=>{if(name==='farm_media_list')return[];if(name==='farm_admin_list')return{admins:[{id:actor.user.id,email:actor.user.email,createdAt:now()}],invitations:[],passwordResets:[]};throw Error('Unsupported dummy operation.');},userRpc:async(name,p)=>{
  if(readinessFeatures&&name==='farm_release_list')return{liveReleaseId:null,releases:structuredClone(releases)};
  if(readinessFeatures&&name==='farm_release_prepare'){if(state.releaseFailure)throw Error('dummy private provider detail');const release={id:crypto.randomUUID(),createdAt:now(),state:'queued'};releases.push(release);return structuredClone(release);}
  if(readinessFeatures&&name==='farm_media_trash_list')return[];
  if(name==='farm_content_list'&&state.contentGate)await state.contentGate;if(name==='farm_content_save'&&state.saveGate){state.saveStarted=true;await state.saveGate;}
  if(state.failContent)throw new AuthError('Fixture unavailable',503);
  if(name==='farm_content_list')return structuredClone(state.rows.filter(row=>!row.deleted_at));
  if(name==='farm_content_trash_list')return structuredClone(state.rows.filter(row=>row.deleted_at));
  if(name==='farm_content_history')return structuredClone(history.get(p.p_id)||[]);
  if(name==='farm_content_read')return structuredClone(state.rows.find(row=>row.id===p.p_id)||null);
  const current=state.rows.find(row=>row.id===p.p_id);if(current&&current.revision!==p.p_base_revision)throw new AuthError('Fixture conflict',409);
  if(name==='farm_content_save'){const row={id:p.p_id||crypto.randomUUID(),kind:p.p_kind,revision:(current?.revision||0)+1,payload:structuredClone(p.p_payload),updated_at:now(),deleted_at:null};state.rows=current?state.rows.map(item=>item.id===row.id?row:item):[...state.rows,row];const entries=history.get(row.id)||[];entries.push({revision:row.revision,payload:structuredClone(row.payload),created_at:now()});history.set(row.id,entries);return structuredClone(row);}
  if(name==='farm_content_trash'&&current){current.deleted_at=now();return true;}
  if(name==='farm_content_untrash'&&current){current.deleted_at=null;current.revision++;return structuredClone(current);}
  if(name==='farm_content_restore'&&current){const prior=history.get(current.id)?.find(row=>row.revision===p.p_revision);if(!prior)throw new AuthError('Fixture revision missing',404);current.payload=structuredClone(prior.payload);current.revision++;history.get(current.id).push({revision:current.revision,payload:structuredClone(current.payload),created_at:now()});return structuredClone(current);}
  throw Error('Unsupported dummy command.');
 }};
 const auth={authenticate:async()=>actor,logout:async()=>({providerCleanupPending:false})};
 const app=createAdminApplication(config,{auth,provider,rpc:provider.rpc,assets,mediaProcessor:{process:async()=>{throw Error('Upload disabled in this dummy review.');}},storage:{}});
 return{state,actor,handle:async request=>{
  const url=new URL(request.url);if(url.origin!==origin)return new Response('Loopback fixture only.',{status:403});
  if(!url.pathname.startsWith('/admin'))return null;
  const response=await app(request);
  if(response.headers.get('content-type')?.includes('text/html')){const headers=new Headers(response.headers);headers.delete('content-length');return new Response((await response.text()).replace(/(<body[^>]*>)/,'$1<p class="workspace-fixture-notice">Local fixture · dummy records · no hosted accounts, email or permanent saves</p>'),{status:response.status,headers});}
  return response;
 }};
}
