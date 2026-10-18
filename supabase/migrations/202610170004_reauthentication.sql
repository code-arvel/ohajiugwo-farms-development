-- Additive Stage 2 password-confirmation commands. PREPARED ONLY: review before hosted execution.
-- No account/Auth/email calls, existing-row replacement, policy weakening or bootstrap enablement.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610160003_first_admin') THEN
  RAISE EXCEPTION 'Reviewed migration 003 is required.';
 END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170004_reauthentication') THEN
  RAISE EXCEPTION 'Reauthentication migration already applied. Do not rerun it.';
 END IF;
END $$;
ALTER TABLE farm_private.sessions ADD COLUMN reauth_parent uuid;
ALTER TABLE farm_private.sessions ADD COLUMN reauth_until timestamptz;

-- New credentials are staged REVOKED. Cleanup workers MUST skip reauth_until>clock_timestamp(),
-- and atomically abort/claim expired staging before calling provider cleanup.
-- The server MUST verify the password/recipient through Auth before activation.
-- Staging is revoked even if verification later fails; it grants no application access.
CREATE FUNCTION public.farm_session_reauth_prepare(
 p_old_cookie_hash text,p_user_id uuid,p_old_provider_session_id text,p_provider_session_id text,
 p_cookie_hash text,p_encrypted_credentials text,p_csrf_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old farm_private.sessions; v_new farm_private.sessions; v_now timestamptz;
BEGIN
 IF p_user_id IS NULL OR p_old_cookie_hash IS NULL OR p_old_cookie_hash!~'^[A-Za-z0-9_-]{43}$'
 OR p_cookie_hash IS NULL OR p_cookie_hash!~'^[A-Za-z0-9_-]{43}$' OR p_cookie_hash=p_old_cookie_hash
 OR p_csrf_hash IS NULL OR p_csrf_hash!~'^[A-Za-z0-9_-]{43}$'
 OR p_old_provider_session_id IS NULL OR p_old_provider_session_id!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 OR p_provider_session_id IS NULL OR p_provider_session_id!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 OR p_provider_session_id=p_old_provider_session_id
 OR p_encrypted_credentials IS NULL OR length(p_encrypted_credentials) NOT BETWEEN 1 AND 20000 THEN
  RAISE EXCEPTION 'Invalid password confirmation input.';
 END IF;
 -- Consistent order for lifecycle commands: membership, original session, staged session.
 PERFORM 1 FROM farm_private.memberships AS m WHERE m.user_id=p_user_id AND m.state='active' FOR SHARE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT s.* INTO v_old FROM farm_private.sessions AS s WHERE s.cookie_hash=p_old_cookie_hash FOR UPDATE;
 v_now:=clock_timestamp();
 IF NOT FOUND OR v_old.user_id<>p_user_id OR v_old.provider_session_id<>p_old_provider_session_id
 OR v_old.revoked_at IS NOT NULL OR v_old.idle_expires_at<=v_now OR v_old.absolute_expires_at<=v_now THEN RETURN NULL; END IF;
 INSERT INTO farm_private.sessions(user_id,provider_session_id,cookie_hash,encrypted_credentials,csrf_hash,
  created_at,idle_expires_at,absolute_expires_at,revoked_at,provider_cleanup_pending,reauth_parent,reauth_until)
 VALUES(p_user_id,p_provider_session_id,p_cookie_hash,p_encrypted_credentials,p_csrf_hash,
  v_old.created_at,v_old.idle_expires_at,v_old.absolute_expires_at,v_now,true,v_old.id,v_now+interval '60 seconds')
 RETURNING * INTO v_new;
 RETURN to_jsonb(v_new);
END $$;

CREATE FUNCTION public.farm_session_reauth_finish(p_old_cookie_hash text,p_cookie_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid; v_old farm_private.sessions; v_new farm_private.sessions; v_now timestamptz;
BEGIN
 SELECT s.user_id INTO v_user FROM farm_private.sessions AS s WHERE s.cookie_hash=p_old_cookie_hash;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM 1 FROM farm_private.memberships AS m WHERE m.user_id=v_user AND m.state='active' FOR SHARE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT s.* INTO v_old FROM farm_private.sessions AS s WHERE s.cookie_hash=p_old_cookie_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT s.* INTO v_new FROM farm_private.sessions AS s WHERE s.cookie_hash=p_cookie_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 -- Transaction-stable now() must not permit activation after waiting past a deadline.
 v_now:=clock_timestamp();
 IF v_old.revoked_at IS NOT NULL OR v_old.idle_expires_at<=v_now OR v_old.absolute_expires_at<=v_now
 OR v_new.user_id<>v_old.user_id OR v_new.reauth_parent IS DISTINCT FROM v_old.id
 OR v_new.reauth_until IS NULL OR v_new.reauth_until<=v_now OR v_new.revoked_at IS NULL
 OR NOT v_new.provider_cleanup_pending OR v_new.provider_session_id=v_old.provider_session_id
 OR v_new.absolute_expires_at<>v_old.absolute_expires_at THEN RETURN NULL; END IF;
 UPDATE farm_private.sessions AS s SET revoked_at=v_now,provider_cleanup_pending=true,refresh_owner=NULL,refresh_until=NULL
 WHERE s.id=v_old.id RETURNING s.* INTO v_old;
 UPDATE farm_private.sessions AS s SET revoked_at=NULL,reauth_until=NULL,provider_cleanup_pending=false,
 reauthenticated_at=v_now,last_seen_at=v_now,idle_expires_at=LEAST(v_now+interval '30 minutes',v_old.absolute_expires_at)
 WHERE s.id=v_new.id RETURNING s.* INTO v_new;
 RETURN jsonb_build_object('session',to_jsonb(v_new),'previous',to_jsonb(v_old));
END $$;

CREATE FUNCTION public.farm_session_reauth_abort(p_cookie_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.sessions;
BEGIN
 UPDATE farm_private.sessions AS s SET reauth_until=NULL
 WHERE s.cookie_hash=p_cookie_hash AND s.revoked_at IS NOT NULL AND s.reauth_until IS NOT NULL
 RETURNING s.* INTO v_row;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN to_jsonb(v_row);
END $$;

REVOKE ALL ON FUNCTION public.farm_session_reauth_prepare(text,uuid,text,text,text,text,text),
 public.farm_session_reauth_finish(text,text),public.farm_session_reauth_abort(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.farm_session_reauth_prepare(text,uuid,text,text,text,text,text),
 public.farm_session_reauth_finish(text,text),public.farm_session_reauth_abort(text) TO service_role;
INSERT INTO farm_private.schema_migrations(version) VALUES('202610170004_reauthentication');
NOTIFY pgrst,'reload schema';
COMMIT;
