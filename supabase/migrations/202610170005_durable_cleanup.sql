-- NEW migration, prepared locally; never rerun 001–004. No provider/mail calls.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170004_reauthentication') THEN RAISE EXCEPTION 'Migration 004 is required.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170005_durable_cleanup') THEN RAISE EXCEPTION 'Migration 005 already applied; do not rerun.';END IF;
END $$;
CREATE TABLE farm_private.provider_effects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),scope_hash text NOT NULL CHECK(scope_hash~'^[A-Za-z0-9_-]{43}$'),
 operation text NOT NULL CHECK(operation IN('login','reauthenticate','invite_verify','invite_refresh','password_proof','reset_verify','reset_refresh','reset_proof','invite_issue','reset_issue')),
 owner uuid NOT NULL,lease_until timestamptz NOT NULL,state text NOT NULL DEFAULT 'started' CHECK(state IN('started','captured','attached','cleanup','review','done')),
 encrypted_context text NOT NULL,encrypted_credentials text,source_kind text,source_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX farm_effect_unresolved ON farm_private.provider_effects(scope_hash,operation) WHERE state IN('started','captured','review');
CREATE TABLE farm_private.cleanup_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_kind text NOT NULL CHECK(source_kind IN('session','invitation','effect')),source_id uuid NOT NULL,
 encrypted_credentials text NOT NULL,aad text NOT NULL,source_fingerprint text NOT NULL,
 state text NOT NULL DEFAULT 'ready' CHECK(state IN('ready','running','retry','review','done')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),completed_tokens integer NOT NULL DEFAULT 0 CHECK(completed_tokens>=0),
 owner uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(source_kind,source_id)
);
ALTER TABLE farm_private.provider_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_private.cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON farm_private.provider_effects,farm_private.cleanup_jobs FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.farm_effect_begin(p_id uuid,p_scope_hash text,p_operation text,p_owner uuid,p_encrypted_context text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.provider_effects;
BEGIN
 IF p_id IS NULL OR p_encrypted_context IS NULL OR length(p_encrypted_context) NOT BETWEEN 1 AND 20000 OR p_owner IS NULL OR p_scope_hash IS NULL OR p_scope_hash!~'^[A-Za-z0-9_-]{43}$' OR p_operation IS NULL OR p_operation NOT IN('login','reauthenticate','invite_verify','invite_refresh','password_proof','reset_verify','reset_refresh','reset_proof','invite_issue','reset_issue') THEN RAISE EXCEPTION 'Invalid effect intent.';END IF;
 -- Expired unknown provider calls require reconciliation, never a blind second call.
 UPDATE farm_private.provider_effects AS e SET state='review' WHERE e.scope_hash=p_scope_hash AND e.operation=p_operation AND e.state='started' AND e.lease_until<=clock_timestamp();
 INSERT INTO farm_private.provider_effects(id,scope_hash,operation,owner,encrypted_context,lease_until) VALUES(p_id,p_scope_hash,p_operation,p_owner,p_encrypted_context,clock_timestamp()+interval '2 minutes') ON CONFLICT DO NOTHING RETURNING * INTO v_row;
 RETURN CASE WHEN v_row.id IS NULL THEN NULL ELSE to_jsonb(v_row) END;
END $$;
CREATE FUNCTION public.farm_effect_capture(p_id uuid,p_owner uuid,p_encrypted_credentials text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_encrypted_credentials IS NULL OR length(p_encrypted_credentials) NOT BETWEEN 1 AND 40000 THEN RETURN false;END IF;
 UPDATE farm_private.provider_effects AS e SET encrypted_credentials=p_encrypted_credentials,state='captured'
 WHERE e.id=p_id AND e.owner=p_owner AND e.state='started' AND e.lease_until>clock_timestamp();RETURN FOUND;
END $$;
CREATE FUNCTION public.farm_effect_release(p_id uuid,p_owner uuid,p_known_rejected boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE farm_private.provider_effects AS e SET state=CASE WHEN e.state='captured' THEN 'cleanup' WHEN p_known_rejected IS TRUE THEN 'done' ELSE 'review' END,
 lease_until=clock_timestamp() WHERE e.id=p_id AND e.owner=p_owner AND e.state IN('started','captured');RETURN FOUND;
END $$;
-- Only an acknowledged provider sign-out permits this explicit no-source completion.
CREATE FUNCTION public.farm_effect_cleaned(p_id uuid,p_owner uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE farm_private.provider_effects AS e SET state='done',encrypted_credentials=NULL WHERE e.id=p_id AND e.owner=p_owner AND e.state IN('started','captured','cleanup');RETURN FOUND;
END $$;
CREATE FUNCTION public.farm_effect_abort(p_id uuid,p_owner uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_effect farm_private.provider_effects;v_session farm_private.sessions;
BEGIN
 SELECT e.* INTO v_effect FROM farm_private.provider_effects AS e WHERE e.id=p_id FOR UPDATE;
 IF v_effect.id IS NULL OR v_effect.owner IS DISTINCT FROM p_owner THEN RETURN jsonb_build_object('safe',false);END IF;
 IF v_effect.state IN('started','captured','cleanup','review','done') THEN RETURN jsonb_build_object('safe',true);END IF;
 IF v_effect.state='attached' AND v_effect.source_kind='session' THEN
  SELECT s.* INTO v_session FROM farm_private.sessions AS s WHERE s.id=v_effect.source_id FOR UPDATE;
  IF v_session.id IS NULL THEN RETURN jsonb_build_object('safe',false);END IF;
  IF v_session.revoked_at IS NOT NULL AND v_session.encrypted_credentials='' THEN RETURN jsonb_build_object('safe',true,'cleaned',true);END IF;
  UPDATE farm_private.sessions AS s SET revoked_at=coalesce(s.revoked_at,clock_timestamp()),provider_cleanup_pending=true,reauth_until=NULL,refresh_owner=NULL,refresh_until=NULL
   WHERE s.id=v_session.id RETURNING s.* INTO v_session;
  RETURN jsonb_build_object('safe',true,'session',to_jsonb(v_session));
 END IF;
 RETURN jsonb_build_object('safe',false);
END $$;
-- Attachment is atomic with credential ownership transfer. No cleanup job may revoke a live owner.
CREATE FUNCTION public.farm_effect_session_open(p_effect_id uuid,p_owner uuid,p_user_id uuid,p_provider_session_id text,p_cookie_hash text,p_encrypted_credentials text,p_csrf_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_effect farm_private.provider_effects;v_row jsonb;
BEGIN
 SELECT e.* INTO v_effect FROM farm_private.provider_effects AS e WHERE e.id=p_effect_id FOR UPDATE;
 IF v_effect.id IS NULL OR v_effect.owner IS DISTINCT FROM p_owner OR v_effect.state<>'captured' OR v_effect.operation<>'login' OR v_effect.lease_until<=clock_timestamp() THEN RETURN NULL;END IF;
 v_row:=public.farm_session_open(p_user_id,p_provider_session_id,p_cookie_hash,p_encrypted_credentials,p_csrf_hash);
 IF v_row IS NULL THEN RETURN NULL;END IF;
 UPDATE farm_private.provider_effects AS e SET state='attached',source_kind='session',source_id=(v_row->>'id')::uuid,encrypted_credentials=NULL WHERE e.id=p_effect_id;RETURN v_row;
END $$;
CREATE FUNCTION public.farm_effect_session_stage(p_effect_id uuid,p_owner uuid,p_old_cookie_hash text,p_user_id uuid,p_old_provider_session_id text,p_provider_session_id text,p_cookie_hash text,p_encrypted_credentials text,p_csrf_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_effect farm_private.provider_effects;v_row jsonb;
BEGIN
 SELECT e.* INTO v_effect FROM farm_private.provider_effects AS e WHERE e.id=p_effect_id FOR UPDATE;
 IF v_effect.id IS NULL OR v_effect.owner IS DISTINCT FROM p_owner OR v_effect.state<>'captured' OR v_effect.operation<>'reauthenticate' OR v_effect.lease_until<=clock_timestamp() THEN RETURN NULL;END IF;
 v_row:=public.farm_session_reauth_prepare(p_old_cookie_hash,p_user_id,p_old_provider_session_id,p_provider_session_id,p_cookie_hash,p_encrypted_credentials,p_csrf_hash);
 IF v_row IS NULL THEN RETURN NULL;END IF;
 UPDATE farm_private.provider_effects AS e SET state='attached',source_kind='session',source_id=(v_row->>'id')::uuid,encrypted_credentials=NULL WHERE e.id=p_effect_id;RETURN v_row;
END $$;

CREATE FUNCTION public.farm_effect_bootstrap_progress(p_effect_id uuid,p_owner uuid,p_id uuid,p_invitation_owner uuid,p_encrypted_credentials text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_effect farm_private.provider_effects;
BEGIN
 SELECT e.* INTO v_effect FROM farm_private.provider_effects AS e WHERE e.id=p_effect_id FOR UPDATE;
 IF v_effect.id IS NULL OR v_effect.owner IS DISTINCT FROM p_owner OR v_effect.state<>'captured' OR v_effect.operation NOT IN('invite_verify','invite_refresh','password_proof') OR v_effect.lease_until<=clock_timestamp() THEN RETURN false;END IF;
 IF public.farm_bootstrap_progress(p_id,p_invitation_owner,p_encrypted_credentials) IS NOT TRUE THEN RETURN false;END IF;
 UPDATE farm_private.provider_effects AS e SET state='attached',source_kind='invitation',source_id=p_id,encrypted_credentials=NULL WHERE e.id=p_effect_id;RETURN true;
END $$;
CREATE FUNCTION public.farm_cleanup_session_ack(p_session_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE farm_private.sessions AS s SET provider_cleanup_pending=false,encrypted_credentials='' WHERE s.id=p_session_id AND s.revoked_at IS NOT NULL AND s.reauth_until IS NULL;RETURN FOUND;
END $$;
CREATE FUNCTION public.farm_cleanup_claim(p_owner uuid,p_limit integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session farm_private.sessions;v_invite farm_private.invitations;v_effect farm_private.provider_effects;v_job farm_private.cleanup_jobs;v_result jsonb:='[]';v_now timestamptz;
BEGIN
 IF p_owner IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid cleanup batch.';END IF;
 -- No waiting behind live mutations: source locks and job locks use SKIP LOCKED.
 FOR v_session IN SELECT s.* FROM farm_private.sessions AS s
 WHERE NOT EXISTS(SELECT 1 FROM farm_private.cleanup_jobs AS j WHERE j.source_kind='session' AND j.source_id=s.id) AND (s.reauth_until IS NULL OR s.reauth_until<=clock_timestamp()) AND
 ((s.revoked_at IS NOT NULL AND s.provider_cleanup_pending) OR (s.revoked_at IS NULL AND
 (s.idle_expires_at<=clock_timestamp() OR s.absolute_expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM farm_private.memberships AS m WHERE m.user_id=s.user_id AND m.state='active'))))
 ORDER BY s.created_at LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  v_now:=clock_timestamp();
  -- Atomically invalidates expired staging before any provider cleanup or delayed finish.
  UPDATE farm_private.sessions AS s SET revoked_at=coalesce(s.revoked_at,v_now),provider_cleanup_pending=true,reauth_until=NULL,refresh_owner=NULL,refresh_until=NULL WHERE s.id=v_session.id;
  INSERT INTO farm_private.cleanup_jobs(source_kind,source_id,encrypted_credentials,aad,source_fingerprint)
   VALUES('session',v_session.id,v_session.encrypted_credentials,v_session.cookie_hash,md5(v_session.encrypted_credentials)) ON CONFLICT DO NOTHING;
 END LOOP;
 FOR v_invite IN SELECT i.* FROM farm_private.invitations AS i WHERE NOT EXISTS(SELECT 1 FROM farm_private.cleanup_jobs AS j WHERE j.source_kind='invitation' AND j.source_id=i.id) AND i.provider_cleanup_pending AND i.encrypted_credentials IS NOT NULL
  AND (i.state IN('accepted','cancelled','expired') OR i.expires_at<=clock_timestamp())
  AND (i.lease_until IS NULL OR i.lease_until<=clock_timestamp()) ORDER BY i.created_at LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  UPDATE farm_private.invitations AS i SET state=CASE WHEN i.state IN('queued','sent') THEN 'expired' ELSE i.state END,lease_until=NULL,lease_owner=NULL,lease_phase=NULL WHERE i.id=v_invite.id;
  INSERT INTO farm_private.cleanup_jobs(source_kind,source_id,encrypted_credentials,aad,source_fingerprint)
   VALUES('invitation',v_invite.id,v_invite.encrypted_credentials,'first-admin:'||v_invite.id::text||':'||coalesce(v_invite.credentials_generation,0)::text,md5(v_invite.encrypted_credentials)) ON CONFLICT DO NOTHING;
 END LOOP;
 FOR v_effect IN SELECT e.* FROM farm_private.provider_effects AS e WHERE NOT EXISTS(SELECT 1 FROM farm_private.cleanup_jobs AS j WHERE j.source_kind='effect' AND j.source_id=e.id) AND e.state IN('started','captured','cleanup') AND e.lease_until<=clock_timestamp() ORDER BY e.created_at LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  IF v_effect.state='started' THEN UPDATE farm_private.provider_effects AS e SET state='review' WHERE e.id=v_effect.id;
  ELSE
   UPDATE farm_private.provider_effects AS e SET state='cleanup' WHERE e.id=v_effect.id;
   INSERT INTO farm_private.cleanup_jobs(source_kind,source_id,encrypted_credentials,aad,source_fingerprint)
    VALUES('effect',v_effect.id,v_effect.encrypted_credentials,'provider-effect:'||v_effect.id::text,md5(v_effect.encrypted_credentials)) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 UPDATE farm_private.cleanup_jobs AS j SET state='review',owner=NULL,lease_until=NULL WHERE j.attempts>=5 AND j.state IN('retry','running') AND (j.lease_until IS NULL OR j.lease_until<=clock_timestamp());
 FOR v_job IN SELECT j.* FROM farm_private.cleanup_jobs AS j WHERE j.attempts<5 AND j.next_attempt_at<=clock_timestamp()
  AND (j.state IN('ready','retry') OR (j.state='running' AND j.lease_until<=clock_timestamp())) ORDER BY j.created_at LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  UPDATE farm_private.cleanup_jobs AS j SET state='running',owner=p_owner,lease_until=clock_timestamp()+interval '60 seconds',attempts=j.attempts+1 WHERE j.id=v_job.id RETURNING * INTO v_job;
  v_result:=v_result||jsonb_build_array(to_jsonb(v_job));
 END LOOP;RETURN v_result;
END $$;
CREATE FUNCTION public.farm_cleanup_renew(p_id uuid,p_owner uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job farm_private.cleanup_jobs;
BEGIN
 SELECT j.* INTO v_job FROM farm_private.cleanup_jobs AS j WHERE j.id=p_id FOR UPDATE;
 IF v_job.id IS NULL OR v_job.owner IS DISTINCT FROM p_owner OR v_job.state<>'running' OR v_job.lease_until<=clock_timestamp() THEN RETURN false;END IF;
 UPDATE farm_private.cleanup_jobs AS j SET lease_until=clock_timestamp()+interval '60 seconds' WHERE j.id=p_id;RETURN true;
END $$;
CREATE FUNCTION public.farm_cleanup_progress(p_id uuid,p_owner uuid,p_completed integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job farm_private.cleanup_jobs;
BEGIN
 SELECT j.* INTO v_job FROM farm_private.cleanup_jobs AS j WHERE j.id=p_id FOR UPDATE;
 IF v_job.id IS NULL OR v_job.owner IS DISTINCT FROM p_owner OR v_job.state<>'running' OR v_job.lease_until<=clock_timestamp() OR p_completed IS NULL OR p_completed<>v_job.completed_tokens+1 OR p_completed>32 THEN RETURN false;END IF;
 UPDATE farm_private.cleanup_jobs AS j SET completed_tokens=p_completed WHERE j.id=p_id;RETURN true;
END $$;
CREATE FUNCTION public.farm_cleanup_finish(p_id uuid,p_owner uuid,p_outcome text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job farm_private.cleanup_jobs;v_requested text:=p_outcome;
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN('done','retry','review') THEN RETURN false;END IF;
 SELECT j.* INTO v_job FROM farm_private.cleanup_jobs AS j WHERE j.id=p_id FOR UPDATE;
 IF v_job.id IS NULL OR v_job.owner IS DISTINCT FROM p_owner OR v_job.state<>'running' OR v_job.lease_until<=clock_timestamp() THEN RETURN false;END IF;
 IF p_outcome='done' THEN
  IF v_job.source_kind='session' THEN
   UPDATE farm_private.sessions AS s SET provider_cleanup_pending=false,encrypted_credentials='' WHERE s.id=v_job.source_id AND s.revoked_at IS NOT NULL AND s.reauth_until IS NULL AND md5(s.encrypted_credentials)=v_job.source_fingerprint;
  ELSIF v_job.source_kind='invitation' THEN
   UPDATE farm_private.invitations AS i SET provider_cleanup_pending=false,encrypted_credentials=NULL,credentials_generation=NULL WHERE i.id=v_job.source_id AND i.state IN('accepted','cancelled','expired') AND (i.lease_until IS NULL OR i.lease_until<=clock_timestamp()) AND md5(i.encrypted_credentials)=v_job.source_fingerprint;
  ELSE
   UPDATE farm_private.provider_effects AS e SET state='done',encrypted_credentials=NULL WHERE e.id=v_job.source_id AND e.state='cleanup' AND md5(e.encrypted_credentials)=v_job.source_fingerprint;
  END IF;
  IF NOT FOUND THEN p_outcome:='review';END IF;
 END IF;
 UPDATE farm_private.cleanup_jobs AS j SET state=p_outcome,owner=NULL,lease_until=NULL,
 next_attempt_at=clock_timestamp()+make_interval(secs=>LEAST(3600,(30*power(2,j.attempts))::integer)),
 encrypted_credentials=CASE WHEN p_outcome='done' THEN '' ELSE j.encrypted_credentials END WHERE j.id=p_id;RETURN p_outcome=v_requested;
END $$;
-- New commands only; existing data, grants and security policies are unchanged.
DO $$ DECLARE v_proc regprocedure;BEGIN
 FOREACH v_proc IN ARRAY ARRAY[
 'public.farm_effect_begin(uuid,text,text,uuid,text)'::regprocedure,'public.farm_effect_capture(uuid,uuid,text)'::regprocedure,'public.farm_effect_release(uuid,uuid,boolean)'::regprocedure,'public.farm_effect_cleaned(uuid,uuid)'::regprocedure,'public.farm_effect_abort(uuid,uuid)'::regprocedure,'public.farm_effect_bootstrap_progress(uuid,uuid,uuid,uuid,text)'::regprocedure,'public.farm_cleanup_session_ack(uuid)'::regprocedure,
 'public.farm_effect_session_open(uuid,uuid,uuid,text,text,text,text)'::regprocedure,'public.farm_effect_session_stage(uuid,uuid,text,uuid,text,text,text,text,text)'::regprocedure,
 'public.farm_cleanup_claim(uuid,integer)'::regprocedure,'public.farm_cleanup_renew(uuid,uuid)'::regprocedure,'public.farm_cleanup_progress(uuid,uuid,integer)'::regprocedure,'public.farm_cleanup_finish(uuid,uuid,text)'::regprocedure] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',v_proc);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',v_proc);
 END LOOP;
END $$;
INSERT INTO farm_private.schema_migrations(version) VALUES('202610170005_durable_cleanup');NOTIFY pgrst,'reload schema';
COMMIT;
