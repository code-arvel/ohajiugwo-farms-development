import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{localDatabase}from'./fixtures/local-sql.mjs';
test('owner-run rollback scripts execute in isolated local PostgreSQL fixtures only',async()=>{
 for(const [file,migrations,expected] of [
  ['durable-cleanup.sql',['202610170005_durable_cleanup.sql'],'durable cleanup grants'],
  ['account-lifecycle.sql',['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql'],'equal-admin grants'],
  ['content-commands.sql',['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql','202610170007_content_commands.sql'],'authenticated session gates'],
  ['private-media.sql',['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql','202610170007_content_commands.sql','202610170008_private_media.sql'],'service-only grants'],
  ['media-content-refs.sql',['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql','202610170007_content_commands.sql','202610170008_private_media.sql','202610170009_media_content_refs.sql'],'revision references accept only ready private media']
 ]){
  const db=await localDatabase(migrations);try{let result;try{result=await db.exec(await readFile(`supabase/tests/${file}`,'utf8'));}catch(error){error.message=`${file}: ${error.message}`;throw error;}assert.match(JSON.stringify(result),new RegExp(expected));}finally{await db.close();}
 }
});
