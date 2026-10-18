-- Run after migration 202610160002, before real administrator bootstrap.
-- Disposable database fixtures only. No password, email or provider tokens created.
BEGIN;
DO $$
DECLARE v_signature regprocedure;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610160002_session_commands') THEN
  RAISE EXCEPTION 'Session migration is missing.';
 END IF;
 FOREACH v_signature IN ARRAY ARRAY[
  'public.farm_session_open(uuid,text,text,text,text)'::regprocedure,
  'public.farm_session_read(text)'::regprocedure,
  'public.farm_session_close(text)'::regprocedure,
  'public.farm_session_cleanup_done(uuid)'::regprocedure,
  'public.farm_session_refresh_claim(text,uuid)'::regprocedure,
  'public.farm_session_refresh_finish(text,uuid,integer,text)'::regprocedure,
  'public.farm_session_refresh_release(text,uuid)'::regprocedure,
  'public.farm_auth_attempt(text,integer,integer)'::regprocedure,
  'public.farm_bootstrap_reserve(text,text)'::regprocedure
 ] LOOP
  IF has_function_privilege('anon',v_signature,'EXECUTE') OR has_function_privilege('authenticated',v_signature,'EXECUTE')
   OR NOT has_function_privilege('service_role',v_signature,'EXECUTE') THEN
   RAISE EXCEPTION 'FAIL: service command privileges are incorrect.';
  END IF;
 END LOOP;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM public.farm_session_read(repeat('c',43));
  RAISE EXCEPTION 'FAIL: anonymous session command permitted.';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.farm_bootstrap_reserve('fixture@example.test',repeat('n',43));
  RAISE EXCEPTION 'FAIL: browser bootstrap command permitted.';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
DO $$
DECLARE v_user_id uuid:=gen_random_uuid(); v_provider_id uuid:=gen_random_uuid(); v_cookie text:=repeat('c',43);
 v_owner_one uuid:=gen_random_uuid(); v_owner_two uuid:=gen_random_uuid(); v_result jsonb; v_blocked boolean:=false;
 v_allowed_one boolean; v_allowed_two boolean; v_allowed_three boolean;
BEGIN
 IF (SELECT g.active_count FROM farm_private.admin_guard AS g WHERE g.singleton)<>0
 OR EXISTS(SELECT 1 FROM farm_private.invitations AS invitation WHERE invitation.state IN('queued','sent')) THEN
  RAISE EXCEPTION 'Run disposable tests before real administrator setup; existing state was not changed.';
 END IF;
 v_result:=public.farm_bootstrap_reserve('fixture@example.test',repeat('n',43));
 IF v_result->>'state'<>'queued' THEN RAISE EXCEPTION 'FAIL: bootstrap reservation not recorded.'; END IF;
 BEGIN PERFORM public.farm_bootstrap_reserve('other@example.test',repeat('o',43));
 EXCEPTION WHEN raise_exception THEN v_blocked:=true; END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: parallel bootstrap reservation allowed.'; END IF;
 INSERT INTO auth.users(id,aud,role,email) VALUES(v_user_id,'authenticated','authenticated','session-test-'||v_user_id||'@example.test');
 BEGIN
  PERFORM public.farm_session_open(v_user_id,v_provider_id::text,v_cookie,'encrypted-fixture',repeat('s',43));
  RAISE EXCEPTION 'FAIL: non-member session permitted.';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 INSERT INTO farm_private.memberships(user_id,state) VALUES(v_user_id,'active');
 v_blocked:=false;
 BEGIN PERFORM public.farm_bootstrap_reserve('another@example.test',repeat('b',43));
 EXCEPTION WHEN raise_exception THEN v_blocked:=true; END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: bootstrap remained open after activation.'; END IF;
 v_result:=public.farm_session_open(v_user_id,v_provider_id::text,v_cookie,'encrypted-fixture',repeat('s',43));
 IF extract(epoch FROM ((v_result->>'absolute_expires_at')::timestamptz-now()))<>43200
 OR extract(epoch FROM ((v_result->>'idle_expires_at')::timestamptz-now()))<>1800 THEN
  RAISE EXCEPTION 'FAIL: session time limits differ from the plan.';
 END IF;
 IF public.farm_session_read(v_cookie) IS NULL THEN RAISE EXCEPTION 'FAIL: active session rejected.'; END IF;
 v_result:=public.farm_session_refresh_claim(v_cookie,v_owner_one);
 IF v_result IS NULL OR public.farm_session_refresh_claim(v_cookie,v_owner_two) IS NOT NULL THEN
  RAISE EXCEPTION 'FAIL: refresh lease is not exclusive.';
 END IF;
 IF public.farm_session_refresh_finish(v_cookie,v_owner_two,0,'wrong-owner') THEN RAISE EXCEPTION 'FAIL: wrong refresh owner accepted.'; END IF;
 IF NOT public.farm_session_refresh_finish(v_cookie,v_owner_one,0,'rotated-fixture') THEN RAISE EXCEPTION 'FAIL: correct refresh commit rejected.'; END IF;
 PERFORM public.farm_session_refresh_claim(v_cookie,v_owner_two);
 IF public.farm_session_refresh_finish(v_cookie,v_owner_two,0,'stale-fixture') THEN RAISE EXCEPTION 'FAIL: stale refresh version accepted.'; END IF;
 PERFORM public.farm_session_refresh_release(v_cookie,v_owner_two);
 PERFORM public.farm_session_refresh_claim(v_cookie,v_owner_one);
 v_result:=public.farm_session_close(v_cookie);
 IF NOT (v_result->>'provider_cleanup_pending')::boolean OR public.farm_session_read(v_cookie) IS NOT NULL THEN
  RAISE EXCEPTION 'FAIL: logout did not revoke application access.';
 END IF;
 IF public.farm_session_refresh_finish(v_cookie,v_owner_one,1,'revived-fixture') THEN RAISE EXCEPTION 'FAIL: refresh revived logged-out session.'; END IF;
 PERFORM public.farm_session_cleanup_done((v_result->>'id')::uuid);
 v_allowed_one:=public.farm_auth_attempt(repeat('a',43),2,60);
 v_allowed_two:=public.farm_auth_attempt(repeat('a',43),2,60);
 v_allowed_three:=public.farm_auth_attempt(repeat('a',43),2,60);
 IF v_allowed_one IS DISTINCT FROM true OR v_allowed_two IS DISTINCT FROM true OR v_allowed_three IS DISTINCT FROM false THEN RAISE EXCEPTION 'FAIL: durable attempt limit failed.'; END IF;
 UPDATE farm_private.auth_attempts AS attempt SET window_start=now()-interval '61 seconds' WHERE attempt.scope_hash=repeat('a',43);
 IF NOT public.farm_auth_attempt(repeat('a',43),2,60) THEN RAISE EXCEPTION 'FAIL: rate window did not reset.'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: session command privileges, leases, logout, limits and bootstrap reservation checked; fixtures rolled back. Actual provider/HTTP tests remain separate.' AS result;
