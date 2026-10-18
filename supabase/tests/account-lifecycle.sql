-- Entire rollback-only verification after separately reviewed migration 006.
-- No Auth API, provider identity creation, password or invitation email is used.
BEGIN;
DO $$ DECLARE v_proc regprocedure;BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170006_account_lifecycle') THEN RAISE EXCEPTION 'Migration 006 is missing.';END IF;
 FOREACH v_proc IN ARRAY ARRAY['public.farm_admin_list(text)'::regprocedure,'public.farm_admin_invite_prepare(text,text,text,text)'::regprocedure,'public.farm_admin_invite_resend(text,uuid,text,text)'::regprocedure,'public.farm_admin_invite_cancel(text,uuid)'::regprocedure,
  'public.farm_admin_invite_claim(text,uuid,uuid)'::regprocedure,'public.farm_admin_invite_issue_finish(text,uuid,uuid,uuid,text)'::regprocedure,
  'public.farm_admin_invite_issue_effect_finish(uuid,uuid,text,uuid,uuid,uuid,text)'::regprocedure,'public.farm_admin_invite_issue_effect_review(uuid,uuid)'::regprocedure,'public.farm_admin_invite_accept_claim(uuid,uuid,text)'::regprocedure,
  'public.farm_admin_invite_accept_progress(uuid,uuid,text)'::regprocedure,'public.farm_admin_invite_accept_effect_progress(uuid,uuid,uuid,uuid,text)'::regprocedure,
  'public.farm_admin_invite_activate(uuid,uuid,text,integer,uuid)'::regprocedure,'public.farm_admin_invite_release(uuid,uuid)'::regprocedure,
  'public.farm_admin_invite_cleanup_done(uuid)'::regprocedure,
  'public.farm_admin_reset_prepare(text,uuid,text,text)'::regprocedure,'public.farm_admin_reset_claim(text,uuid,uuid)'::regprocedure,
  'public.farm_admin_reset_issue_finish(text,uuid,uuid,uuid,text)'::regprocedure,'public.farm_admin_reset_issue_effect_finish(uuid,uuid,text,uuid,uuid,uuid,text)'::regprocedure,
  'public.farm_admin_reset_issue_effect_review(uuid,uuid)'::regprocedure,'public.farm_admin_reset_accept_claim(uuid,uuid,text)'::regprocedure,
  'public.farm_admin_reset_accept_progress(uuid,uuid,text)'::regprocedure,'public.farm_admin_reset_accept_effect_progress(uuid,uuid,uuid,uuid,text)'::regprocedure,
  'public.farm_admin_reset_activate(uuid,uuid,text,integer,uuid)'::regprocedure,'public.farm_admin_reset_release(uuid,uuid)'::regprocedure,
  'public.farm_admin_reset_cancel(text,uuid)'::regprocedure,'public.farm_admin_revoke(text,uuid)'::regprocedure] LOOP
  IF has_function_privilege('anon',v_proc,'EXECUTE') OR has_function_privilege('authenticated',v_proc,'EXECUTE') OR NOT has_function_privilege('service_role',v_proc,'EXECUTE') THEN RAISE EXCEPTION 'FAIL: account command grants.';END IF;
 END LOOP;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM public.farm_admin_revoke(repeat('a',43),gen_random_uuid());RAISE EXCEPTION 'FAIL: anonymous account command allowed.';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
