import { mkdir, readFile, readdir, unlink, rmdir, open, realpath } from 'node:fs/promises';
import path from 'node:path';

/** Local private fixture adapter. File creation is exclusive and owner-readable only. */
export async function filesystemDestination({root,identity}) {
  if(!path.isAbsolute(root)||!identity)throw new Error('Absolute private backup root and identity required');
  await mkdir(root,{recursive:true,mode:0o700});const canonical=await realpath(root);if(canonical!==path.resolve(root))throw new Error('Backup root must not be symlinked');
  function file(key){if(!/^[a-zA-Z0-9_./-]*$/.test(key)||key.split('/').some(x=>x==='..'||x==='.')||key.startsWith('/'))throw new Error('Unsafe storage key');return path.join(root,key);}
  async function list(prefix){const keys=[];async function walk(dir,rel=''){for(const e of await readdir(dir,{withFileTypes:true})){if(e.name==='.backup-lock')continue;const key=rel+e.name;if(e.isSymbolicLink())throw new Error('Symlink in backup storage');if(e.isDirectory())await walk(path.join(dir,e.name),key+'/');else if(key.startsWith(prefix))keys.push(key);}}await walk(root);return keys.sort();}
  return {identity,private:true,async putIfAbsent(key,body){const p=file(key);await mkdir(path.dirname(p),{recursive:true,mode:0o700});let f;try{f=await open(p,'wx',0o600);}catch(e){if(e.code==='EEXIST')return;throw e;}try{await f.writeFile(body);await f.sync();}finally{await f.close();}},async get(key){return readFile(file(key));},list,async delete(key){await unlink(file(key));},async withLock(fn){const lock=path.join(root,'.backup-lock');try{await mkdir(lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw new Error('Backup storage locked; concurrent writer or stale lock requires review');throw e;}try{return await fn();}finally{await rmdir(lock);}}};
}
