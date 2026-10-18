-- Equal-administrator lifecycle commands. Prepared locally; not hosted execution.
-- Every mutation checks recent reauthentication inside SQL and serializes account
-- count changes through admin_guard before invitation/session/membership locks.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170005_durable_cleanup') THEN
  RAISE EXCEPTION 'The durable cleanup migration is required.';
 END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170006_account_lifecycle') THEN
  RAISE EXCEPTION 'Account lifecycle migration already applied; do not rerun.';
 END IF;
END $$;

ALTER TABLE farm_private.invitations ADD COLUMN purpose text NOT NULL DEFAULT 'admin_invite' CHECK(purpose IN('admin_invite','password_reset'));

CREATE FUNCTION public.farm_invitation_read(p_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT to_jsonb(i) FROM farm_private.invitations AS i WHERE i.id=p_id;
$$;

CREATE FUNCTION farm_private.recent_admin(p_cookie_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session farm_private.sessions; v_count integer;
BEGIN
 SELECT g.active_count INTO v_count FROM farm_private.admin_guard AS g WHERE g.singleton FOR UPDATE;
 IF v_count IS NULL OR v_count<1 OR p_cookie_hash IS NULL OR p_cookie_hash!~'^[A-Za-z0-9_-]{43}$' THEN RETURN NULL;END IF;
 SELECT s.* INTO v_session FROM farm_private.sessions AS s WHERE s.cookie_hash=p_cookie_hash FOR UPDATE;
 IF v_session.id IS NULL OR v_session.revoked_at IS NOT NULL OR v_session.idle_expires_at<=clock_timestamp()
  OR v_session.absolute_expires_at<=clock_timestamp() OR v_session.reauthenticated_at IS NULL
  OR v_session.reauthenticated_at<=clock_timestamp()-interval '5 minutes' THEN RETURN NULL;END IF;
 PERFORM 1 FROM farm_private.memberships AS m WHERE m.user_id=v_session.user_id AND m.state='active' FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN v_session.user_id;
END $$;
REVOKE ALL ON FUNCTION farm_private.recent_admin(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.farm_admin_list(p_actor_cookie_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_result jsonb;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Recent administrator confirmation required.';END IF;
 SELECT jsonb_build_object(
  'admins',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.user_id,'email',u.email,'createdAt',m.created_at) ORDER BY lower(u.email),m.user_id)
   FROM farm_private.memberships AS m JOIN auth.users AS u ON u.id=m.user_id WHERE m.state='active'),'[]'::jsonb),
  'invitations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'email',i.recipient_email,'state',i.state,'issueState',i.issue_state,'expiresAt',i.expires_at,'generation',i.generation) ORDER BY i.created_at,i.id)
   FROM farm_private.invitations AS i WHERE i.invited_by IS NOT NULL AND i.purpose='admin_invite' AND i.state IN('queued','sent')),'[]'::jsonb),
  'passwordResets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'userId',i.user_id,'email',i.recipient_email,'state',i.state,'issueState',i.issue_state,'expiresAt',i.expires_at) ORDER BY i.created_at,i.id)
   FROM farm_private.invitations AS i WHERE i.invited_by IS NOT NULL AND i.purpose='password_reset' AND i.state='queued'),'[]'::jsonb)
 ) INTO v_result;
 RETURN v_result;
END $$;

