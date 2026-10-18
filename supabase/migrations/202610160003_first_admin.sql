-- Additive first-admin lifecycle. PREPARED ONLY: do not run as part of local tests.
-- No provider identity, mail or active administrator is created by this migration.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610160002_session_commands') THEN
  RAISE EXCEPTION 'The verified session-command migration is required.';
 END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610160003_first_admin') THEN
  RAISE EXCEPTION 'First-admin migration already applied. Do not rerun it.';
 END IF;
END $$;
ALTER TABLE farm_private.invitations
 ADD COLUMN encrypted_nonce text,
 ADD COLUMN encrypted_invite text,
 ADD COLUMN encrypted_credentials text,
 ADD COLUMN credentials_generation integer,
 ADD COLUMN provider_cleanup_pending boolean NOT NULL DEFAULT false,
 ADD COLUMN issue_state text NOT NULL DEFAULT 'new' CHECK(issue_state IN('new','issuing','ready','review')),
 ADD COLUMN lease_owner uuid,
 ADD COLUMN lease_until timestamptz,
 ADD COLUMN lease_phase text CHECK(lease_phase IN('issue','accept'));

-- One lock order for every first-admin mutation: guard, invitation, membership.
CREATE FUNCTION farm_private.bootstrap_pending(p_id uuid) RETURNS farm_private.invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.invitations; v_count integer;
BEGIN
 SELECT g.active_count INTO v_count FROM farm_private.admin_guard AS g WHERE g.singleton FOR UPDATE;
 IF v_count IS DISTINCT FROM 0 THEN RETURN NULL; END IF;
 SELECT i.* INTO v_row FROM farm_private.invitations AS i WHERE i.id=p_id AND i.invited_by IS NULL FOR UPDATE;
 IF v_row.id IS NULL OR v_row.state NOT IN('queued','sent') OR v_row.expires_at<=clock_timestamp() THEN RETURN NULL; END IF;
 RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION farm_private.bootstrap_pending(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.farm_bootstrap_prepare(p_email text,p_nonce_hash text,p_encrypted_nonce text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_reserved jsonb; v_row farm_private.invitations;
BEGIN
 IF p_encrypted_nonce IS NULL OR length(p_encrypted_nonce) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Invalid encrypted nonce.'; END IF;
 -- Reuse the already verified singleton reservation. No replacement of old commands.
 v_reserved:=public.farm_bootstrap_reserve(p_email,p_nonce_hash);
 UPDATE farm_private.invitations AS i SET encrypted_nonce=p_encrypted_nonce WHERE i.id=(v_reserved->>'id')::uuid RETURNING i.* INTO v_row;
 RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.farm_bootstrap_read(p_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT to_jsonb(i) FROM farm_private.invitations AS i WHERE i.id=p_id AND i.invited_by IS NULL;
$$;

CREATE FUNCTION public.farm_bootstrap_claim(p_id uuid,p_owner uuid,p_phase text,p_nonce_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.invitations;
BEGIN
 IF p_owner IS NULL OR p_phase IS NULL OR p_phase NOT IN('issue','accept') THEN RAISE EXCEPTION 'Invalid lease.'; END IF;
 v_row:=farm_private.bootstrap_pending(p_id);
 IF v_row.id IS NULL OR v_row.encrypted_nonce IS NULL OR v_row.lease_until>clock_timestamp() THEN RETURN NULL; END IF;
 IF p_phase='accept' THEN
  IF p_nonce_hash IS NULL OR v_row.nonce_hash<>p_nonce_hash OR v_row.issue_state<>'ready' OR v_row.encrypted_invite IS NULL
   OR NOT EXISTS(SELECT 1 FROM farm_private.memberships AS m WHERE m.user_id=v_row.user_id AND m.state='pending') THEN RETURN NULL; END IF;
 ELSE
  IF v_row.issue_state='review' THEN RETURN NULL; END IF;
  IF v_row.issue_state='issuing' THEN
   UPDATE farm_private.invitations AS i SET issue_state='review',lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id;
   RETURN NULL;
  END IF;
 END IF;
 UPDATE farm_private.invitations AS i
 SET lease_owner=p_owner,lease_until=clock_timestamp()+interval '2 minutes',lease_phase=p_phase,
  issue_state=CASE WHEN p_phase='issue' AND i.issue_state='new' THEN 'issuing' ELSE i.issue_state END
 WHERE i.id=p_id RETURNING i.* INTO v_row;
 RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.farm_bootstrap_issue_finish(p_id uuid,p_owner uuid,p_user_id uuid,p_encrypted_invite text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.invitations; v_email text;
BEGIN
 IF p_encrypted_invite IS NULL OR length(p_encrypted_invite) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Invalid encrypted invitation.'; END IF;
 v_row:=farm_private.bootstrap_pending(p_id);
 IF v_row.id IS NULL OR v_row.lease_owner IS DISTINCT FROM p_owner OR p_owner IS NULL
  OR v_row.lease_until IS NULL OR v_row.lease_until<=clock_timestamp() OR v_row.lease_phase IS DISTINCT FROM 'issue' OR v_row.issue_state<>'issuing' THEN RETURN false; END IF;
 SELECT lower(u.email) INTO v_email FROM auth.users AS u WHERE u.id=p_user_id;
 IF v_email IS DISTINCT FROM v_row.recipient_email THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM farm_private.memberships AS m WHERE m.user_id=p_user_id AND m.state<>'pending') THEN RETURN false; END IF;
 INSERT INTO farm_private.memberships(user_id,state) VALUES(p_user_id,'pending') ON CONFLICT(user_id) DO NOTHING;
 UPDATE farm_private.invitations AS i SET user_id=p_user_id,encrypted_invite=p_encrypted_invite,issue_state='ready' WHERE i.id=p_id;
 INSERT INTO farm_private.security_events(event_type,outcome,target_id) VALUES('first_admin_invite','prepared',p_id);
 RETURN true;
END $$;

CREATE FUNCTION public.farm_bootstrap_progress(p_id uuid,p_owner uuid,p_encrypted_credentials text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.invitations;
BEGIN
 IF p_encrypted_credentials IS NULL OR length(p_encrypted_credentials) NOT BETWEEN 1 AND 40000 THEN RAISE EXCEPTION 'Invalid encrypted progress.'; END IF;
 v_row:=farm_private.bootstrap_pending(p_id);
 IF v_row.id IS NULL OR p_owner IS NULL OR v_row.lease_owner IS DISTINCT FROM p_owner OR v_row.lease_phase IS DISTINCT FROM 'accept'
  OR v_row.lease_until IS NULL OR v_row.lease_until<=clock_timestamp() OR v_row.issue_state<>'ready' THEN RETURN false; END IF;
 UPDATE farm_private.invitations AS i SET encrypted_credentials=p_encrypted_credentials,credentials_generation=i.generation,provider_cleanup_pending=true WHERE i.id=p_id;
 RETURN true;
END $$;

CREATE FUNCTION public.farm_bootstrap_activate(p_id uuid,p_owner uuid,p_nonce_hash text,p_generation integer,p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.invitations;
BEGIN
 v_row:=farm_private.bootstrap_pending(p_id);
 IF v_row.id IS NULL OR p_owner IS NULL OR v_row.lease_owner IS DISTINCT FROM p_owner OR v_row.lease_phase IS DISTINCT FROM 'accept'
  OR v_row.lease_until IS NULL OR v_row.lease_until<=clock_timestamp() OR v_row.nonce_hash IS DISTINCT FROM p_nonce_hash OR v_row.generation IS DISTINCT FROM p_generation
  OR v_row.user_id IS DISTINCT FROM p_user_id OR v_row.issue_state<>'ready' OR v_row.encrypted_credentials IS NULL THEN RETURN false; END IF;
 -- Server code must also verify identity/password via Auth; SQL independently checks recipient and password presence.
 IF NOT EXISTS(SELECT 1 FROM auth.users AS u WHERE u.id=p_user_id AND lower(u.email)=v_row.recipient_email
  AND u.email_confirmed_at IS NOT NULL AND coalesce(length(u.encrypted_password),0)>0) THEN RETURN false; END IF;
 UPDATE farm_private.memberships AS m SET state='active',updated_at=clock_timestamp() WHERE m.user_id=p_user_id AND m.state='pending';
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE farm_private.invitations AS i SET state='accepted',encrypted_nonce=NULL,encrypted_invite=NULL,
  lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(p_user_id,'first_admin_activate','accepted',p_id);
 RETURN true;
END $$;

CREATE FUNCTION public.farm_bootstrap_release(p_id uuid,p_owner uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE farm_private.invitations AS i SET issue_state=CASE WHEN i.issue_state='issuing' THEN 'review' ELSE i.issue_state END,
  lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id AND i.invited_by IS NULL AND i.lease_owner=p_owner;
$$;

CREATE FUNCTION public.farm_bootstrap_cancel(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.invitations;
BEGIN
 v_row:=farm_private.bootstrap_pending(p_id);
 IF v_row.id IS NULL OR v_row.lease_until>clock_timestamp() THEN RETURN false; END IF;
 UPDATE farm_private.invitations AS i SET state='cancelled',generation=i.generation+1,encrypted_nonce=NULL,encrypted_invite=NULL,
  lease_owner=NULL,lease_until=NULL,lease_phase=NULL WHERE i.id=p_id;
 INSERT INTO farm_private.security_events(event_type,outcome,target_id) VALUES('first_admin_invite','cancelled',p_id);
 RETURN true;
END $$;

CREATE FUNCTION public.farm_bootstrap_cleanup_done(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE farm_private.invitations AS i SET provider_cleanup_pending=false,encrypted_credentials=NULL,credentials_generation=NULL
 WHERE i.id=p_id AND i.invited_by IS NULL
  AND (i.state IN('accepted','cancelled','expired') OR i.expires_at<=clock_timestamp());
$$;

REVOKE ALL ON FUNCTION public.farm_bootstrap_prepare(text,text,text),public.farm_bootstrap_read(uuid),
 public.farm_bootstrap_claim(uuid,uuid,text,text),public.farm_bootstrap_issue_finish(uuid,uuid,uuid,text),
 public.farm_bootstrap_progress(uuid,uuid,text),public.farm_bootstrap_activate(uuid,uuid,text,integer,uuid),
 public.farm_bootstrap_release(uuid,uuid),public.farm_bootstrap_cancel(uuid),public.farm_bootstrap_cleanup_done(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.farm_bootstrap_prepare(text,text,text),public.farm_bootstrap_read(uuid),
 public.farm_bootstrap_claim(uuid,uuid,text,text),public.farm_bootstrap_issue_finish(uuid,uuid,uuid,text),
 public.farm_bootstrap_progress(uuid,uuid,text),public.farm_bootstrap_activate(uuid,uuid,text,integer,uuid),
 public.farm_bootstrap_release(uuid,uuid),public.farm_bootstrap_cancel(uuid),public.farm_bootstrap_cleanup_done(uuid)
 TO service_role;
INSERT INTO farm_private.schema_migrations(version) VALUES('202610160003_first_admin');
NOTIFY pgrst,'reload schema';
COMMIT;
