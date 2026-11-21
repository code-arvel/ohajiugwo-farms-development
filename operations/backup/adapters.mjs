import { spawn as nodeSpawn } from 'node:child_process';
import path from 'node:path';
import { postgresEnvironment } from './postgres-env.mjs';

/** Consistent exported Postgres snapshot held until pg_dump closes. No inherited env. */
export function pgDumpSource({identity,binary,connectionEnv,snapshotProvider,openMedia,spawn=nodeSpawn,timeoutMs=300000}) {
  if(!identity||!path.isAbsolute(binary??'')||!connectionEnv||typeof snapshotProvider!=='function')throw new Error('Explicit database source configuration required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>900000)throw new Error('Bounded database timeout required');
  const explicitEnv=postgresEnvironment(connectionEnv);
  return {identity,openMedia,async snapshot(){const lease=await snapshotProvider();if(!/^[a-fA-F0-9-]+$/.test(lease.snapshotId??'')||typeof lease.release!=='function'){await lease.release?.();throw new Error('Exported consistent snapshot lease required');}
    let released=false;const close=async()=>{if(!released){released=true;await lease.release();}};
    async function* database(){let child,timer;try{const args=['--format=custom','--no-owner','--schema=public','--schema=farm_private',`--snapshot=${lease.snapshotId}`,...['memberships','sessions','invitations','auth_attempts','provider_effects','cleanup_jobs','media_uploads','media_cleanup','release_jobs','admin_guard'].map(t=>`--exclude-table-data=farm_private.${t}`)];child=spawn(binary,args,{env:explicitEnv,shell:false,stdio:['ignore','pipe','ignore']});let timedOut=false;const completion=new Promise(resolve=>{child.once('error',()=>resolve(false));child.once('close',code=>resolve(code===0&&!timedOut));});timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);for await(const chunk of child.stdout)yield chunk;if(!await completion)throw new Error('Database export failed');}finally{clearTimeout(timer);child?.kill('SIGKILL');await close();}}
    return {...lease.inventory,database:database(),close};}};
}

/** SDK/transport is injected; downloads use enumerated immutable private originals only. */
export function privateMediaSource({identity,private:isPrivate,bucket,snapshot,download}){
  if(isPrivate!==true||!identity||!bucket||typeof snapshot!=='function'||typeof download!=='function')throw new Error('Identified private original Storage source required');let inventory=new Map();
  return {identity,async snapshot(){const data=await snapshot();inventory=new Map(data.media.map(ref=>[`${ref.id}/${ref.version}`,ref.path]));return data;},async openMedia(ref){if(!inventory.has(`${ref.id}/${ref.version}`)||inventory.get(`${ref.id}/${ref.version}`)!==ref.path)throw new Error('Photo absent from immutable source inventory');return download({bucket,path:ref.path});}};
}

/** S3-compatible boundary: transport must sign server-side requests and attest private ACL.
 * Lock must be cross-runner exclusive; local mutex is insufficient in hosted operation.
 */
export function scopedS3Destination({identity,private:isPrivate,bucket,prefix,transport,withLock}){
  if(isPrivate!==true||!identity||!bucket||!/^[-a-zA-Z0-9_/]+\/$/.test(prefix??'')||prefix.split('/').includes('..')||typeof withLock!=='function'||!transport)throw new Error('Private scoped storage and exclusive lease required');
  const key=name=>{if(!/^[a-zA-Z0-9_./-]*$/.test(name)||name.startsWith('/')||name.split('/').some(p=>p==='..'||p==='.'))throw new Error('Unsafe storage key');return prefix+name;};
  return {identity,private:true,withLock,async putIfAbsent(name,body){try{await transport.put({bucket,key:key(name),body,ifNoneMatch:'*',acl:'private'});}catch(e){if(e.status!==412)throw new Error('Private backup object upload failed');}},async get(name){return transport.get({bucket,key:key(name),maxBytes:16*1024*1024+32});},async delete(name){await transport.delete({bucket,key:key(name)});},async list(name){const keys=[];let cursor;const seen=new Set();do{const page=await transport.list({bucket,prefix:key(name),cursor});if(!Array.isArray(page.keys))throw new Error('Invalid storage listing');for(const k of page.keys){if(!k.startsWith(key(name)))throw new Error('Storage listing escaped backup scope');keys.push(k.slice(prefix.length));}cursor=page.nextCursor;if(cursor&&seen.has(cursor))throw new Error('Storage pagination did not advance');seen.add(cursor);}while(cursor);return keys.sort();}};
}