CREATE FUNCTION public.farm_admin_invite_prepare(p_actor_cookie_hash text,p_email text,p_nonce_hash text,p_encrypted_nonce text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_row farm_private.invitations;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Recent administrator confirmation required.';END IF;
 IF p_email IS NULL OR p_email<>lower(btrim(p_email)) OR length(p_email)>254 OR p_email!~'^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$'
  OR p_nonce_hash IS NULL OR p_nonce_hash!~'^[A-Za-z0-9_-]{43}$' OR p_encrypted_nonce IS NULL OR length(p_encrypted_nonce) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Invalid invitation.';END IF;
 IF EXISTS(SELECT 1 FROM auth.users AS u JOIN farm_private.memberships AS m ON m.user_id=u.id WHERE lower(u.email)=p_email AND m.state='active') THEN RAISE EXCEPTION 'Recipient is already an administrator.';END IF;
 INSERT INTO farm_private.invitations(recipient_email,invited_by,state,nonce_hash,expires_at,encrypted_nonce)
 VALUES(p_email,v_actor,'queued',p_nonce_hash,clock_timestamp()+interval '7 days',p_encrypted_nonce) RETURNING * INTO v_row;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_actor,'admin_invite','queued',v_row.id);
 RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.farm_admin_invite_resend(p_actor_cookie_hash text,p_id uuid,p_nonce_hash text,p_encrypted_nonce text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_old farm_private.invitations;v_new farm_private.invitations;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Recent administrator confirmation required.';END IF;
 SELECT i.* INTO v_old FROM farm_private.invitations AS i WHERE i.id=p_id FOR UPDATE;
 IF v_old.id IS NULL OR v_old.invited_by IS NULL OR v_old.purpose<>'admin_invite' OR v_old.state NOT IN('queued','sent') OR v_old.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Invitation cannot be resent.';END IF;
 IF p_nonce_hash IS NULL OR p_nonce_hash!~'^[A-Za-z0-9_-]{43}$' OR p_encrypted_nonce IS NULL OR length(p_encrypted_nonce) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Invalid invitation.';END IF;
 UPDATE farm_private.invitations AS i SET state='cancelled',generation=i.generation+1,encrypted_nonce=NULL,encrypted_invite=NULL,lease_owner=NULL,lease_until=NULL,lease_phase=NULL
  WHERE i.id=p_id;
 UPDATE farm_private.memberships AS m SET state='revoked',updated_at=clock_timestamp() WHERE m.user_id=v_old.user_id AND m.state='pending';
 INSERT INTO farm_private.invitations(recipient_email,invited_by,state,nonce_hash,expires_at,encrypted_nonce,generation)
 VALUES(v_old.recipient_email,v_actor,'queued',p_nonce_hash,clock_timestamp()+interval '7 days',p_encrypted_nonce,v_old.generation+1) RETURNING * INTO v_new;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_actor,'admin_invite','resent',v_new.id);
 RETURN to_jsonb(v_new);
END $$;

