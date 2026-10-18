// Fresh embedded PostgreSQL only. Managed Supabase schemas/JWT plumbing are explicit stubs.
// Loading prerequisites here never contacts or reapplies anything to hosted Supabase.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export async function localDatabase(extra=[]){
 const db=new PGlite();
 try{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
   CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,aud text,role text,email text,email_confirmed_at timestamptz,encrypted_password text);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO authenticated;
   CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY);CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
  for(const file of ['202610160001_security_foundation.sql','202610160002_session_commands.sql','202610160003_first_admin.sql','202610170004_reauthentication.sql',...extra])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  return db;
 }catch(error){await db.close();throw error;}
}
