-- Entire rollback-only verification after separately reviewed migration 005.
-- SQL fixtures use dummy encrypted values; provider/token correctness is separate.
BEGIN;
DO $$ DECLARE v_proc regprocedure;BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170005_durable_cleanup') THEN RAISE EXCEPTION 'Migration 005 is missing.';END IF;
 FOREACH v_proc IN ARRAY ARRAY['public.farm_cleanup_claim(uuid,integer)'::regprocedure,'public.farm_cleanup_renew(uuid,uuid)'::regprocedure,'public.farm_cleanup_progress(uuid,uuid,integer)'::regprocedure,'public.farm_cleanup_finish(uuid,uuid,text)'::regprocedure] LOOP
  IF has_function_privilege('anon',v_proc,'EXECUTE') OR has_function_privilege('authenticated',v_proc,'EXECUTE') OR NOT has_function_privilege('service_role',v_proc,'EXECUTE') THEN RAISE EXCEPTION 'FAIL: cleanup command grants.';END IF;
 END LOOP;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM public.farm_cleanup_claim(gen_random_uuid(),1);RAISE EXCEPTION 'FAIL: anonymous cleanup allowed.';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
DO $$ DECLARE v_user uuid:=gen_random_uuid();v_owner uuid:=gen_random_uuid();v_row jsonb;v_jobs jsonb;v_job jsonb;v_id uuid;v_encrypted text;
BEGIN
 INSERT INTO auth.users(id,email) VALUES(v_user,'cleanup-'||v_user||'@example.test');INSERT INTO farm_private.memberships(user_id,state) VALUES(v_user,'active');
 v_row:=public.farm_session_open(v_user,gen_random_uuid()::text,substr(replace(gen_random_uuid()::text,'-','')||repeat('x',11),1,43),'dummy-sealed-session',repeat('a',43));
 IF public.farm_session_close(v_row->>'cookie_hash') IS NULL THEN RAISE EXCEPTION 'FAIL: fixture session close.';END IF;
 v_jobs:=public.farm_cleanup_claim(v_owner,10);IF jsonb_array_length(v_jobs)<>1 THEN RAISE EXCEPTION 'FAIL: cleanup claim or atomic source transfer.';END IF;
 v_job:=v_jobs->0;v_id:=(v_job->>'id')::uuid;
 IF NOT public.farm_cleanup_renew(v_id,v_owner) OR NOT public.farm_cleanup_progress(v_id,v_owner,1) OR public.farm_cleanup_progress(v_id,v_owner,1) THEN RAISE EXCEPTION 'FAIL: cleanup lease/progress ownership.';END IF;
 IF NOT public.farm_cleanup_finish(v_id,v_owner,'done') OR public.farm_session_read(v_row->>'cookie_hash') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: cleanup acknowledgement.';END IF;
 IF jsonb_array_length(public.farm_cleanup_claim(v_owner,10))<>0 THEN RAISE EXCEPTION 'FAIL: completed cleanup replayed.';END IF;
 -- Expiry invalidates a session before any cleanup job is returned.
 v_encrypted:='dummy-sealed-expired-session';
 v_row:=public.farm_session_open(v_user,gen_random_uuid()::text,substr(replace(gen_random_uuid()::text,'-','')||repeat('x',11),1,43),v_encrypted,repeat('b',43));
 UPDATE farm_private.sessions SET idle_expires_at=clock_timestamp()-interval '1 second' WHERE id=(v_row->>'id')::uuid;
 v_jobs:=public.farm_cleanup_claim(v_owner,10);
 IF jsonb_array_length(v_jobs)<>1 OR public.farm_session_read(v_row->>'cookie_hash') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: expired session stayed active.';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: durable cleanup grants, atomic claim, lease/progress ownership, acknowledgement, no replay and expiry invalidation checked; fixtures rolled back. Provider HTTP/sign-out and worker scheduling remain separate.' AS result;