DO $$ DECLARE v_one uuid:=gen_random_uuid();v_two uuid:=gen_random_uuid();v_recipient uuid:=gen_random_uuid();v_hash text;v_two_hash text;v_nonce text:=repeat('d',43);v_row jsonb;v_new jsonb;v_pending jsonb;v_old jsonb;v_second_invite jsonb;v_claim jsonb;v_owner uuid:=gen_random_uuid();v_effect jsonb;v_effect_id uuid:=gen_random_uuid();v_effect_owner uuid:=gen_random_uuid();v_accept_owner uuid:=gen_random_uuid();v_reset jsonb;v_reset_owner uuid:=gen_random_uuid();v_reset_accept_owner uuid:=gen_random_uuid();v_reset_nonce text:=repeat('j',43);
BEGIN
 INSERT INTO auth.users(id,email) VALUES(v_one,'owner-'||v_one||'@example.test'),(v_two,'admin-'||v_two||'@example.test'),(v_recipient,'recipient-'||v_recipient||'@example.test');
 INSERT INTO farm_private.memberships(user_id,state) VALUES(v_one,'active'),(v_two,'active');
 v_hash:=substr(replace(gen_random_uuid()::text,'-','')||repeat('x',11),1,43);
 v_two_hash:=substr(replace(gen_random_uuid()::text,'-','')||repeat('y',11),1,43);
 v_row:=public.farm_session_open(v_one,gen_random_uuid()::text,v_hash,'dummy-sealed-session',repeat('c',43));
 PERFORM public.farm_session_open(v_two,gen_random_uuid()::text,v_two_hash,'dummy-sealed-session',repeat('f',43));
 v_new:=public.farm_admin_invite_prepare(v_hash,'recipient-'||v_recipient||'@example.test',v_nonce,'dummy-sealed-nonce');
 IF v_new->>'invited_by'<>v_one::text OR v_new->>'state'<>'queued' THEN RAISE EXCEPTION 'FAIL: invitation actor/state binding.';END IF;
 v_claim:=public.farm_admin_invite_claim(v_hash,(v_new->>'id')::uuid,v_owner);
 IF v_claim->>'issue_state'<>'issuing' OR public.farm_admin_invite_claim(v_hash,(v_new->>'id')::uuid,gen_random_uuid()) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: invitation issue lease.';END IF;
 v_effect:=public.farm_effect_begin(v_effect_id,repeat('h',43),'invite_issue',v_effect_owner,'dummy-sealed-context');
 IF v_effect IS NULL OR public.farm_effect_capture(v_effect_id,v_effect_owner,'dummy-sealed-provider-invite') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: provider effect journal capture.';END IF;
 IF public.farm_admin_invite_issue_effect_finish(v_effect_id,v_effect_owner,v_hash,(v_new->>'id')::uuid,v_owner,v_recipient,'dummy-sealed-invite') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: invitation recipient binding.';END IF;
 IF (SELECT state FROM farm_private.provider_effects WHERE id=v_effect_id)<>'attached' OR (SELECT encrypted_credentials FROM farm_private.provider_effects WHERE id=v_effect_id) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: provider effect credential transfer.';END IF;
 PERFORM public.farm_admin_invite_release((v_new->>'id')::uuid,v_owner);
 IF (public.farm_invitation_read((v_new->>'id')::uuid)->>'issue_state')<>'ready' OR (public.farm_invitation_read((v_new->>'id')::uuid)->>'state')<>'queued' THEN RAISE EXCEPTION 'FAIL: invitation prepared without mail.';END IF;
 v_accept_owner:=gen_random_uuid();v_claim:=public.farm_admin_invite_accept_claim((v_new->>'id')::uuid,v_accept_owner,v_nonce);
 IF v_claim->>'user_id'<>v_recipient::text OR public.farm_admin_invite_accept_claim((v_new->>'id')::uuid,gen_random_uuid(),v_nonce) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: single acceptance lease.';END IF;
 v_effect_id:=gen_random_uuid();v_effect_owner:=gen_random_uuid();v_effect:=public.farm_effect_begin(v_effect_id,repeat('i',43),'invite_verify',v_effect_owner,'dummy-sealed-context');
 IF v_effect IS NULL OR public.farm_effect_capture(v_effect_id,v_effect_owner,'dummy-sealed-provider-tokens') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: recipient verification effect capture.';END IF;
 IF public.farm_admin_invite_accept_effect_progress(v_effect_id,v_effect_owner,(v_new->>'id')::uuid,v_accept_owner,'dummy-sealed-credentials') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: acceptance progress checkpoint.';END IF;
 UPDATE auth.users SET email_confirmed_at=clock_timestamp(),encrypted_password='dummy-hash' WHERE id=v_recipient;
 IF public.farm_admin_invite_activate((v_new->>'id')::uuid,v_accept_owner,v_nonce,(v_new->>'generation')::integer,v_recipient) IS NOT TRUE
  OR public.farm_admin_invite_activate((v_new->>'id')::uuid,v_accept_owner,v_nonce,(v_new->>'generation')::integer,v_recipient) IS NOT FALSE THEN RAISE EXCEPTION 'FAIL: single-use invitation activation.';END IF;
 IF (SELECT state FROM farm_private.memberships WHERE user_id=v_recipient)<>'active' THEN RAISE EXCEPTION 'FAIL: recipient membership activation.';END IF;
 v_pending:=public.farm_admin_invite_prepare(v_hash,'resend-'||v_one||'@example.test',repeat('e',43),'dummy-sealed-resend');
 v_old:=public.farm_admin_invite_resend(v_hash,(v_pending->>'id')::uuid,repeat('f',43),'dummy-sealed-new-nonce');
 IF v_old->>'id'=(v_pending->>'id') OR (public.farm_invitation_read((v_pending->>'id')::uuid)->>'state')<>'cancelled' THEN RAISE EXCEPTION 'FAIL: resend did not invalidate old invitation.';END IF;
 v_second_invite:=public.farm_admin_invite_prepare(v_two_hash,'second-pending-'||v_two||'@example.test',repeat('g',43),'dummy-sealed-nonce');
 v_reset:=public.farm_admin_reset_prepare(v_hash,v_two,v_reset_nonce,'dummy-sealed-reset-nonce');
 IF v_reset->>'purpose'<>'password_reset' OR v_reset->>'user_id'<>v_two::text THEN RAISE EXCEPTION 'FAIL: reset recipient and purpose binding.';END IF;
 v_claim:=public.farm_admin_reset_claim(v_hash,(v_reset->>'id')::uuid,v_reset_owner);
 IF v_claim->>'issue_state'<>'issuing' OR public.farm_admin_reset_claim(v_hash,(v_reset->>'id')::uuid,gen_random_uuid()) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: reset issue lease.';END IF;
 v_effect_id:=gen_random_uuid();v_effect_owner:=gen_random_uuid();v_effect:=public.farm_effect_begin(v_effect_id,repeat('k',43),'reset_issue',v_effect_owner,'dummy-sealed-context');
 IF v_effect IS NULL OR public.farm_effect_capture(v_effect_id,v_effect_owner,'dummy-sealed-recovery') IS NOT TRUE OR
  public.farm_admin_reset_issue_effect_finish(v_effect_id,v_effect_owner,v_hash,(v_reset->>'id')::uuid,v_reset_owner,v_two,'dummy-sealed-reset-link') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: reset issue effect attachment.';END IF;
 PERFORM public.farm_admin_reset_release((v_reset->>'id')::uuid,v_reset_owner);
 v_claim:=public.farm_admin_reset_accept_claim((v_reset->>'id')::uuid,v_reset_accept_owner,v_reset_nonce);
 IF v_claim->>'user_id'<>v_two::text OR public.farm_admin_reset_accept_claim((v_reset->>'id')::uuid,gen_random_uuid(),v_reset_nonce) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: reset recipient or single-use lease.';END IF;
 v_effect_id:=gen_random_uuid();v_effect_owner:=gen_random_uuid();v_effect:=public.farm_effect_begin(v_effect_id,repeat('l',43),'reset_verify',v_effect_owner,'dummy-sealed-context');
 IF v_effect IS NULL OR public.farm_effect_capture(v_effect_id,v_effect_owner,'dummy-sealed-provider-tokens') IS NOT TRUE OR
  public.farm_admin_reset_accept_effect_progress(v_effect_id,v_effect_owner,(v_reset->>'id')::uuid,v_reset_accept_owner,'dummy-sealed-reset-credentials') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: reset acceptance proof checkpoint.';END IF;
 UPDATE auth.users SET email_confirmed_at=clock_timestamp(),encrypted_password='dummy-new-hash' WHERE id=v_two;
 IF public.farm_admin_reset_activate((v_reset->>'id')::uuid,v_reset_accept_owner,v_reset_nonce,(v_reset->>'generation')::integer,v_two) IS NOT TRUE OR
  public.farm_admin_reset_activate((v_reset->>'id')::uuid,v_reset_accept_owner,v_reset_nonce,(v_reset->>'generation')::integer,v_two) IS NOT FALSE THEN RAISE EXCEPTION 'FAIL: reset activation replay.';END IF;
 IF (SELECT state FROM farm_private.memberships WHERE user_id=v_two)<>'active' OR EXISTS(SELECT 1 FROM farm_private.sessions WHERE user_id=v_two AND revoked_at IS NULL) THEN RAISE EXCEPTION 'FAIL: reset changed membership or retained old sessions.';END IF;
 UPDATE farm_private.sessions SET reauthenticated_at=clock_timestamp()-interval '6 minutes' WHERE cookie_hash=v_hash;
 BEGIN PERFORM public.farm_admin_revoke(v_hash,v_two);RAISE EXCEPTION 'FAIL: stale confirmation accepted.';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 UPDATE farm_private.sessions SET reauthenticated_at=clock_timestamp() WHERE cookie_hash=v_hash;
 PERFORM public.farm_admin_revoke(v_hash,v_two);
 IF (SELECT state FROM farm_private.memberships WHERE user_id=v_two)<>'revoked' OR EXISTS(SELECT 1 FROM farm_private.sessions WHERE user_id=v_two AND revoked_at IS NULL) OR (public.farm_invitation_read((v_second_invite->>'id')::uuid)->>'state')<>'cancelled' THEN RAISE EXCEPTION 'FAIL: revocation/session/invitation invalidation.';END IF;
 IF (SELECT active_count FROM farm_private.admin_guard WHERE singleton)<>2 THEN RAISE EXCEPTION 'FAIL: active administrator count after first revoke.';END IF;
 PERFORM public.farm_admin_revoke(v_hash,v_recipient);
 IF (SELECT active_count FROM farm_private.admin_guard WHERE singleton)<>1 THEN RAISE EXCEPTION 'FAIL: active administrator count after final revoke.';END IF;
 BEGIN UPDATE farm_private.memberships SET state='revoked' WHERE user_id=v_one;RAISE EXCEPTION 'FAIL: last administrator revoked.';EXCEPTION WHEN check_violation THEN NULL;END;
END $$;
ROLLBACK;
SELECT 'PASS: equal-admin grants, recent-auth gate, provider issue lease, recipient-bound pending membership, single-use activation, resend invalidation, reset-only recovery and post-proof session revocation, session revocation and last-admin protection checked; fixtures rolled back. No email is sent. Provider HTTP and concurrency remain separate.' AS result;
