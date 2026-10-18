-- Entire rollback-only verification AFTER separately reviewed migration 004. No Auth calls/mail.
BEGIN;
DO $$
DECLARE v_signature regprocedure;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170004_reauthentication') THEN RAISE EXCEPTION 'Migration 004 is missing.'; END IF;
 FOREACH v_signature IN ARRAY ARRAY[
 'public.farm_session_reauth_prepare(text,uuid,text,text,text,text,text)'::regprocedure,
 'public.farm_session_reauth_finish(text,text)'::regprocedure,
 'public.farm_session_reauth_abort(text)'::regprocedure] LOOP
 IF has_function_privilege('anon',v_signature,'EXECUTE') OR has_function_privilege('authenticated',v_signature,'EXECUTE')
 OR NOT has_function_privilege('service_role',v_signature,'EXECUTE') THEN RAISE EXCEPTION 'FAIL: reauthentication command grants.'; END IF;
 END LOOP;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM public.farm_session_reauth_abort(repeat('a',43));RAISE EXCEPTION 'FAIL: anonymous command allowed.';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM public.farm_session_reauth_finish(repeat('a',43),repeat('b',43));RAISE EXCEPTION 'FAIL: browser command allowed.';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
DO $$
DECLARE v_user uuid:=gen_random_uuid();v_old jsonb;v_new jsonb;v_result jsonb;v_provider text:=gen_random_uuid()::text;v_next text:=gen_random_uuid()::text;v_old_hash text;v_new_hash text;
BEGIN
 -- Random bounded hashes avoid touching any existing session/user. All fixture rows roll back.
 v_old_hash:=replace(gen_random_uuid()::text,'-','')||'oldfixture1';
 v_new_hash:=replace(gen_random_uuid()::text,'-','')||'newfixture1';
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(v_user,'reauth-'||v_user::text||'@example.test',now());
 INSERT INTO farm_private.memberships(user_id,state) VALUES(v_user,'active');
 v_old:=public.farm_session_open(v_user,v_provider,v_old_hash,'fixture-old-encrypted',repeat('c',43));
 v_new:=public.farm_session_reauth_prepare(v_old_hash,v_user,v_provider,v_next,v_new_hash,'fixture-new-encrypted',repeat('d',43));
 IF v_new IS NULL OR v_new->>'revoked_at' IS NULL OR (v_new->>'provider_cleanup_pending')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: staging is not revoked/cleanup-pending.'; END IF;
 IF public.farm_session_read(v_new_hash) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: staged cookie is live.'; END IF;
 v_result:=public.farm_session_reauth_finish(v_old_hash,v_new_hash);
 IF v_result IS NULL OR public.farm_session_read(v_old_hash) IS NOT NULL OR public.farm_session_read(v_new_hash) IS NULL THEN RAISE EXCEPTION 'FAIL: atomic session rotation.'; END IF;
 IF (v_result->'session'->>'absolute_expires_at')::timestamptz<>(v_old->>'absolute_expires_at')::timestamptz
 OR v_result->'session'->>'reauthenticated_at' IS NULL OR (v_result->'previous'->>'provider_cleanup_pending')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: expiry/confirmation/cleanup preservation.'; END IF;
 IF public.farm_session_reauth_finish(v_old_hash,v_new_hash) IS NOT NULL OR public.farm_session_reauth_abort(v_new_hash) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: replay/active abort.'; END IF;
 -- Cancellation invalidates staging before cleanup, without invalidating its live parent.
 v_old_hash:=v_new_hash;v_provider:=v_next;v_new_hash:=replace(gen_random_uuid()::text,'-','')||'abortstage1';v_next:=gen_random_uuid()::text;
 v_new:=public.farm_session_reauth_prepare(v_old_hash,v_user,v_provider,v_next,v_new_hash,'fixture-abort-encrypted',repeat('e',43));
 IF public.farm_session_reauth_abort(v_new_hash) IS NULL OR public.farm_session_reauth_finish(v_old_hash,v_new_hash) IS NOT NULL
 OR public.farm_session_read(v_old_hash) IS NULL THEN RAISE EXCEPTION 'FAIL: cancellation safety.'; END IF;
 -- Expired staging and later membership revocation must both fail closed.
 v_new_hash:=replace(gen_random_uuid()::text,'-','')||'expiretest1';v_next:=gen_random_uuid()::text;
 v_new:=public.farm_session_reauth_prepare(v_old_hash,v_user,v_provider,v_next,v_new_hash,'fixture-expiry-encrypted',repeat('f',43));
 UPDATE farm_private.sessions AS s SET reauth_until=now()-interval '1 second' WHERE s.cookie_hash=v_new_hash;
 IF public.farm_session_reauth_finish(v_old_hash,v_new_hash) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: expired staging activated.'; END IF;
 -- Use a NEW unexpired row so membership denial is not masked by the expiry assertion above.
 v_new_hash:=replace(gen_random_uuid()::text,'-','')||'membertest1';v_next:=gen_random_uuid()::text;
 v_new:=public.farm_session_reauth_prepare(v_old_hash,v_user,v_provider,v_next,v_new_hash,'fixture-member-encrypted',repeat('g',43));
 IF v_new IS NULL OR (v_new->>'reauth_until')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'FAIL: live membership fixture not prepared.'; END IF;
 -- Keep another fixture active so the existing last-admin protection is respected.
 INSERT INTO auth.users(id,email) VALUES(gen_random_uuid(),'reauth-guard-'||v_user::text||'@example.test') RETURNING id INTO v_user;
 INSERT INTO farm_private.memberships(user_id,state) VALUES(v_user,'active');
 UPDATE farm_private.memberships AS m SET state='revoked' WHERE m.user_id=(v_old->>'user_id')::uuid;
 IF public.farm_session_read(v_old_hash) IS NOT NULL OR public.farm_session_reauth_finish(v_old_hash,v_new_hash) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: revoked member accepted.'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: reauthentication service grants, revoked staging, rotation, original expiry, cleanup retention, replay, abort, expiry and membership guards checked; fixtures rolled back. Real provider/HTTP/concurrency remain separate.' AS result;
