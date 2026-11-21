import {StringDecoder} from 'node:string_decoder';
import { spawn as nodeSpawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { pgDumpSource } from './adapters.mjs';
import { postgresEnvironment, verifyPassfile } from './postgres-env.mjs';
export { postgresEnvironment } from './postgres-env.mjs';

// Fixed SQL only: callers cannot supply queries, identifiers, clauses or SQL values.
// All application rows belong in the encrypted export; active access/job state does not.
const INVENTORY_SQL = `SELECT jsonb_build_object(
 'snapshotId',pg_export_snapshot(),
 'inventory',jsonb_build_object(
  'schema',jsonb_build_object(
   'databaseVersion',current_setting('server_version'),
   'migrations',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.version) FROM farm_private.schema_migrations m),'[]'::jsonb),
   'tables',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) ORDER BY n.nspname,c.relname) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','farm_private') AND c.relkind IN ('r','p')),'[]'::jsonb),
   'policies',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname) FROM pg_catalog.pg_policies p WHERE p.schemaname IN ('public','farm_private')),'[]'::jsonb)
  ),
  'content',jsonb_build_object(
   'records',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.farm_content c),'[]'::jsonb),
   'revisions',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.content_id,r.revision) FROM public.farm_revisions r),'[]'::jsonb),
   'media',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM public.farm_media m),'[]'::jsonb),
   'mediaVersions',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM public.farm_media_versions v),'[]'::jsonb),
   'mediaUsages',coalesce((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.revision_id,u.media_version_id) FROM public.farm_media_usages u),'[]'::jsonb)
  ),
  'releases',jsonb_build_object(
   'snapshots',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at,r.id) FROM farm_private.releases r),'[]'::jsonb),
   'state',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM farm_private.release_state s),'[]'::jsonb),
   'mediaRefs',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.release_id,r.media_version_id) FROM farm_private.release_media_refs r),'[]'::jsonb)
  ),
  'media',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.media_id::text,'version',v.id::text,'path',v.original_path,'checksum',v.checksum) ORDER BY v.id) FROM public.farm_media_versions v WHERE v.state='ready'),'[]'::jsonb),
  'securityInventory',jsonb_build_object(
   'activationAllowed',false,
   'memberships',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.user_id) FROM farm_private.memberships m),'[]'::jsonb),
   'authUsers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'encrypted_password',u.encrypted_password,'email_confirmed_at',u.email_confirmed_at,'phone',u.phone,'phone_confirmed_at',u.phone_confirmed_at,'role',u.role,'aud',u.aud,'created_at',u.created_at,'updated_at',u.updated_at,'raw_app_meta_data',u.raw_app_meta_data,'raw_user_meta_data',u.raw_user_meta_data) ORDER BY u.id) FROM auth.users u WHERE EXISTS(SELECT 1 FROM farm_private.memberships m WHERE m.user_id=u.id)),'[]'::jsonb),
   'authIdentities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'user_id',i.user_id,'provider',i.provider,'provider_id',to_jsonb(i)->'provider_id','identity_data',jsonb_build_object('sub',i.identity_data->'sub','email',i.identity_data->'email','email_verified',i.identity_data->'email_verified','phone_verified',i.identity_data->'phone_verified'),'created_at',i.created_at,'updated_at',i.updated_at) ORDER BY i.id) FROM auth.identities i WHERE EXISTS(SELECT 1 FROM farm_private.memberships m WHERE m.user_id=i.user_id)),'[]'::jsonb)
  )
 )
)::text;`;

/** Maintains a real psql transaction open while pg_dump imports its snapshot. */
export function psqlSnapshotProvider({binary,connectionEnv,spawn=nodeSpawn,timeoutMs=300000}) {
  if (!path.isAbsolute(binary ?? '') || !Number.isInteger(timeoutMs) || timeoutMs<1 || timeoutMs>900000) throw new Error('Explicit bounded psql configuration required');
  const env=postgresEnvironment(connectionEnv);
  return async function snapshotProvider() {
    await verifyPassfile(env.PGPASSFILE);
    const marker=`FARM_BACKUP_READY_${randomBytes(16).toString('hex')}`;
    let child;try{child=spawn(binary,['-X','--no-password','--quiet','--tuples-only','--no-align','--set=ON_ERROR_STOP=1'],{env,shell:false,stdio:['pipe','pipe','ignore']});}catch{throw new Error('Database snapshot session failed');}
    const decoder=new StringDecoder('utf8');
    let resolveReady,rejectReady,resolveClosed,settled=false,released=false,output='',payload,received=0;
    const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const closed=new Promise(resolve=>{resolveClosed=resolve;});
    const fail=()=>{if(!settled){settled=true;rejectReady(new Error('Database snapshot session failed'));}};
    const timer=setTimeout(()=>{fail();child.kill('SIGKILL');},timeoutMs);
    child.once('error',()=>{fail();resolveClosed(false);});
    child.once('close',code=>{clearTimeout(timer);fail();resolveClosed(code===0);});
    child.stdin.on('error',()=>{fail();child.kill('SIGKILL');});
    child.stdout.on('error',()=>{fail();child.kill('SIGKILL');});
    child.stdout.on('data',chunk=>{
      received+=chunk.length;if(received>16*1024*1024){fail();child.kill('SIGKILL');return;}output+=decoder.write(chunk);
      let newline;while((newline=output.indexOf('\n'))!==-1){const line=output.slice(0,newline).replace(/\r$/,'');output=output.slice(newline+1);if(!line)continue;
        if(line===marker){try{const value=JSON.parse(payload);if(!/^[a-fA-F0-9-]+$/.test(value.snapshotId??'')||!value.inventory?.content||!value.inventory?.schema||!value.inventory?.releases||!Array.isArray(value.inventory?.media)||!value.inventory?.securityInventory)throw new Error();if(!settled){settled=true;resolveReady(value);}}catch{fail();child.kill('SIGKILL');}}
        else if(!settled){if(payload!==undefined){fail();child.kill('SIGKILL');return;}payload=line;}
      }
    });
    child.stdin.write(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n${INVENTORY_SQL}\n\\echo ${marker}\n`);
    let data;try{data=await ready;}catch{clearTimeout(timer);child.kill('SIGKILL');throw new Error('Database snapshot session failed');}
    return {...data,async release(){if(released)return;released=true;child.stdin.end('ROLLBACK;\n\\q\n');if(!await closed)throw new Error('Database snapshot session failed');}};
  };
}

/** Complete pg_dump + fixed inventory source. Originals are read through the supplied private media reader. */
export function createPostgresBackupSource({identity,psqlBinary,pgDumpBinary,connectionEnv,openMedia,spawn=nodeSpawn,timeoutMs=300000}) {
  const env=postgresEnvironment(connectionEnv);
  return pgDumpSource({identity,binary:pgDumpBinary,connectionEnv,openMedia,spawn,timeoutMs,snapshotProvider:psqlSnapshotProvider({binary:psqlBinary,connectionEnv,spawn,timeoutMs})});
}