-- Additional-admin provider invitation issue is separate from the singleton
-- bootstrap commands: every operation is bound to the recently confirmed inviter.
CREATE FUNCTION public.farm_admin_invite_claim(p_actor_cookie_hash text,p_id uuid,p_owner uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_row farm_private.invitations;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL OR p_owner IS NULL THEN RETURN NULL;END IF;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id AND i.invited_by=v_actor AND i.purpose='admin_invite' FOR UPDATE;
 IF v_row.id IS NULL OR v_row.state NOT IN('queued','sent') OR v_row.expires_at<=clock_timestamp()
  OR v_row.encrypted_nonce IS NULL OR v_row.lease_until>clock_timestamp() THEN RETURN NULL;END IF;
 IF v_row.issue_state='issuing' THEN
  UPDATE farm_private.invitations AS i SET issue_state='review',lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id;
  RETURN NULL;
 END IF;
 IF v_row.issue_state IN('ready','review') THEN RETURN NULL;END IF;
 UPDATE farm_private.invitations AS i SET issue_state='issuing',lease_owner=p_owner,lease_until=clock_timestamp()+interval '2 minutes',lease_phase='issue'
  WHERE i.id=p_id RETURNING i.* INTO v_row;
 RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.farm_admin_invite_issue_finish(p_actor_cookie_hash text,p_id uuid,p_owner uuid,p_user_id uuid,p_encrypted_invite text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_row farm_private.invitations;v_email text;v_member_state text;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL OR p_user_id IS NULL OR p_encrypted_invite IS NULL OR length(p_encrypted_invite) NOT BETWEEN 1 AND 20000 THEN RETURN false;END IF;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id AND i.invited_by=v_actor AND i.purpose='admin_invite' FOR UPDATE;
 IF v_row.id IS NULL OR v_row.state NOT IN('queued','sent') OR v_row.expires_at<=clock_timestamp() OR v_row.issue_state<>'issuing'
  OR v_row.lease_owner IS DISTINCT FROM p_owner OR p_owner IS NULL OR v_row.lease_phase IS DISTINCT FROM 'issue'
  OR v_row.lease_until IS NULL OR v_row.lease_until<=clock_timestamp() THEN RETURN false;END IF;
 SELECT lower(u.email) INTO v_email FROM auth.users AS u WHERE u.id=p_user_id;
 IF v_email IS DISTINCT FROM v_row.recipient_email THEN RETURN false;END IF;
 SELECT m.state INTO v_member_state FROM farm_private.memberships AS m WHERE m.user_id=p_user_id FOR UPDATE;
 IF v_member_state='active' THEN RETURN false;END IF;
 IF v_member_state='revoked' THEN
  UPDATE farm_private.memberships AS m SET state='pending',updated_at=clock_timestamp() WHERE m.user_id=p_user_id AND m.state='revoked';
 ELSIF v_member_state IS NULL THEN
  INSERT INTO farm_private.memberships(user_id,state) VALUES(p_user_id,'pending');
 ELSIF v_member_state IS DISTINCT FROM 'pending' THEN RETURN false;
 END IF;
 -- The provider identity and token are prepared durably, but no email has been sent.
 UPDATE farm_private.invitations AS i SET user_id=p_user_id,encrypted_invite=p_encrypted_invite,issue_state='ready',state='queued'
  WHERE i.id=p_id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_actor,'admin_invite','ready_for_delivery',p_id);
 RETURN true;
END $$;

CREATE FUNCTION public.farm_admin_invite_issue_effect_finish(p_effect_id uuid,p_effect_owner uuid,p_actor_cookie_hash text,p_id uuid,p_invitation_owner uuid,p_user_id uuid,p_encrypted_invite text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_effect farm_private.provider_effects;v_actor uuid;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL THEN RETURN false;END IF;
 SELECT e.* INTO v_effect FROM farm_private.provider_effects AS e WHERE e.id=p_effect_id FOR UPDATE;
 IF v_effect.id IS NULL OR v_effect.owner IS DISTINCT FROM p_effect_owner OR v_effect.state<>'captured' OR v_effect.operation<>'invite_issue'
  OR v_effect.lease_until<=clock_timestamp() THEN RETURN false;END IF;
 IF public.farm_admin_invite_issue_finish(p_actor_cookie_hash,p_id,p_invitation_owner,p_user_id,p_encrypted_invite) IS NOT TRUE THEN RETURN false;END IF;
 UPDATE farm_private.provider_effects AS e SET state='attached',source_kind='invitation',source_id=p_id,encrypted_credentials=NULL WHERE e.id=p_effect_id;
 RETURN true;
END $$;

CREATE FUNCTION public.farm_admin_invite_issue_effect_review(p_effect_id uuid,p_effect_owner uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE farm_private.provider_effects AS e SET state='review',lease_until=clock_timestamp()
 WHERE e.id=p_effect_id AND e.owner=p_effect_owner AND e.operation='invite_issue' AND e.state IN('started','captured');
 RETURN FOUND;
END
$$;

CREATE FUNCTION public.farm_admin_invite_accept_claim(p_id uuid,p_owner uuid,p_nonce_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.invitations;
BEGIN
 IF p_owner IS NULL OR p_nonce_hash IS NULL OR p_nonce_hash!~'^[A-Za-z0-9_-]{43}$' THEN RETURN NULL;END IF;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id AND i.invited_by IS NOT NULL AND i.purpose='admin_invite' FOR UPDATE;
 IF v_row.id IS NULL OR v_row.state NOT IN('queued','sent') OR v_row.expires_at<=clock_timestamp() OR v_row.nonce_hash<>p_nonce_hash
  OR v_row.issue_state<>'ready' OR v_row.encrypted_invite IS NULL OR v_row.lease_until>clock_timestamp()
  OR NOT EXISTS(SELECT 1 FROM farm_private.memberships AS m WHERE m.user_id=v_row.user_id AND m.state='pending') THEN RETURN NULL;END IF;
 UPDATE farm_private.invitations AS i SET lease_owner=p_owner,lease_until=clock_timestamp()+interval '2 minutes',lease_phase='accept'
  WHERE i.id=p_id RETURNING i.* INTO v_row;
 RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.farm_admin_invite_accept_progress(p_id uuid,p_owner uuid,p_encrypted_credentials text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_encrypted_credentials IS NULL OR length(p_encrypted_credentials) NOT BETWEEN 1 AND 40000 THEN RETURN false;END IF;
 UPDATE farm_private.invitations AS i SET encrypted_credentials=p_encrypted_credentials,credentials_generation=i.generation,provider_cleanup_pending=true
  WHERE i.id=p_id AND i.invited_by IS NOT NULL AND i.purpose='admin_invite' AND i.state IN('queued','sent') AND i.issue_state='ready' AND i.lease_owner=p_owner AND i.lease_phase='accept'
   AND i.lease_until>clock_timestamp();
 RETURN FOUND;
END $$;

CREATE FUNCTION public.farm_admin_invite_accept_effect_progress(p_effect_id uuid,p_effect_owner uuid,p_id uuid,p_invitation_owner uuid,p_encrypted_credentials text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_effect farm_private.provider_effects;
BEGIN
 SELECT e.* INTO v_effect FROM farm_private.provider_effects AS e WHERE e.id=p_effect_id FOR UPDATE;
 IF v_effect.id IS NULL OR v_effect.owner IS DISTINCT FROM p_effect_owner OR v_effect.state<>'captured'
  OR v_effect.operation NOT IN('invite_verify','invite_refresh','password_proof') OR v_effect.lease_until<=clock_timestamp() THEN RETURN false;END IF;
 IF public.farm_admin_invite_accept_progress(p_id,p_invitation_owner,p_encrypted_credentials) IS NOT TRUE THEN RETURN false;END IF;
 UPDATE farm_private.provider_effects AS e SET state='attached',source_kind='invitation',source_id=p_id,encrypted_credentials=NULL WHERE e.id=p_effect_id;
 RETURN true;
END $$;

CREATE FUNCTION public.farm_admin_invite_activate(p_id uuid,p_owner uuid,p_nonce_hash text,p_generation integer,p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.invitations;
BEGIN
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id AND i.invited_by IS NOT NULL AND i.purpose='admin_invite' FOR UPDATE;
 IF v_row.id IS NULL OR v_row.state NOT IN('queued','sent') OR v_row.expires_at<=clock_timestamp() OR v_row.nonce_hash IS DISTINCT FROM p_nonce_hash
  OR v_row.generation IS DISTINCT FROM p_generation OR v_row.user_id IS DISTINCT FROM p_user_id OR v_row.issue_state<>'ready'
  OR v_row.encrypted_credentials IS NULL OR v_row.lease_owner IS DISTINCT FROM p_owner OR v_row.lease_phase IS DISTINCT FROM 'accept'
  OR v_row.lease_until IS NULL OR v_row.lease_until<=clock_timestamp() THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users AS u WHERE u.id=p_user_id AND lower(u.email)=v_row.recipient_email
  AND u.email_confirmed_at IS NOT NULL AND coalesce(length(u.encrypted_password),0)>0) THEN RETURN false;END IF;
 UPDATE farm_private.memberships AS m SET state='active',updated_at=clock_timestamp() WHERE m.user_id=p_user_id AND m.state='pending';
 IF NOT FOUND THEN RETURN false;END IF;
 UPDATE farm_private.invitations AS i SET state='accepted',encrypted_nonce=NULL,encrypted_invite=NULL,lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(p_user_id,'admin_invite_activate','accepted',p_id);
 RETURN true;
END $$;

CREATE FUNCTION public.farm_admin_invite_release(p_id uuid,p_owner uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE farm_private.invitations AS i SET issue_state=CASE WHEN i.lease_phase='issue' AND i.issue_state='issuing' THEN 'review' ELSE i.issue_state END,
  lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id AND i.invited_by IS NOT NULL AND i.purpose='admin_invite' AND i.lease_owner=p_owner;
END $$;

CREATE FUNCTION public.farm_admin_invite_cleanup_done(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE farm_private.invitations AS i SET provider_cleanup_pending=false,encrypted_credentials=NULL,credentials_generation=NULL
 WHERE i.id=p_id AND i.invited_by IS NOT NULL AND i.purpose IN('admin_invite','password_reset');
$$;

-- Password recovery shares the encrypted invitation ledger so the existing
-- cleanup worker retains recovery credentials until provider sign-out succeeds.
CREATE FUNCTION public.farm_admin_reset_prepare(p_actor_cookie_hash text,p_user_id uuid,p_nonce_hash text,p_encrypted_nonce text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_email text;v_row farm_private.invitations;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL OR p_user_id IS NULL OR p_nonce_hash IS NULL OR p_nonce_hash!~'^[A-Za-z0-9_-]{43}$'
  OR p_encrypted_nonce IS NULL OR length(p_encrypted_nonce) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Invalid recovery request.';END IF;
 IF NOT EXISTS(SELECT 1 FROM farm_private.memberships AS m WHERE m.user_id=p_user_id AND m.state='active') THEN RAISE EXCEPTION 'Administrator is unavailable.';END IF;
 SELECT lower(u.email) INTO v_email FROM auth.users AS u WHERE u.id=p_user_id;
 IF v_email IS NULL THEN RAISE EXCEPTION 'Administrator is unavailable.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.invitations AS i WHERE i.user_id=p_user_id AND i.purpose='password_reset' AND i.state IN('queued','sent')) THEN RAISE EXCEPTION 'Recovery is already pending.';END IF;
 INSERT INTO farm_private.invitations(recipient_email,user_id,invited_by,state,nonce_hash,expires_at,encrypted_nonce,purpose)
 VALUES(v_email,p_user_id,v_actor,'queued',p_nonce_hash,clock_timestamp()+interval '1 day',p_encrypted_nonce,'password_reset') RETURNING * INTO v_row;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_actor,'admin_password_reset','queued',v_row.id);
 RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.farm_admin_reset_claim(p_actor_cookie_hash text,p_id uuid,p_owner uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_row farm_private.invitations;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);IF v_actor IS NULL OR p_owner IS NULL THEN RETURN NULL;END IF;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id AND i.invited_by=v_actor AND i.purpose='password_reset' FOR UPDATE;
 IF v_row.id IS NULL OR v_row.state<>'queued' OR v_row.expires_at<=clock_timestamp() OR v_row.encrypted_nonce IS NULL OR v_row.lease_until>clock_timestamp() THEN RETURN NULL;END IF;
 IF v_row.issue_state='issuing' THEN UPDATE farm_private.invitations AS i SET issue_state='review',lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id;RETURN NULL;END IF;
 IF v_row.issue_state IN('ready','review') THEN RETURN NULL;END IF;
 UPDATE farm_private.invitations AS i SET issue_state='issuing',lease_owner=p_owner,lease_until=clock_timestamp()+interval '2 minutes',lease_phase='issue' WHERE i.id=p_id RETURNING i.* INTO v_row;
 RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.farm_admin_reset_issue_finish(p_actor_cookie_hash text,p_id uuid,p_owner uuid,p_user_id uuid,p_encrypted_recovery text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_row farm_private.invitations;v_email text;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);IF v_actor IS NULL OR p_user_id IS NULL OR p_encrypted_recovery IS NULL OR length(p_encrypted_recovery) NOT BETWEEN 1 AND 20000 THEN RETURN false;END IF;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id AND i.invited_by=v_actor AND i.purpose='password_reset' FOR UPDATE;
 IF v_row.id IS NULL OR v_row.state<>'queued' OR v_row.expires_at<=clock_timestamp() OR v_row.user_id IS DISTINCT FROM p_user_id OR v_row.issue_state<>'issuing'
  OR v_row.lease_owner IS DISTINCT FROM p_owner OR v_row.lease_phase IS DISTINCT FROM 'issue' OR v_row.lease_until IS NULL OR v_row.lease_until<=clock_timestamp() THEN RETURN false;END IF;
 SELECT lower(u.email) INTO v_email FROM auth.users AS u WHERE u.id=p_user_id;
 IF v_email IS DISTINCT FROM v_row.recipient_email OR NOT EXISTS(SELECT 1 FROM farm_private.memberships AS m WHERE m.user_id=p_user_id AND m.state='active') THEN RETURN false;END IF;
 UPDATE farm_private.invitations AS i SET encrypted_invite=p_encrypted_recovery,issue_state='ready' WHERE i.id=p_id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_actor,'admin_password_reset','ready_for_delivery',p_id);
 RETURN true;
END $$;

CREATE FUNCTION public.farm_admin_reset_issue_effect_finish(p_effect_id uuid,p_effect_owner uuid,p_actor_cookie_hash text,p_id uuid,p_reset_owner uuid,p_user_id uuid,p_encrypted_recovery text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_effect farm_private.provider_effects;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);IF v_actor IS NULL THEN RETURN false;END IF;
 SELECT e.* INTO v_effect FROM farm_private.provider_effects AS e WHERE e.id=p_effect_id FOR UPDATE;
 IF v_effect.id IS NULL OR v_effect.owner IS DISTINCT FROM p_effect_owner OR v_effect.state<>'captured' OR v_effect.operation<>'reset_issue' OR v_effect.lease_until<=clock_timestamp() THEN RETURN false;END IF;
 IF public.farm_admin_reset_issue_finish(p_actor_cookie_hash,p_id,p_reset_owner,p_user_id,p_encrypted_recovery) IS NOT TRUE THEN RETURN false;END IF;
 UPDATE farm_private.provider_effects AS e SET state='attached',source_kind='invitation',source_id=p_id,encrypted_credentials=NULL WHERE e.id=p_effect_id;
 RETURN true;
END $$;

CREATE FUNCTION public.farm_admin_reset_issue_effect_review(p_effect_id uuid,p_effect_owner uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE farm_private.provider_effects AS e SET state='review',lease_until=clock_timestamp()
 WHERE e.id=p_effect_id AND e.owner=p_effect_owner AND e.operation='reset_issue' AND e.state IN('started','captured');
 RETURN FOUND;
END $$;

CREATE FUNCTION public.farm_admin_reset_accept_claim(p_id uuid,p_owner uuid,p_nonce_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.invitations;
BEGIN
 IF p_owner IS NULL OR p_nonce_hash IS NULL OR p_nonce_hash!~'^[A-Za-z0-9_-]{43}$' THEN RETURN NULL;END IF;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id AND i.purpose='password_reset' AND i.invited_by IS NOT NULL FOR UPDATE;
 IF v_row.id IS NULL OR v_row.state<>'queued' OR v_row.expires_at<=clock_timestamp() OR v_row.nonce_hash<>p_nonce_hash OR v_row.issue_state<>'ready'
  OR v_row.encrypted_invite IS NULL OR v_row.lease_until>clock_timestamp() OR NOT EXISTS(SELECT 1 FROM farm_private.memberships AS m WHERE m.user_id=v_row.user_id AND m.state='active') THEN RETURN NULL;END IF;
 UPDATE farm_private.invitations AS i SET lease_owner=p_owner,lease_until=clock_timestamp()+interval '2 minutes',lease_phase='accept' WHERE i.id=p_id RETURNING i.* INTO v_row;
 RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.farm_admin_reset_accept_progress(p_id uuid,p_owner uuid,p_encrypted_credentials text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_encrypted_credentials IS NULL OR length(p_encrypted_credentials) NOT BETWEEN 1 AND 40000 THEN RETURN false;END IF;
 UPDATE farm_private.invitations AS i SET encrypted_credentials=p_encrypted_credentials,credentials_generation=i.generation,provider_cleanup_pending=true
  WHERE i.id=p_id AND i.purpose='password_reset' AND i.state='queued' AND i.issue_state='ready' AND i.lease_owner=p_owner AND i.lease_phase='accept' AND i.lease_until>clock_timestamp();
 RETURN FOUND;
END $$;

CREATE FUNCTION public.farm_admin_reset_accept_effect_progress(p_effect_id uuid,p_effect_owner uuid,p_id uuid,p_reset_owner uuid,p_encrypted_credentials text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_effect farm_private.provider_effects;
BEGIN
 SELECT e.* INTO v_effect FROM farm_private.provider_effects AS e WHERE e.id=p_effect_id FOR UPDATE;
 IF v_effect.id IS NULL OR v_effect.owner IS DISTINCT FROM p_effect_owner OR v_effect.state<>'captured' OR v_effect.operation NOT IN('reset_verify','reset_refresh','reset_proof') OR v_effect.lease_until<=clock_timestamp() THEN RETURN false;END IF;
 IF public.farm_admin_reset_accept_progress(p_id,p_reset_owner,p_encrypted_credentials) IS NOT TRUE THEN RETURN false;END IF;
 UPDATE farm_private.provider_effects AS e SET state='attached',source_kind='invitation',source_id=p_id,encrypted_credentials=NULL WHERE e.id=p_effect_id;
 RETURN true;
END $$;

CREATE FUNCTION public.farm_admin_reset_activate(p_id uuid,p_owner uuid,p_nonce_hash text,p_generation integer,p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.invitations;
BEGIN
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id AND i.purpose='password_reset' AND i.invited_by IS NOT NULL FOR UPDATE;
 IF v_row.id IS NULL OR v_row.state<>'queued' OR v_row.expires_at<=clock_timestamp() OR v_row.nonce_hash IS DISTINCT FROM p_nonce_hash OR v_row.generation IS DISTINCT FROM p_generation
  OR v_row.user_id IS DISTINCT FROM p_user_id OR v_row.issue_state<>'ready' OR v_row.encrypted_credentials IS NULL OR v_row.lease_owner IS DISTINCT FROM p_owner
  OR v_row.lease_phase IS DISTINCT FROM 'accept' OR v_row.lease_until IS NULL OR v_row.lease_until<=clock_timestamp()
  OR NOT EXISTS(SELECT 1 FROM farm_private.memberships AS m WHERE m.user_id=p_user_id AND m.state='active')
  OR NOT EXISTS(SELECT 1 FROM auth.users AS u WHERE u.id=p_user_id AND lower(u.email)=v_row.recipient_email AND u.email_confirmed_at IS NOT NULL AND coalesce(length(u.encrypted_password),0)>0) THEN RETURN false;END IF;
 UPDATE farm_private.invitations AS i SET state='accepted',encrypted_nonce=NULL,encrypted_invite=NULL,provider_cleanup_pending=true,lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id;
 UPDATE farm_private.sessions AS s SET revoked_at=coalesce(s.revoked_at,clock_timestamp()),provider_cleanup_pending=true,reauth_until=NULL,refresh_owner=NULL,refresh_until=NULL
  WHERE s.user_id=p_user_id AND (s.revoked_at IS NULL OR s.provider_cleanup_pending);
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(p_user_id,'admin_password_reset','completed',p_id);
 RETURN true;
END $$;

CREATE FUNCTION public.farm_admin_reset_release(p_id uuid,p_owner uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE farm_private.invitations AS i SET issue_state=CASE WHEN i.lease_phase='issue' AND i.issue_state='issuing' THEN 'review' ELSE i.issue_state END,
  lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id AND i.purpose='password_reset' AND i.lease_owner=p_owner;
END $$;

CREATE FUNCTION public.farm_admin_reset_cancel(p_actor_cookie_hash text,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_row farm_private.invitations;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Recent administrator confirmation required.';END IF;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id AND i.purpose='password_reset' AND i.invited_by=v_actor FOR UPDATE;
 IF v_row.id IS NULL OR v_row.state<>'queued' THEN RETURN false;END IF;
 UPDATE farm_private.invitations AS i SET state='cancelled',generation=i.generation+1,encrypted_nonce=NULL,encrypted_invite=NULL,lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_actor,'admin_password_reset','cancelled',p_id);RETURN true;
END $$;

CREATE FUNCTION public.farm_admin_invite_cancel(p_actor_cookie_hash text,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_row farm_private.invitations;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Recent administrator confirmation required.';END IF;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.invited_by IS NULL OR v_row.purpose<>'admin_invite' OR v_row.state NOT IN('queued','sent') THEN RETURN false;END IF;
 UPDATE farm_private.invitations AS i SET state='cancelled',generation=i.generation+1,encrypted_nonce=NULL,encrypted_invite=NULL,lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id;
 UPDATE farm_private.memberships AS m SET state='revoked',updated_at=clock_timestamp() WHERE m.user_id=v_row.user_id AND m.state='pending';
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_actor,'admin_invite','cancelled',p_id);RETURN true;
END $$;

CREATE FUNCTION public.farm_admin_revoke(p_actor_cookie_hash text,p_target_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_count integer;v_target_state text;v_invite farm_private.invitations;
BEGIN
 v_actor:=farm_private.recent_admin(p_actor_cookie_hash);
 IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Recent administrator confirmation required.';END IF;
 IF p_target_id IS NULL OR p_target_id=v_actor THEN RAISE EXCEPTION 'Cannot revoke this administrator.';END IF;
 -- recent_admin already holds guard and actor locks. This second read makes the
 -- last-admin decision explicit while trigger and guard serialize all revokes.
 SELECT g.active_count INTO v_count FROM farm_private.admin_guard AS g WHERE g.singleton FOR UPDATE;
 SELECT m.state INTO v_target_state FROM farm_private.memberships AS m WHERE m.user_id=p_target_id FOR UPDATE;
 IF v_target_state IS DISTINCT FROM 'active' OR v_count<2 THEN RAISE EXCEPTION 'Administrator cannot be revoked.';END IF;
 UPDATE farm_private.memberships AS m SET state='revoked',updated_at=clock_timestamp() WHERE m.user_id=p_target_id;
 UPDATE farm_private.sessions AS s SET revoked_at=coalesce(s.revoked_at,clock_timestamp()),provider_cleanup_pending=true,reauth_until=NULL,refresh_owner=NULL,refresh_until=NULL
  WHERE s.user_id=p_target_id AND (s.revoked_at IS NULL OR s.provider_cleanup_pending);
 FOR v_invite IN SELECT i.* FROM farm_private.invitations AS i WHERE i.invited_by=p_target_id AND i.state IN('queued','sent') FOR UPDATE LOOP
  UPDATE farm_private.invitations AS i SET state='cancelled',generation=i.generation+1,encrypted_nonce=NULL,encrypted_invite=NULL,lease_owner=NULL,lease_until=NULL,lease_phase=NULL
   WHERE i.id=v_invite.id;
  IF v_invite.purpose='admin_invite' THEN UPDATE farm_private.memberships AS m SET state='revoked',updated_at=clock_timestamp() WHERE m.user_id=v_invite.user_id AND m.state='pending';END IF;
 END LOOP;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_actor,'admin_membership','revoked',p_target_id);
 RETURN true;
END $$;

DO $$ DECLARE v_proc regprocedure;BEGIN
 FOREACH v_proc IN ARRAY ARRAY[
  'public.farm_invitation_read(uuid)'::regprocedure,'public.farm_admin_list(text)'::regprocedure,'public.farm_admin_invite_prepare(text,text,text,text)'::regprocedure,
  'public.farm_admin_invite_resend(text,uuid,text,text)'::regprocedure,'public.farm_admin_invite_cancel(text,uuid)'::regprocedure,
  'public.farm_admin_invite_claim(text,uuid,uuid)'::regprocedure,'public.farm_admin_invite_issue_finish(text,uuid,uuid,uuid,text)'::regprocedure,
  'public.farm_admin_invite_issue_effect_finish(uuid,uuid,text,uuid,uuid,uuid,text)'::regprocedure,
  'public.farm_admin_invite_issue_effect_review(uuid,uuid)'::regprocedure,
  'public.farm_admin_invite_accept_claim(uuid,uuid,text)'::regprocedure,'public.farm_admin_invite_accept_progress(uuid,uuid,text)'::regprocedure,
  'public.farm_admin_invite_accept_effect_progress(uuid,uuid,uuid,uuid,text)'::regprocedure,'public.farm_admin_invite_activate(uuid,uuid,text,integer,uuid)'::regprocedure,
  'public.farm_admin_invite_release(uuid,uuid)'::regprocedure,'public.farm_admin_invite_cleanup_done(uuid)'::regprocedure,
  'public.farm_admin_reset_prepare(text,uuid,text,text)'::regprocedure,'public.farm_admin_reset_claim(text,uuid,uuid)'::regprocedure,
  'public.farm_admin_reset_issue_finish(text,uuid,uuid,uuid,text)'::regprocedure,'public.farm_admin_reset_issue_effect_finish(uuid,uuid,text,uuid,uuid,uuid,text)'::regprocedure,
  'public.farm_admin_reset_issue_effect_review(uuid,uuid)'::regprocedure,'public.farm_admin_reset_accept_claim(uuid,uuid,text)'::regprocedure,
  'public.farm_admin_reset_accept_progress(uuid,uuid,text)'::regprocedure,'public.farm_admin_reset_accept_effect_progress(uuid,uuid,uuid,uuid,text)'::regprocedure,
  'public.farm_admin_reset_activate(uuid,uuid,text,integer,uuid)'::regprocedure,'public.farm_admin_reset_release(uuid,uuid)'::regprocedure,
  'public.farm_admin_reset_cancel(text,uuid)'::regprocedure,
  'public.farm_admin_revoke(text,uuid)'::regprocedure] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',v_proc);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',v_proc);
 END LOOP;
END $$;
INSERT INTO farm_private.schema_migrations(version) VALUES('202610170006_account_lifecycle');
NOTIFY pgrst,'reload schema';
COMMIT;
