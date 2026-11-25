-- Owner/postgres in ohajiugwo-development after reviewed migration015.
-- Run ENTIRE file. Disposable SQL fixtures only; all rows/settings roll back.
-- No provider requests, live account creation, emails, token refresh or global logout.
BEGIN;
DO $$
DECLARE
 v_user uuid:=gen_random_uuid();v_provider uuid:=gen_random_uuid();v_active uuid:=gen_random_uuid();v_app uuid:=gen_random_uuid();
 v_job uuid:=gen_random_uuid();v_owner uuid:=gen_random_uuid();v_cookie text:=replace(gen_random_uuid()::text,'-','')||repeat('x',11);
 v_expiry timestamptz:=clock_timestamp()-interval '1 minute';v_other_count bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611250015_session_reconciliation') THEN RAISE EXCEPTION 'Migration015 required.';END IF;
 IF has_function_privilege('anon','public.farm_cleanup_session_reconcile(uuid,uuid,uuid,uuid,timestamptz)','EXECUTE')
  OR has_function_privilege('authenticated','public.farm_cleanup_session_reconcile(uuid,uuid,uuid,uuid,timestamptz)','EXECUTE')
  OR NOT has_function_privilege('service_role','public.farm_cleanup_session_reconcile(uuid,uuid,uuid,uuid,timestamptz)','EXECUTE')
  OR has_table_privilege('service_role','auth.sessions','DELETE') THEN RAISE EXCEPTION 'FAIL: command/direct-table privileges.';END IF;
 PERFORM farm_private.require_session_cleanup_schema();
 SELECT count(*) INTO v_other_count FROM auth.sessions;
 INSERT INTO auth.users(id,email) VALUES(v_user,'session-reconciliation-'||v_user||'@example.test');
 INSERT INTO auth.sessions(id,user_id,created_at,updated_at) VALUES(v_provider,v_user,now(),now()),(v_active,v_user,now(),now());
 INSERT INTO auth.refresh_tokens(token,user_id,revoked,created_at,updated_at,session_id) VALUES(gen_random_uuid()::text,v_user::text,false,now(),now(),v_provider),(gen_random_uuid()::text,v_user::text,false,now(),now(),v_active);
 INSERT INTO farm_private.sessions(id,user_id,provider_session_id,cookie_hash,encrypted_credentials,csrf_hash,idle_expires_at,absolute_expires_at,revoked_at,provider_cleanup_pending)
 VALUES(v_app,v_user,v_provider::text,v_cookie,'sealed-disposable-fixture',repeat('y',43),now(),now(),now(),true);
 INSERT INTO farm_private.sessions(user_id,provider_session_id,cookie_hash,encrypted_credentials,csrf_hash,idle_expires_at,absolute_expires_at)
 VALUES(v_user,v_active::text,replace(gen_random_uuid()::text,'-','')||repeat('a',11),'active-disposable-fixture',repeat('b',43),now()+interval '30 minutes',now()+interval '12 hours');
 INSERT INTO farm_private.cleanup_jobs(id,source_kind,source_id,encrypted_credentials,aad,source_fingerprint,state,owner,lease_until,attempts)
 VALUES(v_job,'session',v_app,'sealed-disposable-fixture',v_cookie,md5('sealed-disposable-fixture'),'running',v_owner,clock_timestamp()+interval '1 minute',1);
 IF public.farm_cleanup_session_reconcile(v_job,gen_random_uuid(),v_user,v_provider,v_expiry) THEN RAISE EXCEPTION 'FAIL: wrong owner accepted.';END IF;
 IF public.farm_cleanup_session_reconcile(v_job,v_owner,v_user,v_provider,clock_timestamp()+interval '1 hour') THEN RAISE EXCEPTION 'FAIL: future token accepted.';END IF;
 IF public.farm_cleanup_session_reconcile(v_job,v_owner,v_user,v_active,v_expiry) THEN RAISE EXCEPTION 'FAIL: other provider identity accepted.';END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=v_provider) THEN RAISE EXCEPTION 'FAIL: refused operation changed provider.';END IF;
 IF public.farm_cleanup_session_reconcile(v_job,v_owner,v_user,v_provider,v_expiry) IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: valid reconciliation refused.';END IF;
 IF EXISTS(SELECT 1 FROM auth.sessions WHERE id=v_provider) OR EXISTS(SELECT 1 FROM auth.refresh_tokens WHERE session_id=v_provider) THEN RAISE EXCEPTION 'FAIL: provider/token absence not verified.';END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=v_active AND user_id=v_user) OR NOT EXISTS(SELECT 1 FROM auth.refresh_tokens WHERE session_id=v_active)
  OR (SELECT count(*) FROM auth.sessions)<>v_other_count+1 THEN RAISE EXCEPTION 'FAIL: unrelated session preservation.';END IF;
 IF NOT EXISTS(SELECT 1 FROM farm_private.cleanup_jobs WHERE id=v_job AND state='done' AND completed_tokens=1 AND encrypted_credentials='')
  OR NOT EXISTS(SELECT 1 FROM farm_private.sessions WHERE id=v_app AND revoked_at IS NOT NULL AND NOT provider_cleanup_pending AND encrypted_credentials='') THEN RAISE EXCEPTION 'FAIL: atomic completion.';END IF;
 IF public.farm_cleanup_session_reconcile(v_job,v_owner,v_user,v_provider,v_expiry) IS NOT TRUE
  OR (SELECT count(*) FROM farm_private.security_events WHERE target_id=v_job AND event_type='cleanup_session_reconciled')<>1 THEN RAISE EXCEPTION 'FAIL: lost-response replay/audit.';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: session reconciliation grants, schema guard, lease/identity/expiry refusal, exact provider/token removal, active-session preservation, atomic acknowledgement and replay; fixtures rolled back. Real worker/HTTP/concurrency remain separate.' AS result;
