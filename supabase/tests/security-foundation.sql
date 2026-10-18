-- Execute only after the foundation migration, in the selected development project.
-- DB/role policy tests, NOT a substitute for Auth/API/Storage integration tests.
-- Disposable fixtures are rolled back. No email is sent, no passwords/tokens created.
BEGIN;
DO $$
DECLARE private_count integer; public_count integer;
BEGIN
 SELECT count(*) INTO private_count FROM pg_tables WHERE schemaname='farm_private' AND rowsecurity;
 SELECT count(*) INTO public_count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'farm_%' AND rowsecurity;
 IF private_count<>7 OR public_count<>5 THEN RAISE EXCEPTION 'FAIL: expected RLS is missing.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='farm-photographs' AND NOT public AND file_size_limit=10485760) THEN
  RAISE EXCEPTION 'FAIL: photograph bucket is missing, public or has the wrong size limit.';
 END IF;
 IF has_schema_privilege('authenticated','farm_private','USAGE') OR has_schema_privilege('anon','farm_private','USAGE') THEN
  RAISE EXCEPTION 'FAIL: private schema is exposed to application roles.';
 END IF;
END $$;
SET LOCAL ROLE anon;
DO $$
BEGIN
 IF public.farm_has_active_session() THEN RAISE EXCEPTION 'FAIL: anonymous session accepted.'; END IF;
 BEGIN
  PERFORM 1 FROM public.farm_content;
  RAISE EXCEPTION 'FAIL: anonymous content SELECT permitted.';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 IF public.farm_has_active_session() THEN RAISE EXCEPTION 'FAIL: missing membership/session accepted.'; END IF;
 IF EXISTS(SELECT 1 FROM public.farm_content) THEN RAISE EXCEPTION 'FAIL: content visible without an active application session.'; END IF;
 BEGIN
  INSERT INTO public.farm_content(kind,payload) VALUES('post','{}');
  RAISE EXCEPTION 'FAIL: direct browser content write permitted.';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
DO $$
DECLARE first_user uuid:=gen_random_uuid(); second_user uuid:=gen_random_uuid(); provider_session uuid:=gen_random_uuid();
BEGIN
 IF (SELECT active_count FROM farm_private.admin_guard WHERE singleton)<>0 THEN
  RAISE EXCEPTION 'Run disposable foundation tests before creating real administrator accounts.';
 END IF;
 INSERT INTO auth.users(id,aud,role,email) VALUES
  (first_user,'authenticated','authenticated','stage2-test-'||first_user||'@example.test'),
  (second_user,'authenticated','authenticated','stage2-test-'||second_user||'@example.test');
 INSERT INTO farm_private.memberships(user_id,state) VALUES(first_user,'active'),(second_user,'active');
 UPDATE farm_private.memberships SET state='revoked' WHERE user_id=second_user;
 BEGIN
  UPDATE farm_private.memberships SET state='revoked' WHERE user_id=first_user;
  RAISE EXCEPTION 'FAIL: last active administrator could be removed.';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT active_count FROM farm_private.admin_guard WHERE singleton)<>1 THEN
  RAISE EXCEPTION 'FAIL: active administrator count is inconsistent.';
 END IF;
 INSERT INTO farm_private.sessions(user_id,cookie_hash,provider_session_id,encrypted_credentials,csrf_hash,idle_expires_at,absolute_expires_at)
  VALUES(first_user,'fixture-'||first_user,provider_session::text,'fixture-not-a-token','fixture-not-a-secret',now()+interval '10 minutes',now()+interval '1 hour');
 PERFORM set_config('request.jwt.claims',json_build_object('sub',first_user,'role','authenticated','session_id',provider_session)::text,true);
 IF NOT public.farm_has_active_session() THEN RAISE EXCEPTION 'FAIL: active fixture session rejected.'; END IF;
 UPDATE farm_private.sessions SET revoked_at=now() WHERE user_id=first_user;
 IF public.farm_has_active_session() THEN RAISE EXCEPTION 'FAIL: revoked fixture session accepted with old claims.'; END IF;
 UPDATE farm_private.sessions SET revoked_at=NULL,idle_expires_at=now()-interval '1 second' WHERE user_id=first_user;
 IF public.farm_has_active_session() THEN RAISE EXCEPTION 'FAIL: idle-expired fixture session accepted.'; END IF;
 UPDATE farm_private.sessions SET idle_expires_at=now()-interval '1 minute',absolute_expires_at=now()-interval '1 second' WHERE user_id=first_user;
 IF public.farm_has_active_session() THEN RAISE EXCEPTION 'FAIL: absolute-expired fixture session accepted.'; END IF;
 UPDATE farm_private.sessions SET idle_expires_at=now()+interval '10 minutes',absolute_expires_at=now()+interval '1 hour' WHERE user_id=first_user;
 UPDATE farm_private.memberships SET state='active' WHERE user_id=second_user;
 UPDATE farm_private.memberships SET state='revoked' WHERE user_id=first_user;
 IF public.farm_has_active_session() THEN RAISE EXCEPTION 'FAIL: revoked membership accepted with an old session.'; END IF;
END $$;
-- Exercise actual content RLS with a real disposable row, not an empty-table check.
INSERT INTO public.farm_content(kind,payload) VALUES('post','{"fixture":"foundation-rls-only"}'::jsonb);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.farm_content WHERE payload->>'fixture'='foundation-rls-only') THEN
  RAISE EXCEPTION 'FAIL: revoked membership can read the fixture through RLS.';
 END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 UPDATE farm_private.memberships SET state='active' WHERE user_id=auth.uid();
 UPDATE farm_private.sessions SET revoked_at=NULL,idle_expires_at=now()+interval '10 minutes',absolute_expires_at=now()+interval '1 hour'
  WHERE user_id=auth.uid();
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.farm_content WHERE payload->>'fixture'='foundation-rls-only')<>1 THEN
  RAISE EXCEPTION 'FAIL: active fixture session cannot read content through RLS.';
 END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 UPDATE farm_private.sessions SET revoked_at=now() WHERE user_id=auth.uid();
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.farm_content WHERE payload->>'fixture'='foundation-rls-only') THEN
  RAISE EXCEPTION 'FAIL: revoked session can still read content through RLS.';
 END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: foundation DB checks completed; fixtures rolled back. Provider signup, concurrency and actual HTTP/Storage tests remain separate.' AS result;
