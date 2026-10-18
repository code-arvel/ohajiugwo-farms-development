-- Stage 2 service-only session/abuse/bootstrap-reservation commands.
-- Run after 202610160001. No accounts created, no email sent, no publication.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610160001_security_foundation') THEN
  RAISE EXCEPTION 'Apply the reviewed foundation first.';
 END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610160002_session_commands') THEN
  RAISE EXCEPTION 'Session migration already applied. Do not rerun it.';
 END IF;
END $$;
ALTER TABLE farm_private.sessions ADD COLUMN refresh_owner uuid;
ALTER TABLE farm_private.sessions ADD COLUMN refresh_until timestamptz;
ALTER TABLE farm_private.sessions ADD COLUMN refresh_version integer NOT NULL DEFAULT 0;
ALTER TABLE farm_private.sessions ADD COLUMN provider_cleanup_pending boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.farm_session_open(p_user_id uuid,p_provider_session_id text,p_cookie_hash text,p_encrypted_credentials text,p_csrf_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result farm_private.sessions;
BEGIN
 IF p_provider_session_id IS NULL OR p_provider_session_id!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 OR p_cookie_hash IS NULL OR p_cookie_hash!~'^[A-Za-z0-9_-]{43}$'
 OR p_csrf_hash IS NULL OR p_csrf_hash!~'^[A-Za-z0-9_-]{43}$'
 OR p_encrypted_credentials IS NULL OR length(p_encrypted_credentials) NOT BETWEEN 1 AND 20000 THEN
  RAISE EXCEPTION 'Invalid session input.';
 END IF;
 PERFORM 1 FROM farm_private.memberships WHERE user_id=p_user_id AND state='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active administrator required.'; END IF;
 INSERT INTO farm_private.sessions(user_id,provider_session_id,cookie_hash,encrypted_credentials,csrf_hash,idle_expires_at,absolute_expires_at,reauthenticated_at)
 VALUES(p_user_id,p_provider_session_id,p_cookie_hash,p_encrypted_credentials,p_csrf_hash,now()+interval '30 minutes',now()+interval '12 hours',now()) RETURNING * INTO result;
 RETURN to_jsonb(result);
END $$;
CREATE FUNCTION public.farm_session_read(p_cookie_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result farm_private.sessions;
BEGIN
 UPDATE farm_private.sessions s SET last_seen_at=now(),idle_expires_at=LEAST(now()+interval '30 minutes',s.absolute_expires_at)
 WHERE s.cookie_hash=p_cookie_hash AND s.revoked_at IS NULL
 AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
 AND EXISTS(SELECT 1 FROM farm_private.memberships m WHERE m.user_id=s.user_id AND m.state='active')
 RETURNING s.* INTO result;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN to_jsonb(result);
END $$;
CREATE FUNCTION public.farm_session_close(p_cookie_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result farm_private.sessions;
BEGIN
 UPDATE farm_private.sessions SET revoked_at=now(),provider_cleanup_pending=true,refresh_owner=NULL,refresh_until=NULL
 WHERE cookie_hash=p_cookie_hash AND revoked_at IS NULL RETURNING * INTO result;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN to_jsonb(result);
END $$;
CREATE FUNCTION public.farm_session_cleanup_done(p_session_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE farm_private.sessions SET provider_cleanup_pending=false WHERE id=p_session_id AND revoked_at IS NOT NULL;
$$;
-- DB lease prevents concurrent refresh-token use across processes/Functions.
CREATE FUNCTION public.farm_session_refresh_claim(p_cookie_hash text,p_owner uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result farm_private.sessions;
BEGIN
 IF p_owner IS NULL THEN RAISE EXCEPTION 'Missing refresh owner.'; END IF;
 UPDATE farm_private.sessions s SET refresh_owner=p_owner,refresh_until=now()+interval '30 seconds'
 WHERE s.cookie_hash=p_cookie_hash AND s.revoked_at IS NULL
 AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
 AND (s.refresh_until IS NULL OR s.refresh_until<=now())
 AND EXISTS(SELECT 1 FROM farm_private.memberships m WHERE m.user_id=s.user_id AND m.state='active')
 RETURNING s.* INTO result;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN to_jsonb(result);
END $$;
CREATE FUNCTION public.farm_session_refresh_finish(p_cookie_hash text,p_owner uuid,p_version integer,p_encrypted_credentials text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_encrypted_credentials IS NULL OR length(p_encrypted_credentials) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Invalid encrypted session.'; END IF;
 UPDATE farm_private.sessions s SET encrypted_credentials=p_encrypted_credentials,refresh_version=refresh_version+1,refresh_owner=NULL,refresh_until=NULL
 WHERE s.cookie_hash=p_cookie_hash AND s.refresh_owner=p_owner AND s.refresh_version=p_version AND s.refresh_until>now()
 AND s.revoked_at IS NULL AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
 AND EXISTS(SELECT 1 FROM farm_private.memberships m WHERE m.user_id=s.user_id AND m.state='active');
 RETURN FOUND;
END $$;
CREATE FUNCTION public.farm_session_refresh_release(p_cookie_hash text,p_owner uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE farm_private.sessions SET refresh_owner=NULL,refresh_until=NULL WHERE cookie_hash=p_cookie_hash AND refresh_owner=p_owner;
$$;
CREATE FUNCTION public.farm_auth_attempt(p_scope_hash text,p_limit integer,p_window_seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE attempts_now integer;
BEGIN
 IF p_scope_hash IS NULL OR p_scope_hash!~'^[A-Za-z0-9_-]{43}$' OR p_limit IS NULL OR p_window_seconds IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_window_seconds NOT BETWEEN 60 AND 86400 THEN
  RAISE EXCEPTION 'Invalid rate-limit scope.';
 END IF;
 INSERT INTO farm_private.auth_attempts(scope_hash,window_start,attempts) VALUES(p_scope_hash,now(),1)
 ON CONFLICT(scope_hash) DO UPDATE SET
  attempts=CASE WHEN farm_private.auth_attempts.window_start<=now()-make_interval(secs=>p_window_seconds) THEN 1 ELSE LEAST(farm_private.auth_attempts.attempts+1,1000000) END,
  window_start=CASE WHEN farm_private.auth_attempts.window_start<=now()-make_interval(secs=>p_window_seconds) THEN now() ELSE farm_private.auth_attempts.window_start END
 RETURNING attempts INTO attempts_now;
 RETURN attempts_now<=p_limit;
END $$;
-- Maintainer-only reservation; no application bootstrap route. It sends no email.
CREATE FUNCTION public.farm_bootstrap_reserve(p_email text,p_nonce_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result farm_private.invitations; active_admins integer;
BEGIN
 IF p_email IS NULL OR p_email<>lower(btrim(p_email)) OR length(p_email)>254 OR p_email!~'^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$'
 OR p_nonce_hash IS NULL OR p_nonce_hash!~'^[A-Za-z0-9_-]{43}$' THEN RAISE EXCEPTION 'Invalid bootstrap reservation.'; END IF;
 SELECT active_count INTO active_admins FROM farm_private.admin_guard WHERE singleton FOR UPDATE;
 IF active_admins IS NULL OR active_admins<>0 THEN RAISE EXCEPTION 'First administrator setup is closed.'; END IF;
 UPDATE farm_private.invitations SET state='expired' WHERE invited_by IS NULL AND state IN('queued','sent') AND expires_at<=now();
 IF EXISTS(SELECT 1 FROM farm_private.invitations WHERE invited_by IS NULL AND state IN('queued','sent')) THEN
  RAISE EXCEPTION 'A first-administrator invitation is already pending; inspect it before retrying.';
 END IF;
 INSERT INTO farm_private.invitations(recipient_email,state,nonce_hash,expires_at)
 VALUES(p_email,'queued',p_nonce_hash,now()+interval '24 hours') RETURNING * INTO result;
 RETURN jsonb_build_object('id',result.id,'state',result.state,'expires_at',result.expires_at);
END $$;
-- Enumerated signatures: never grant these commands to anonymous/authenticated roles.
REVOKE ALL ON FUNCTION public.farm_session_open(uuid,text,text,text,text),public.farm_session_read(text),public.farm_session_close(text),
 public.farm_session_cleanup_done(uuid),public.farm_session_refresh_claim(text,uuid),public.farm_session_refresh_finish(text,uuid,integer,text),
 public.farm_session_refresh_release(text,uuid),public.farm_auth_attempt(text,integer,integer),public.farm_bootstrap_reserve(text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.farm_session_open(uuid,text,text,text,text),public.farm_session_read(text),public.farm_session_close(text),
 public.farm_session_cleanup_done(uuid),public.farm_session_refresh_claim(text,uuid),public.farm_session_refresh_finish(text,uuid,integer,text),
 public.farm_session_refresh_release(text,uuid),public.farm_auth_attempt(text,integer,integer),public.farm_bootstrap_reserve(text,text)
 TO service_role;
INSERT INTO farm_private.schema_migrations(version) VALUES('202610160002_session_commands');
NOTIFY pgrst,'reload schema';
COMMIT;
