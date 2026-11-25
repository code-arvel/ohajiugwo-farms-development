-- Prepared locally only. Guarded expired-token cleanup; does not execute cleanup on application.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210014_retention_execution') THEN RAISE EXCEPTION 'Migration 014 required.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611250015_session_reconciliation') THEN RAISE EXCEPTION 'Migration 015 already applied; do not rerun.';END IF;
 IF NOT has_table_privilege(current_user,'auth.sessions','DELETE') THEN RAISE EXCEPTION 'Owner session deletion privilege required; do not grant new privileges.';END IF;
END $$;
CREATE FUNCTION farm_private.require_session_cleanup_schema() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_table oid;v_graph oid[];v_locked_graph oid[];
BEGIN
 LOCK TABLE auth.sessions IN ROW EXCLUSIVE MODE NOWAIT;
 IF NOT EXISTS(
  SELECT 1 FROM pg_constraint AS c
  JOIN pg_attribute AS a ON a.attrelid=c.conrelid AND a.attname='session_id'
  JOIN pg_attribute AS dest ON dest.attrelid=c.confrelid AND dest.attname='id'
  WHERE c.contype='f' AND c.convalidated AND c.confdeltype='c'
    AND c.conrelid=to_regclass('auth.refresh_tokens') AND c.confrelid=to_regclass('auth.sessions')
    AND c.conkey=ARRAY[a.attnum] AND c.confkey=ARRAY[dest.attnum]
 ) THEN RAISE EXCEPTION 'Validated refresh-token session cascade required; stop.';END IF;
 WITH RECURSIVE graph(relid) AS (
  SELECT 'auth.sessions'::regclass::oid
  UNION
  SELECT c.conrelid FROM pg_constraint AS c JOIN graph AS g ON c.confrelid=g.relid
  WHERE c.contype='f' AND c.confdeltype='c'
 ) SELECT array_agg(relid ORDER BY relid) INTO v_graph FROM graph;
 FOR v_table IN SELECT unnest(v_graph) ORDER BY 1 LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class AS c JOIN pg_namespace AS n ON n.oid=c.relnamespace
    WHERE c.oid=v_table AND n.nspname='auth' AND c.relkind='r' AND c.relname IN('sessions','refresh_tokens','mfa_amr_claims')) THEN
   RAISE EXCEPTION 'Unexpected cascade relation; stop for schema review.';
  END IF;
  EXECUTE format('LOCK TABLE %s IN ROW EXCLUSIVE MODE NOWAIT',v_table::regclass);
 END LOOP;
 WITH RECURSIVE graph(relid) AS (
  SELECT 'auth.sessions'::regclass::oid
  UNION SELECT c.conrelid FROM pg_constraint AS c JOIN graph AS g ON c.confrelid=g.relid
  WHERE c.contype='f' AND c.confdeltype='c'
 ) SELECT array_agg(relid ORDER BY relid) INTO v_locked_graph FROM graph;
 IF v_locked_graph IS DISTINCT FROM v_graph THEN RAISE EXCEPTION 'Cascade graph changed while locking; stop.';END IF;
 IF EXISTS(
  SELECT 1 FROM pg_constraint AS c
  WHERE c.contype='f' AND c.confdeltype='c' AND c.confrelid=ANY(v_graph)
  AND NOT (
   c.confrelid='auth.sessions'::regclass AND c.convalidated
   AND c.conrelid IN(SELECT x.oid FROM pg_class AS x JOIN pg_namespace AS n ON n.oid=x.relnamespace WHERE n.nspname='auth' AND x.relname IN('refresh_tokens','mfa_amr_claims'))
   AND c.conkey=ARRAY[(SELECT a.attnum FROM pg_attribute AS a WHERE a.attrelid=c.conrelid AND a.attname='session_id' AND NOT a.attisdropped)]
   AND c.confkey=ARRAY[(SELECT a.attnum FROM pg_attribute AS a WHERE a.attrelid=c.confrelid AND a.attname='id' AND NOT a.attisdropped)]
  )
 ) THEN RAISE EXCEPTION 'Unexpected cascade edge/column; stop for schema review.';END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=ANY(v_graph)
    AND NOT tgisinternal AND tgenabled<>'D' AND (tgtype & 8)<>0) THEN
  RAISE EXCEPTION 'Unexpected custom session/cascaded delete trigger; stop.';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=ANY(v_graph) AND ev_type='4') OR
    EXISTS(SELECT 1 FROM pg_constraint WHERE contype='f' AND confrelid=ANY(v_graph) AND confdeltype IN('n','d')) THEN
  RAISE EXCEPTION 'Unexpected delete rule or reference action; stop for schema review.';
 END IF;
