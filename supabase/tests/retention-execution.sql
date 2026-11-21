-- Entire rollback-only verification after reviewed migration 014. No Storage calls.
BEGIN;
DO $$
DECLARE v_actor uuid:=gen_random_uuid();v_content uuid:=gen_random_uuid();v_old uuid:=gen_random_uuid();v_head uuid:=gen_random_uuid();v_plan uuid:=gen_random_uuid();v_receipt uuid;v_result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210014_retention_execution') THEN RAISE EXCEPTION 'Migration 014 required.';END IF;
 IF has_function_privilege('anon','public.farm_retention_execute(uuid,uuid,integer)','EXECUTE') OR has_function_privilege('authenticated','public.farm_retention_execute(uuid,uuid,integer)','EXECUTE') OR NOT has_function_privilege('service_role','public.farm_retention_execute(uuid,uuid,integer)','EXECUTE') THEN RAISE EXCEPTION 'FAIL: retention grants.';END IF;
 -- Isolate even if an owner previously configured retention; all settings roll back.
 UPDATE farm_private.retention_configuration SET enabled=false WHERE singleton;
 BEGIN PERFORM public.farm_retention_execute(gen_random_uuid(),gen_random_uuid(),1);RAISE EXCEPTION 'FAIL: disabled retention accepted.';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM public.farm_retention_configure('abcdefghijklmnopqrst',true);
 BEGIN PERFORM public.farm_retention_backup_record('{"sourceRef":"abcdefghijklmnopqrst","offsite":true,"restoreDrillVerified":true,"setId":"rollback-only","manifestSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","verifiedAt":"2000-01-01T00:00:00Z"}');RAISE EXCEPTION 'FAIL: stale proof accepted.';EXCEPTION WHEN OTHERS THEN IF SQLERRM='FAIL: stale proof accepted.' THEN RAISE;END IF;END;
 INSERT INTO auth.users(id,email) VALUES(v_actor,'retention-verification-'||v_actor||'@example.test');
 INSERT INTO public.farm_content(id,kind,draft_revision,payload) VALUES(v_content,'post',2,'{}');
 INSERT INTO public.farm_revisions(id,content_id,revision,payload,actor_id,created_at) VALUES(v_old,v_content,1,'{}',v_actor,now()-interval '100 days'),(v_head,v_content,2,'{}',v_actor,now()-interval '100 days');
 INSERT INTO farm_private.media_retention_plans(id,actor_id,plan) VALUES(v_plan,v_actor,jsonb_build_object('expiredRevisionIds',jsonb_build_array(v_old,v_head),'purgeMediaIds','[]'::jsonb));
 v_receipt:=public.farm_retention_backup_record(jsonb_build_object('sourceRef','abcdefghijklmnopqrst','offsite',true,'restoreDrillVerified',true,'setId','rollback-only','manifestSha256',repeat('b',64),'verifiedAt',clock_timestamp()));
 v_result:=public.farm_retention_execute(v_plan,v_receipt,25);
 IF v_result->>'prunedRevisions'<>'1' OR EXISTS(SELECT 1 FROM public.farm_revisions WHERE id=v_old) OR NOT EXISTS(SELECT 1 FROM public.farm_revisions WHERE id=v_head) THEN RAISE EXCEPTION 'FAIL: bounded pruning/current revision preservation.';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: service grants, disabled execution, stale backup rejection, bounded old-revision pruning and current revision preservation; fixtures/settings rolled back. Real backup, restore and Storage cleanup remain separate.' AS result;
