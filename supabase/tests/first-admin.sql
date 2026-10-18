-- Owner SQL Editor, AFTER only the new 202610160003 migration. PREPARED, not hosted-executed.
-- Run the entire file. No real provider account, password, email or app session is created.
BEGIN;
DO $$
DECLARE v_signature regprocedure;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations AS m WHERE m.version='202610160003_first_admin') THEN
  RAISE EXCEPTION 'First-admin migration is missing.';
 END IF;
 IF (SELECT g.active_count FROM farm_private.admin_guard AS g WHERE g.singleton) IS DISTINCT FROM 0
 OR EXISTS(SELECT 1 FROM farm_private.invitations AS i WHERE i.state IN('queued','sent')) THEN
  RAISE EXCEPTION 'Run isolated fixtures before real bootstrap. Existing state was not changed.';
 END IF;
 FOREACH v_signature IN ARRAY ARRAY[
  'public.farm_bootstrap_prepare(text,text,text)'::regprocedure,
  'public.farm_bootstrap_read(uuid)'::regprocedure,
  'public.farm_bootstrap_claim(uuid,uuid,text,text)'::regprocedure,
  'public.farm_bootstrap_issue_finish(uuid,uuid,uuid,text)'::regprocedure,
  'public.farm_bootstrap_progress(uuid,uuid,text)'::regprocedure,
  'public.farm_bootstrap_activate(uuid,uuid,text,integer,uuid)'::regprocedure,
  'public.farm_bootstrap_release(uuid,uuid)'::regprocedure,
  'public.farm_bootstrap_cancel(uuid)'::regprocedure,
  'public.farm_bootstrap_cleanup_done(uuid)'::regprocedure
 ] LOOP
  IF has_function_privilege('anon',v_signature,'EXECUTE') OR has_function_privilege('authenticated',v_signature,'EXECUTE')
   OR NOT has_function_privilege('service_role',v_signature,'EXECUTE') THEN RAISE EXCEPTION 'FAIL: first-admin service grants.'; END IF;
 END LOOP;
 IF has_function_privilege('service_role','farm_private.bootstrap_pending(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'FAIL: private helper is exposed.';
 END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM public.farm_bootstrap_read(gen_random_uuid());
  RAISE EXCEPTION 'FAIL: anonymous invitation lookup allowed.';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.farm_bootstrap_activate(gen_random_uuid(),gen_random_uuid(),repeat('n',43),1,gen_random_uuid());
  RAISE EXCEPTION 'FAIL: browser activation allowed.';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

DO $$
DECLARE
 v_pending jsonb; v_id uuid; v_user uuid:=gen_random_uuid(); v_other uuid:=gen_random_uuid();
 v_owner uuid:=gen_random_uuid(); v_second uuid:=gen_random_uuid(); v_row jsonb; v_blocked boolean:=false;
BEGIN
 BEGIN -- Subtransaction: roll this fixture group back even after successful activation.
 INSERT INTO auth.users(id,aud,role,email) VALUES(v_user,'authenticated','authenticated','first-admin-fixture@example.test');
 INSERT INTO auth.users(id,aud,role,email) VALUES(v_other,'authenticated','authenticated','other-first-admin-fixture@example.test');
 v_pending:=public.farm_bootstrap_prepare('first-admin-fixture@example.test',repeat('n',43),'encrypted-nonce-fixture');
 v_id:=(v_pending->>'id')::uuid;
 IF v_pending->>'state'<>'queued' OR (SELECT g.active_count FROM farm_private.admin_guard AS g WHERE g.singleton)<>0 THEN
  RAISE EXCEPTION 'FAIL: preparing an invitation activated membership.';
 END IF;
 BEGIN PERFORM public.farm_bootstrap_prepare('other-first-admin-fixture@example.test',repeat('o',43),'encrypted-other');
 EXCEPTION WHEN raise_exception THEN v_blocked:=true; END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: duplicate bootstrap was allowed.'; END IF;

 v_row:=public.farm_bootstrap_claim(v_id,v_owner,'issue',NULL);
 IF v_row IS NULL OR public.farm_bootstrap_claim(v_id,v_second,'issue',NULL) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: issue lease is not exclusive.'; END IF;
 IF public.farm_bootstrap_cancel(v_id) THEN RAISE EXCEPTION 'FAIL: cancellation raced a live lease.'; END IF;
 IF public.farm_bootstrap_issue_finish(v_id,v_second,v_user,'encrypted-invite') THEN RAISE EXCEPTION 'FAIL: wrong issue owner.'; END IF;
 IF public.farm_bootstrap_issue_finish(v_id,v_owner,v_other,'encrypted-invite') THEN RAISE EXCEPTION 'FAIL: wrong invite recipient.'; END IF;
 IF NOT public.farm_bootstrap_issue_finish(v_id,v_owner,v_user,'encrypted-invite') THEN RAISE EXCEPTION 'FAIL: pending identity was not bound.'; END IF;
 IF (SELECT m.state FROM farm_private.memberships AS m WHERE m.user_id=v_user)<>'pending' THEN RAISE EXCEPTION 'FAIL: recipient is not pending.'; END IF;
 PERFORM public.farm_bootstrap_release(v_id,v_owner);
 -- A saved generation can be read/reused without another provider call.
 v_row:=public.farm_bootstrap_claim(v_id,v_owner,'issue',NULL);
 IF v_row->>'issue_state'<>'ready' THEN RAISE EXCEPTION 'FAIL: saved invitation was lost.'; END IF;
 PERFORM public.farm_bootstrap_release(v_id,v_owner);
 IF public.farm_bootstrap_claim(v_id,v_owner,'accept',repeat('x',43)) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: wrong nonce accepted.'; END IF;
 v_row:=public.farm_bootstrap_claim(v_id,v_owner,'accept',repeat('n',43));
 IF v_row IS NULL THEN RAISE EXCEPTION 'FAIL: valid acceptance lease rejected.'; END IF;
 IF public.farm_bootstrap_activate(v_id,v_owner,repeat('n',43),1,v_user) THEN RAISE EXCEPTION 'FAIL: missing verified progress accepted.'; END IF;
 IF public.farm_bootstrap_progress(v_id,v_second,'encrypted-progress') THEN RAISE EXCEPTION 'FAIL: wrong progress owner.'; END IF;
 IF NOT public.farm_bootstrap_progress(v_id,v_owner,'encrypted-progress') THEN RAISE EXCEPTION 'FAIL: verified progress not saved.'; END IF;
 IF public.farm_bootstrap_activate(v_id,v_owner,repeat('n',43),1,v_user) THEN RAISE EXCEPTION 'FAIL: unconfirmed recipient accepted.'; END IF;
 UPDATE auth.users AS u SET email_confirmed_at=clock_timestamp() WHERE u.id=v_user;
 IF public.farm_bootstrap_activate(v_id,v_owner,repeat('n',43),1,v_user) THEN RAISE EXCEPTION 'FAIL: password-free activation allowed.'; END IF;
 -- SQL-only marker; not a real password hash or usable provider login.
 UPDATE auth.users AS u SET encrypted_password='sql-fixture-only-not-a-password-hash' WHERE u.id=v_user;
 IF public.farm_bootstrap_activate(v_id,v_owner,repeat('n',43),2,v_user)
 OR public.farm_bootstrap_activate(v_id,v_owner,repeat('x',43),1,v_user)
 OR public.farm_bootstrap_activate(v_id,v_second,repeat('n',43),1,v_user)
 OR public.farm_bootstrap_activate(v_id,v_owner,repeat('n',43),1,v_other) THEN RAISE EXCEPTION 'FAIL: activation binding bypass.'; END IF;
 UPDATE farm_private.memberships AS m SET state='revoked' WHERE m.user_id=v_user;
 IF public.farm_bootstrap_activate(v_id,v_owner,repeat('n',43),1,v_user) THEN RAISE EXCEPTION 'FAIL: revoked membership revived.'; END IF;
 UPDATE farm_private.memberships AS m SET state='pending' WHERE m.user_id=v_user;
 UPDATE farm_private.invitations AS i SET lease_until=clock_timestamp()-interval '1 second' WHERE i.id=v_id;
 IF public.farm_bootstrap_activate(v_id,v_owner,repeat('n',43),1,v_user) THEN RAISE EXCEPTION 'FAIL: expired acceptance lease accepted.'; END IF;
 v_row:=public.farm_bootstrap_claim(v_id,v_second,'accept',repeat('n',43));
 IF v_row IS NULL OR v_row->>'encrypted_credentials'<>'encrypted-progress' THEN RAISE EXCEPTION 'FAIL: retry lost verified progress.'; END IF;
 IF NOT public.farm_bootstrap_activate(v_id,v_second,repeat('n',43),1,v_user) THEN RAISE EXCEPTION 'FAIL: verified activation rejected.'; END IF;
 IF (SELECT g.active_count FROM farm_private.admin_guard AS g WHERE g.singleton)<>1
 OR (SELECT m.state FROM farm_private.memberships AS m WHERE m.user_id=v_user)<>'active'
 OR (SELECT i.state FROM farm_private.invitations AS i WHERE i.id=v_id)<>'accepted'
 OR EXISTS(SELECT 1 FROM farm_private.sessions AS s WHERE s.user_id=v_user) THEN RAISE EXCEPTION 'FAIL: activation state or implicit session.'; END IF;
 IF public.farm_bootstrap_activate(v_id,v_second,repeat('n',43),1,v_user)
 OR public.farm_bootstrap_claim(v_id,v_owner,'accept',repeat('n',43)) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: invitation replay.'; END IF;
 v_blocked:=false;
 BEGIN PERFORM public.farm_bootstrap_prepare('other-first-admin-fixture@example.test',repeat('o',43),'encrypted-other');
 EXCEPTION WHEN raise_exception THEN v_blocked:=true; END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: bootstrap stayed open after activation.'; END IF;
 IF NOT (SELECT i.provider_cleanup_pending FROM farm_private.invitations AS i WHERE i.id=v_id) THEN RAISE EXCEPTION 'FAIL: cleanup work was lost.'; END IF;
 PERFORM public.farm_bootstrap_cleanup_done(v_id);
 IF (SELECT i.provider_cleanup_pending OR i.encrypted_credentials IS NOT NULL FROM farm_private.invitations AS i WHERE i.id=v_id) THEN RAISE EXCEPTION 'FAIL: cleanup completion did not clear credentials.'; END IF;
 RAISE SQLSTATE 'Z0001' USING MESSAGE='Completed first fixture group; roll back its rows.';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
 END;
END $$;

-- The first fixture group was rolled back inside its subtransaction.
DO $$
DECLARE v_row jsonb; v_id uuid; v_owner uuid:=gen_random_uuid();
BEGIN
 IF (SELECT g.active_count FROM farm_private.admin_guard AS g WHERE g.singleton) IS DISTINCT FROM 0
 OR EXISTS(SELECT 1 FROM farm_private.invitations AS i WHERE i.state IN('queued','sent')) THEN RAISE EXCEPTION 'Fixtures require no real bootstrap.'; END IF;
 v_row:=public.farm_bootstrap_prepare('review-fixture@example.test',repeat('r',43),'encrypted-nonce');v_id:=(v_row->>'id')::uuid;
 PERFORM public.farm_bootstrap_claim(v_id,v_owner,'issue',NULL);
 UPDATE farm_private.invitations AS i SET lease_until=clock_timestamp()-interval '1 second' WHERE i.id=v_id;
 IF public.farm_bootstrap_claim(v_id,gen_random_uuid(),'issue',NULL) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: ambiguous provider issuance retried automatically.'; END IF;
 IF (public.farm_bootstrap_read(v_id))->>'issue_state'<>'review' THEN RAISE EXCEPTION 'FAIL: ambiguous issue not marked for review.'; END IF;
 -- Model a saved acceptance cleanup record; cancellation must retain its original encryption generation.
 UPDATE farm_private.invitations AS i SET encrypted_credentials='encrypted-cancel-cleanup',credentials_generation=1,provider_cleanup_pending=true WHERE i.id=v_id;
 IF NOT public.farm_bootstrap_cancel(v_id) THEN RAISE EXCEPTION 'FAIL: pending cancellation rejected.'; END IF;
 IF (public.farm_bootstrap_read(v_id))->>'state'<>'cancelled'
 OR ((public.farm_bootstrap_read(v_id))->>'generation')::integer<>2
 OR public.farm_bootstrap_claim(v_id,v_owner,'accept',repeat('r',43)) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: cancelled generation remained usable.'; END IF;
 IF NOT (SELECT i.provider_cleanup_pending AND i.credentials_generation=1 AND i.encrypted_credentials='encrypted-cancel-cleanup' FROM farm_private.invitations AS i WHERE i.id=v_id) THEN RAISE EXCEPTION 'FAIL: cancellation lost pending cleanup credentials.'; END IF;
 PERFORM public.farm_bootstrap_cleanup_done(v_id);
 IF (SELECT i.provider_cleanup_pending OR i.encrypted_credentials IS NOT NULL OR i.credentials_generation IS NOT NULL FROM farm_private.invitations AS i WHERE i.id=v_id) THEN RAISE EXCEPTION 'FAIL: cancelled cleanup cannot be completed.'; END IF;
 v_row:=public.farm_bootstrap_prepare('expiry-fixture@example.test',repeat('e',43),'encrypted-nonce');v_id:=(v_row->>'id')::uuid;
 UPDATE farm_private.invitations AS i SET expires_at=clock_timestamp()-interval '1 second' WHERE i.id=v_id;
 IF public.farm_bootstrap_claim(v_id,v_owner,'issue',NULL) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: expired invitation usable.'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: first-admin grants, pending identity, leases, recipient/password guards, activation, replay, cancellation and review checked; fixtures rolled back. Provider, browser and email delivery remain unverified.' AS result;