END $$;
REVOKE ALL ON FUNCTION farm_private.require_session_cleanup_schema() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.farm_cleanup_session_reconcile(p_id uuid,p_owner uuid,p_user_id uuid,p_provider_session_id uuid,p_access_expires_at timestamptz) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_source_id uuid;v_source farm_private.sessions;v_job farm_private.cleanup_jobs;v_provider_user uuid;v_count integer;
BEGIN
 IF p_id IS NULL OR p_owner IS NULL OR p_user_id IS NULL OR p_provider_session_id IS NULL OR p_access_expires_at IS NULL
  OR NOT isfinite(p_access_expires_at) OR p_access_expires_at>clock_timestamp() THEN RETURN false;END IF;
 SELECT j.source_id INTO v_source_id FROM farm_private.cleanup_jobs AS j WHERE j.id=p_id AND j.source_kind='session';
 IF v_source_id IS NULL THEN RETURN false;END IF;
 -- Source-before-job lock order matches the queue and normal session mutation.
 SELECT s.* INTO v_source FROM farm_private.sessions AS s WHERE s.id=v_source_id FOR UPDATE NOWAIT;
 SELECT j.* INTO v_job FROM farm_private.cleanup_jobs AS j WHERE j.id=p_id FOR UPDATE NOWAIT;
 IF v_source.id IS NULL OR v_job.id IS NULL OR v_job.source_kind<>'session' OR v_job.source_id<>v_source.id
  OR v_source.user_id<>p_user_id OR v_source.provider_session_id<>p_provider_session_id::text
  OR v_source.revoked_at IS NULL OR v_source.reauth_until IS NOT NULL OR v_source.refresh_owner IS NOT NULL OR v_source.refresh_until IS NOT NULL THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM farm_private.sessions AS s WHERE s.provider_session_id=p_provider_session_id::text AND s.revoked_at IS NULL) THEN RETURN false;END IF;
 -- Lost-response replay may confirm observed absence but cannot mutate another job.
 IF v_job.state='done' THEN
  RETURN v_job.completed_tokens=1 AND v_job.encrypted_credentials='' AND v_source.encrypted_credentials='' AND NOT v_source.provider_cleanup_pending
   AND NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=p_provider_session_id)
   AND NOT EXISTS(SELECT 1 FROM auth.refresh_tokens WHERE session_id=p_provider_session_id);
 END IF;
 IF v_job.state<>'running' OR v_job.owner IS DISTINCT FROM p_owner OR v_job.lease_until IS NULL OR v_job.lease_until<=clock_timestamp()
  OR v_job.completed_tokens<>0 OR NOT v_source.provider_cleanup_pending OR v_source.encrypted_credentials=''
  OR md5(v_source.encrypted_credentials)<>v_job.source_fingerprint OR v_source.encrypted_credentials<>v_job.encrypted_credentials
  OR v_source.cookie_hash<>v_job.aad THEN RETURN false;END IF;
 PERFORM farm_private.require_session_cleanup_schema();
 SELECT a.user_id INTO v_provider_user FROM auth.sessions AS a WHERE a.id=p_provider_session_id FOR UPDATE NOWAIT;
 IF FOUND THEN
  IF v_provider_user IS DISTINCT FROM v_source.user_id THEN RETURN false;END IF;
  DELETE FROM auth.sessions WHERE id=p_provider_session_id AND user_id=v_source.user_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'Provider deletion count changed; roll back.';END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM auth.sessions WHERE id=p_provider_session_id) OR EXISTS(SELECT 1 FROM auth.refresh_tokens WHERE session_id=p_provider_session_id) THEN RAISE EXCEPTION 'Provider absence not confirmed; roll back.';END IF;
 -- Do not acknowledge a lease that expired while validating schema/deleting rows.
 IF v_job.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Cleanup lease expired; roll back.';END IF;
 UPDATE farm_private.sessions SET provider_cleanup_pending=false,encrypted_credentials='' WHERE id=v_source.id;
 UPDATE farm_private.cleanup_jobs SET state='done',completed_tokens=1,encrypted_credentials='',owner=NULL,lease_until=NULL WHERE id=v_job.id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(NULL,'cleanup_session_reconciled','provider_absence_verified',v_job.id);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.farm_cleanup_session_reconcile(uuid,uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.farm_cleanup_session_reconcile(uuid,uuid,uuid,uuid,timestamptz) TO service_role;
INSERT INTO farm_private.schema_migrations(version) VALUES('202611250015_session_reconciliation');
NOTIFY pgrst,'reload schema';
COMMIT;
