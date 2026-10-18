import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localDatabase} from './fixtures/local-sql.mjs';

test('content migration refuses duplicate active slugs without changing existing rows',async()=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql']);try{
  await db.exec(`INSERT INTO public.farm_content(id,kind,payload) VALUES
   ('11111111-1111-4111-8111-111111111111','post','{"slug":"same-slug"}'::jsonb),
   ('22222222-2222-4222-8222-222222222222','post','{"slug":"same-slug"}'::jsonb)`);
  const sql=await readFile('supabase/migrations/202610170007_content_commands.sql','utf8');
  await assert.rejects(()=>db.exec(sql),/Resolve duplicate active post slugs/);
  await db.exec('ROLLBACK;');
  assert.equal((await db.query(`SELECT count(*)::int AS count FROM public.farm_content WHERE payload->>'slug'='same-slug'`)).rows[0].count,2);
  assert.equal((await db.query(`SELECT count(*)::int AS count FROM farm_private.schema_migrations WHERE version='202610170007_content_commands'`)).rows[0].count,0);
 }finally{await db.close();}
});
