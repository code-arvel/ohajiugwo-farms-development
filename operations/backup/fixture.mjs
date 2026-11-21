import { mkdtemp, writeFile, readFile, mkdir, realpath } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { filesystemDestination } from './filesystem.mjs';
import { createBackup, restoreBackup } from './index.mjs';
const photo=Buffer.from([0,255,3,8,21,0,89]);
const sql="CREATE TABLE fixture_fruit(id integer PRIMARY KEY, name text); INSERT INTO fixture_fruit VALUES (1,'Bananas');";
const sha=b=>createHash('sha256').update(b).digest('hex');
async function collect(stream){const chunks=[];let size=0;for await(const b of stream){size+=b.length;if(size>1024*1024)throw new Error('Fixture exceeds bounded size');chunks.push(b);}return Buffer.concat(chunks);}
export async function runBackupFixture(){
  const fixtureRoot=await mkdtemp(path.join(os.tmpdir(),'farm-backup-fixture-'));const ownerKey=randomBytes(32);await mkdir(path.join(fixtureRoot,'owner-keys'),{mode:0o700});await writeFile(path.join(fixtureRoot,'owner-keys/recovery.key'),ownerKey,{mode:0o600});
  const source={identity:'fixture:source',async snapshot(){return {database:Buffer.from(sql),content:{heading:'Fixture farm'},schema:[{name:'fixture.sql',sha256:sha(Buffer.from(sql)),sql}],releases:[{id:'fixture-release',status:'local-only'}],securityInventory:{memberships:[{id:'revoked-fixture',active:false}],authIdentities:[],sessions:[]},media:[{id:'fixture-photo',version:'v1',checksum:sha(photo)}]};},async openMedia(){return photo;}};
  const destination=await filesystemDestination({root:path.join(fixtureRoot,'private-backups'),identity:'fixture:private-backups'});const backup=await createBackup({enabled:true,source,destination,ownerKey,keyId:'fixture-key'});await writeFile(path.join(fixtureRoot,'fixture.json'),JSON.stringify({format:'farm-backup-disposable-fixture-v1',setId:backup.setId}),{mode:0o600});return {fixtureRoot,setId:backup.setId,verified:true,fixtureOnly:true};
}
export async function runRestoreFixture(fixtureRoot){
  if(!path.isAbsolute(fixtureRoot??'')||path.dirname(fixtureRoot)!==os.tmpdir()||!path.basename(fixtureRoot).startsWith('farm-backup-fixture-')||await realpath(fixtureRoot)!==fixtureRoot)throw new Error('Explicit disposable fixture root required');const marker=JSON.parse(await readFile(path.join(fixtureRoot,'fixture.json'),'utf8'));if(marker.format!=='farm-backup-disposable-fixture-v1')throw new Error('Unknown fixture');const ownerKey=await readFile(path.join(fixtureRoot,'owner-keys/recovery.key'));const destination=await filesystemDestination({root:path.join(fixtureRoot,'private-backups'),identity:'fixture:private-backups'});const isolatedRoot=await mkdtemp(path.join(fixtureRoot,'isolated-restore-'));const db=new PGlite(path.join(isolatedRoot,'database'));let gotPhoto,content,security;
  try{await restoreBackup({setId:marker.setId,destination,ownerKey,keyId:'fixture-key',target:{identity:`fixture:isolated:${path.basename(isolatedRoot)}`,isolated:true,async recordSecurityReview(data){security=data;await writeFile(path.join(isolatedRoot,'security-review.json'),JSON.stringify(data),{mode:0o600});},async restoreDatabase(stream){await db.exec((await collect(stream)).toString('utf8'));},async restoreContent(data){content=data;await writeFile(path.join(isolatedRoot,'content.json'),JSON.stringify(data),{mode:0o600});},async writeMedia(ref,stream){gotPhoto=await collect(stream);await writeFile(path.join(isolatedRoot,'original.photo'),gotPhoto,{mode:0o600});}}});const rows=await db.query('SELECT id,name FROM fixture_fruit');assert.deepEqual(rows.rows,[{id:1,name:'Bananas'}]);assert.deepEqual(await readFile(path.join(isolatedRoot,'original.photo')),photo);assert.equal(content.heading,'Fixture farm');assert.equal(security.activationAllowed,false);assert.equal(security.sessionsMustBeReset,true);return {fixtureOnly:true,isolatedRoot,databaseRowsVerified:rows.rows.length,photoBytesVerified:true,contentVerified:true,securityReviewRequired:true};}finally{await db.close();}
}
