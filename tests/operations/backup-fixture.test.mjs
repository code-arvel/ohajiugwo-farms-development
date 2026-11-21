import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';

test('fixture CLIs require explicit fixture mode then verify actual isolated SQL rows and photo bytes',async(t)=>{
 const denied=spawnSync(process.execPath,['scripts/backup-fixture.mjs'],{encoding:'utf8'});assert.notEqual(denied.status,0);
 const run=spawnSync(process.execPath,['scripts/backup-fixture.mjs','--fixture'],{encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stderr);const backup=JSON.parse(run.stdout);t.after(()=>rm(backup.fixtureRoot,{recursive:true,force:true}));
 const restore=spawnSync(process.execPath,['scripts/restore-fixture.mjs','--fixture-root',backup.fixtureRoot],{encoding:'utf8',timeout:30000});assert.equal(restore.status,0,restore.stderr);const result=JSON.parse(restore.stdout);assert.equal(result.databaseRowsVerified,1);assert.equal(result.photoBytesVerified,true);assert.equal(result.contentVerified,true);assert.equal(result.securityReviewRequired,true);
 const rejected=spawnSync(process.execPath,['scripts/restore-fixture.mjs','--fixture-root','/tmp'],{encoding:'utf8'});assert.notEqual(rejected.status,0);
});
