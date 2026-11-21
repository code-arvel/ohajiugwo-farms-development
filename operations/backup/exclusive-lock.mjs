import {randomUUID} from 'node:crypto';
// Fail-closed cross-runner lock: never steal an abandoned lock automatically.
// An operator must prove the old runner stopped before explicitly removing one.
export function createS3ExclusiveLock({transport,bucket,prefix,now=()=>new Date()}){
 if(!transport||typeof bucket!=='string'||!prefix?.endsWith('/'))throw Error('Scoped destination lock required.');
 const key=prefix+'maintenance.lock';return async work=>{const owner=randomUUID(),body=Buffer.from(JSON.stringify({owner,startedAt:now().toISOString()}));let acquired=false;try{await transport.put({bucket,key,body,ifNoneMatch:'*',acl:'private'});acquired=true;return await work();}catch(error){if(!acquired)throw Error('Independent backup destination is locked or its outcome needs review.');throw error;}finally{if(acquired){const current=await transport.get({bucket,key,maxBytes:4096});if(!Buffer.from(current).equals(body))throw Error('Backup destination lock ownership changed; no unlock attempted.');await transport.delete({bucket,key});}}};
}
