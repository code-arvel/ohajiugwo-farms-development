-- Prepared locally only. Explicit SMTP delivery intent; sends no email on application.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611250015_session_reconciliation') THEN RAISE EXCEPTION 'Migration015 required.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611250016_account_email_delivery') THEN RAISE EXCEPTION 'Migration016 already applied; do not rerun.';END IF;
END $$;
ALTER TABLE farm_private.invitations ADD COLUMN delivery_state text NOT NULL DEFAULT 'not_sent' CHECK(delivery_state IN('not_sent','sending','sent_to_provider'));
CREATE FUNCTION public.farm_admin_email_begin(p_actor_cookie_hash text,p_id uuid,p_owner uuid,p_purpose text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_row farm_private.invitations;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL OR p_owner IS NULL OR p_purpose IS NULL OR p_purpose NOT IN('admin_invite','password_reset') THEN RETURN false;END IF;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.invited_by IS DISTINCT FROM v_actor OR v_row.purpose<>p_purpose
  OR v_row.state NOT IN('queued','sent') OR v_row.expires_at<=clock_timestamp() OR v_row.issue_state<>'issuing'
  OR v_row.lease_phase IS DISTINCT FROM 'issue' OR v_row.lease_owner IS DISTINCT FROM p_owner OR v_row.lease_until IS NULL OR v_row.lease_until<=clock_timestamp()
  OR v_row.delivery_state<>'not_sent' THEN RETURN false;END IF;
 UPDATE farm_private.invitations SET delivery_state='sending' WHERE id=p_id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_actor,'admin_email','request_started',p_id);
 RETURN true;
END $$;
CREATE FUNCTION public.farm_admin_email_finish(p_effect_id uuid,p_effect_owner uuid,p_actor_cookie_hash text,p_id uuid,p_owner uuid,p_user_id uuid,p_encrypted_invite text,p_purpose text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_row farm_private.invitations;v_done boolean;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL OR p_purpose IS NULL OR p_purpose NOT IN('admin_invite','password_reset') THEN RETURN false;END IF;
 -- Preserve existing guard -> effect -> invitation lock order.
 PERFORM e.id FROM farm_private.provider_effects AS e WHERE e.id=p_effect_id FOR UPDATE;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.invited_by IS DISTINCT FROM v_actor OR v_row.purpose<>p_purpose OR v_row.delivery_state<>'sending' THEN RETURN false;END IF;
 IF p_purpose='admin_invite' THEN
  v_done:=public.farm_admin_invite_issue_effect_finish(p_effect_id,p_effect_owner,p_actor_cookie_hash,p_id,p_owner,p_user_id,p_encrypted_invite);
 ELSE
  v_done:=public.farm_admin_reset_issue_effect_finish(p_effect_id,p_effect_owner,p_actor_cookie_hash,p_id,p_owner,p_user_id,p_encrypted_invite);
 END IF;
 IF v_done IS NOT TRUE THEN RETURN false;END IF;
 UPDATE farm_private.invitations SET delivery_state='sent_to_provider' WHERE id=p_id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_actor,'admin_email','sent_to_provider',p_id);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.farm_admin_list(p_actor_cookie_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_result jsonb;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Recent administrator confirmation required.';END IF;
 SELECT jsonb_build_object(
  'admins',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.user_id,'email',u.email,'createdAt',m.created_at) ORDER BY lower(u.email),m.user_id)
   FROM farm_private.memberships AS m JOIN auth.users AS u ON u.id=m.user_id WHERE m.state='active'),'[]'::jsonb),
  'invitations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'email',i.recipient_email,'state',i.state,'issueState',i.issue_state,'deliveryState',i.delivery_state,'expiresAt',i.expires_at,'generation',i.generation) ORDER BY i.created_at,i.id)
   FROM farm_private.invitations AS i WHERE i.invited_by IS NOT NULL AND i.purpose='admin_invite' AND i.state IN('queued','sent')),'[]'::jsonb),
  'passwordResets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'userId',i.user_id,'email',i.recipient_email,'state',i.state,'issueState',i.issue_state,'deliveryState',i.delivery_state,'expiresAt',i.expires_at) ORDER BY i.created_at,i.id)
   FROM farm_private.invitations AS i WHERE i.invited_by IS NOT NULL AND i.purpose='password_reset' AND i.state='queued'),'[]'::jsonb)
 ) INTO v_result;
 RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.farm_admin_email_begin(text,uuid,uuid,text),public.farm_admin_email_finish(uuid,uuid,text,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.farm_admin_email_begin(text,uuid,uuid,text),public.farm_admin_email_finish(uuid,uuid,text,uuid,uuid,uuid,text,text) TO service_role;
INSERT INTO farm_private.schema_migrations(version) VALUES('202611250016_account_email_delivery');
NOTIFY pgrst,'reload schema';
COMMIT;
