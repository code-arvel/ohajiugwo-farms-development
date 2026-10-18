-- Entire verification is transaction-scoped and rollback-only; no Storage API request occurs here.
BEGIN;
DO $$ DECLARE v_proc regprocedure;BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170008_private_media') THEN RAISE EXCEPTION 'Migration 008 is missing.';END IF;
 FOREACH v_proc IN ARRAY ARRAY['public.farm_media_reserve(text,text,bigint)'::regprocedure,'public.farm_media_claim(text,uuid,uuid)'::regprocedure,
  'public.farm_media_ready(text,uuid,uuid,integer,integer,text,bigint,text)'::regprocedure,'public.farm_media_quarantine(text,uuid)'::regprocedure,
  'public.farm_media_list(text)'::regprocedure,'public.farm_media_preview_path(text,uuid,uuid)'::regprocedure,'public.farm_media_remove(text,uuid)'::regprocedure,
  'public.farm_media_cleanup_claim(uuid,integer)'::regprocedure,'public.farm_media_cleanup_finish(uuid,uuid,boolean)'::regprocedure,
  'public.farm_media_expired_cleanup_enqueue(integer)'::regprocedure] LOOP
  IF has_function_privilege('anon',v_proc,'EXECUTE') OR has_function_privilege('authenticated',v_proc,'EXECUTE') OR NOT has_function_privilege('service_role',v_proc,'EXECUTE') THEN RAISE EXCEPTION 'FAIL: private media grants.';END IF;
 END LOOP;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM public.farm_media_list(repeat('a',43));RAISE EXCEPTION 'FAIL: anonymous media listing allowed.';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
DO $$ DECLARE v_user uuid:=gen_random_uuid();v_cookie text:=repeat('b',43);v_res jsonb;v_owner uuid:=gen_random_uuid();v_jobs jsonb;v_result jsonb;v_stage text:='insert';
BEGIN
 BEGIN
 INSERT INTO auth.users(id,aud,role,email) VALUES(v_user,'authenticated','authenticated','media-'||v_user||'@example.test');
 v_stage:='membership';INSERT INTO farm_private.memberships(user_id,state) VALUES(v_user,'active');
 v_stage:='session';
 PERFORM public.farm_session_open(v_user,gen_random_uuid()::text,v_cookie,'dummy-sealed-session',repeat('c',43));
 v_stage:='invalid type';
 BEGIN PERFORM public.farm_media_reserve(v_cookie,'image/svg+xml',100);RAISE EXCEPTION 'FAIL: unsupported upload type accepted.';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 v_stage:='reserve';
 v_res:=public.farm_media_reserve(v_cookie,'image/png',1200);
 IF v_res->>'upload_path' NOT LIKE 'staging/%/source' OR v_res->>'original_path' NOT LIKE 'media/%/original.webp' THEN RAISE EXCEPTION 'FAIL: opaque private paths.';END IF;
 v_stage:='claim';IF public.farm_media_claim(v_cookie,(v_res->>'id')::uuid,v_owner) IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: media claim lease.';END IF;
 IF public.farm_media_ready(v_cookie,(v_res->>'id')::uuid,gen_random_uuid(),800,600,'image/webp',900,repeat('a',64)) IS NOT FALSE OR
  public.farm_media_ready(v_cookie,(v_res->>'id')::uuid,v_owner,800,600,'image/webp',900,repeat('a',64)) IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: owner-bound media publication.';END IF;
 v_result:=public.farm_media_list(v_cookie);IF jsonb_array_length(v_result)<>1 OR v_result->0->'metadata'->>'mimeType'<>'image/webp' OR v_result::text LIKE '%original_path%' THEN RAISE EXCEPTION 'FAIL: safe private media list.';END IF;
 IF public.farm_media_preview_path(v_cookie,(v_res->>'media_id')::uuid,(v_res->>'version_id')::uuid) IS DISTINCT FROM v_res->>'preview_path' THEN RAISE EXCEPTION 'FAIL: active preview lookup.';END IF;
 IF public.farm_media_remove(v_cookie,(v_res->>'media_id')::uuid) IS NOT TRUE OR jsonb_array_length(public.farm_media_list(v_cookie))<>0 THEN RAISE EXCEPTION 'FAIL: private media removal.';END IF;
 SELECT jsonb_agg(j) INTO v_jobs FROM public.farm_media_cleanup_claim(v_owner,5) AS j;
 IF jsonb_array_length(v_jobs)<>1 OR jsonb_array_length(v_jobs->0->'paths')<>2 THEN RAISE EXCEPTION 'FAIL: durable private object cleanup claim.';END IF;
 IF public.farm_media_cleanup_finish((v_jobs->0->>'id')::uuid,gen_random_uuid(),true) IS NOT FALSE OR public.farm_media_cleanup_finish((v_jobs->0->>'id')::uuid,v_owner,false) IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: lease-bound cleanup retry.';END IF;
 UPDATE farm_private.media_cleanup SET state='done',lease_owner=NULL,lease_until=NULL WHERE id=(v_jobs->0->>'id')::uuid;
 v_res:=public.farm_media_reserve(v_cookie,'image/png',1300);
 UPDATE farm_private.media_uploads SET expires_at=clock_timestamp()-interval '1 second' WHERE id=(v_res->>'id')::uuid;
 IF public.farm_media_expired_cleanup_enqueue(10)<>1 THEN RAISE EXCEPTION 'FAIL: expired upload reconciliation.';END IF;
 SELECT jsonb_agg(j) INTO v_jobs FROM public.farm_media_cleanup_claim(v_owner,5) AS j;
 IF jsonb_array_length(v_jobs)<>1 OR jsonb_array_length(v_jobs->0->'paths')<>3 THEN RAISE EXCEPTION 'FAIL: abandoned upload paths were not durably queued.';END IF;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'private media fixture failed at %: %',v_stage,SQLERRM;END;
END $$;
ROLLBACK;
SELECT 'PASS: service-only grants, strict upload reservation, owner leases, private preview lookup, safe metadata, removal and durable Storage cleanup retry checked; all fixtures rolled back. Actual Storage API, image binding, HTTP and hosted concurrency remain separate.' AS result;
