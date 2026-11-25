-- Whole rollback-only owner/postgres verification after reviewed migration016.
-- Disposable SQL identities/records only. No provider, SMTP or email request.
BEGIN;
DO $$
DECLARE v_actor uuid:=gen_random_uuid();v_recipient uuid:=gen_random_uuid();v_provider_session uuid:=gen_random_uuid();
 v_cookie text:=replace(gen_random_uuid()::text,'-','')||repeat('a',11);v_owner uuid:=gen_random_uuid();v_effect uuid:=gen_random_uuid();v_effect_owner uuid:=gen_random_uuid();v_invite jsonb;v_reset jsonb;v_list jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611250016_account_email_delivery') THEN RAISE EXCEPTION 'Migration016 required.';END IF;
 IF has_function_privilege('anon','public.farm_admin_email_begin(text,uuid,uuid,text)','EXECUTE') OR has_function_privilege('authenticated','public.farm_admin_email_finish(uuid,uuid,text,uuid,uuid,uuid,text,text)','EXECUTE') OR NOT has_function_privilege('service_role','public.farm_admin_email_finish(uuid,uuid,text,uuid,uuid,uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'FAIL: email command grants.';END IF;
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(v_actor,'email-actor-'||v_actor||'@example.test',now()),(v_recipient,'email-recipient-'||v_recipient||'@example.test',NULL);
 INSERT INTO farm_private.memberships(user_id,state) VALUES(v_actor,'active');
 PERFORM public.farm_session_open(v_actor,v_provider_session::text,v_cookie,'sealed-fixture',repeat('c',43));
 UPDATE farm_private.sessions SET reauthenticated_at=clock_timestamp() WHERE cookie_hash=v_cookie;
 v_invite:=public.farm_admin_invite_prepare(v_cookie,'email-recipient-'||v_recipient||'@example.test',repeat('n',43),'sealed-nonce');
 PERFORM public.farm_admin_invite_claim(v_cookie,(v_invite->>'id')::uuid,v_owner);
 IF public.farm_admin_email_begin(v_cookie,(v_invite->>'id')::uuid,gen_random_uuid(),'admin_invite') THEN RAISE EXCEPTION 'FAIL: wrong lease owner accepted.';END IF;
 IF public.farm_admin_email_begin(v_cookie,(v_invite->>'id')::uuid,v_owner,'password_reset') THEN RAISE EXCEPTION 'FAIL: wrong purpose accepted.';END IF;
 IF public.farm_admin_email_begin(v_cookie,(v_invite->>'id')::uuid,v_owner,'admin_invite') IS NOT TRUE OR public.farm_admin_email_begin(v_cookie,(v_invite->>'id')::uuid,v_owner,'admin_invite') THEN RAISE EXCEPTION 'FAIL: send intent/idempotency.';END IF;
 PERFORM public.farm_effect_begin(v_effect,repeat('s',43),'invite_issue',v_effect_owner,'sealed-context');
 PERFORM public.farm_effect_capture(v_effect,v_effect_owner,'sealed-marker');
 IF public.farm_admin_email_finish(v_effect,v_effect_owner,v_cookie,(v_invite->>'id')::uuid,v_owner,v_recipient,'sealed-marker','admin_invite') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: finalisation.';END IF;
 IF public.farm_admin_email_finish(v_effect,v_effect_owner,v_cookie,(v_invite->>'id')::uuid,v_owner,v_recipient,'sealed-marker','admin_invite') THEN RAISE EXCEPTION 'FAIL: repeated finalisation.';END IF;
 v_list:=public.farm_admin_list(v_cookie);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_list->'invitations') i WHERE i->>'id'=v_invite->>'id' AND i->>'deliveryState'='sent_to_provider') THEN RAISE EXCEPTION 'FAIL: honest delivery inventory.';END IF;
 IF (SELECT state FROM farm_private.memberships WHERE user_id=v_recipient) IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'FAIL: email must not activate membership.';END IF;
 -- A password reset has its own lease, purpose and provider effect.
 UPDATE farm_private.memberships SET state='active' WHERE user_id=v_recipient;
 UPDATE farm_private.invitations SET state='accepted' WHERE id=(v_invite->>'id')::uuid;
 v_reset:=public.farm_admin_reset_prepare(v_cookie,v_recipient,repeat('r',43),'sealed-reset-nonce');
 v_owner:=gen_random_uuid();v_effect:=gen_random_uuid();v_effect_owner:=gen_random_uuid();
 PERFORM public.farm_admin_reset_claim(v_cookie,(v_reset->>'id')::uuid,v_owner);
 IF public.farm_admin_email_begin(v_cookie,(v_reset->>'id')::uuid,v_owner,'password_reset') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: reset intent.';END IF;
 PERFORM public.farm_effect_begin(v_effect,repeat('t',43),'reset_issue',v_effect_owner,'sealed-reset-context');PERFORM public.farm_effect_capture(v_effect,v_effect_owner,'sealed-reset-marker');
 IF public.farm_admin_email_finish(v_effect,v_effect_owner,v_cookie,(v_reset->>'id')::uuid,v_owner,v_recipient,'sealed-reset-marker','password_reset') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: reset finalisation.';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: account email grants, recent-admin/lease/purpose guards, single intent, atomic provider-acceptance status, pending membership and reset ledger; fixtures rolled back. No email sent; real provider/inbox/acceptance remain separate.' AS result;
