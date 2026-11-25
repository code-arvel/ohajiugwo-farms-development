-- NOT FOR HOSTED EXECUTION UNTIL SEPARATE EXPLICIT OWNER APPROVAL.
-- Owner/postgres in ohajiugwo-development ONLY. Entire file, no partial selection.
-- APPLY: attempts targeted session deletions inside a transaction ending COMMIT.
-- Bound to four reviewed revoked sessions and fingerprint 1a49ce8c97170f12cdce3b199a043dfc.
-- Not a migration. Do not replace the checksum/count or weaken guards.
-- If ANY error occurs: run ROLLBACK alone; do not run a trailing PASS by itself.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
SET LOCAL search_path=pg_catalog,pg_temp;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140011_cleanup_review_inspection') THEN
  RAISE EXCEPTION 'Verified migration 011 is required; stop.';
 END IF;
 IF NOT has_table_privilege(current_user,'auth.sessions','DELETE') THEN
  RAISE EXCEPTION 'Owner session-deletion permission required; do not grant new permissions.';
 END IF;
END $$;

-- No credentials are copied into these transient review tables.
CREATE TEMP TABLE farm_reviewed_recovery_targets ON COMMIT DROP AS
 SELECT j.id AS job_id,j.source_id,j.source_fingerprint,s.user_id,s.provider_session_id
 FROM farm_private.cleanup_jobs AS j
 LEFT JOIN farm_private.sessions AS s ON s.id=j.source_id
 WHERE j.source_kind='session' AND j.state='review';

DO $$
DECLARE
 v_expected constant text:='1a49ce8c97170f12cdce3b199a043dfc';
 v_fingerprint text;v_count bigint;v_table oid;v_graph oid[];v_locked_graph oid[];
BEGIN
 SELECT md5(coalesce(string_agg(concat_ws(':',job_id::text,source_id::text,source_fingerprint,user_id::text,provider_session_id),'|' ORDER BY job_id),'empty'))
 INTO v_fingerprint FROM pg_temp.farm_reviewed_recovery_targets;
 IF v_fingerprint IS DISTINCT FROM v_expected OR (SELECT count(*) FROM pg_temp.farm_reviewed_recovery_targets)<>4 THEN
  RAISE EXCEPTION 'Reviewed batch fingerprint/count changed; stop and repeat read-only inspection.';
 END IF;
 IF (SELECT count(DISTINCT provider_session_id) FROM pg_temp.farm_reviewed_recovery_targets)<>4 OR
    EXISTS(SELECT 1 FROM pg_temp.farm_reviewed_recovery_targets WHERE provider_session_id IS NULL OR provider_session_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') THEN
  RAISE EXCEPTION 'Four distinct valid provider sessions required.';
 END IF;
 -- Match the cleanup worker's source-before-job lock order. No waits behind live work.
 PERFORM s.id FROM farm_private.sessions AS s
 JOIN pg_temp.farm_reviewed_recovery_targets AS t ON t.source_id=s.id
 ORDER BY s.id FOR UPDATE OF s NOWAIT;
 PERFORM j.id FROM farm_private.cleanup_jobs AS j
 JOIN pg_temp.farm_reviewed_recovery_targets AS t ON t.job_id=j.id
 ORDER BY j.id FOR UPDATE OF j NOWAIT;

 SELECT count(*) INTO v_count FROM pg_temp.farm_reviewed_recovery_targets AS t
 JOIN farm_private.cleanup_jobs AS j ON j.id=t.job_id
 JOIN farm_private.sessions AS s ON s.id=t.source_id
 WHERE j.source_kind='session' AND j.state='review' AND j.source_id=t.source_id
   AND j.source_fingerprint=t.source_fingerprint AND j.owner IS NULL AND j.lease_until IS NULL AND j.completed_tokens=0
   AND s.revoked_at IS NOT NULL AND s.provider_cleanup_pending AND s.reauth_until IS NULL
   AND s.refresh_owner IS NULL AND s.refresh_until IS NULL
   AND s.user_id=t.user_id AND s.provider_session_id=t.provider_session_id
   AND s.encrypted_credentials<>'' AND md5(s.encrypted_credentials)=t.source_fingerprint
   AND j.encrypted_credentials=s.encrypted_credentials AND j.aad=s.cookie_hash;
 IF v_count<>4 THEN RAISE EXCEPTION 'Revoked-source eligibility, credentials or lease changed; stop.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.sessions AS s WHERE s.revoked_at IS NULL
    AND s.provider_session_id IN(SELECT provider_session_id FROM pg_temp.farm_reviewed_recovery_targets)) THEN
  RAISE EXCEPTION 'Active application session conflict; stop.';
 END IF;

 -- Retain relation locks against trigger/constraint changes through this transaction.
 -- ROW EXCLUSIVE is compatible with ordinary unrelated session writes.
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
 PERFORM a.id FROM auth.sessions AS a
 JOIN pg_temp.farm_reviewed_recovery_targets AS t ON a.id::text=t.provider_session_id
 ORDER BY a.id FOR UPDATE OF a NOWAIT;
 SELECT count(*) INTO v_count FROM auth.sessions AS a
 JOIN pg_temp.farm_reviewed_recovery_targets AS t ON a.id::text=t.provider_session_id AND a.user_id=t.user_id;
 IF v_count<>4 THEN RAISE EXCEPTION 'Provider session identity/count changed; stop.';END IF;
END $$;

-- Preserve existing unrelated sign-ins; metadata/refresh activity may continue normally.
CREATE TEMP TABLE farm_recovery_protected_sessions ON COMMIT DROP AS
 SELECT a.id FROM auth.sessions AS a
 WHERE NOT EXISTS(SELECT 1 FROM pg_temp.farm_reviewed_recovery_targets AS t WHERE a.id::text=t.provider_session_id);

DO $$
DECLARE v_count bigint;
BEGIN
 DELETE FROM auth.sessions AS a USING pg_temp.farm_reviewed_recovery_targets AS t
 WHERE a.id::text=t.provider_session_id AND a.user_id=t.user_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>4 THEN RAISE EXCEPTION 'Provider deletion count changed; entire transaction must roll back.';END IF;
 IF EXISTS(SELECT 1 FROM auth.sessions AS a JOIN pg_temp.farm_reviewed_recovery_targets AS t ON a.id::text=t.provider_session_id) OR
    EXISTS(SELECT 1 FROM auth.refresh_tokens AS r JOIN pg_temp.farm_reviewed_recovery_targets AS t ON r.session_id::text=t.provider_session_id) THEN
  RAISE EXCEPTION 'Provider session/refresh-token removal not confirmed; roll back.';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.farm_recovery_protected_sessions AS p WHERE NOT EXISTS(SELECT 1 FROM auth.sessions AS a WHERE a.id=p.id)) THEN
  RAISE EXCEPTION 'Unrelated provider session changed; roll back and inspect.';
 END IF;
 -- Provider absence is established before either credential copy is disposed.
 UPDATE farm_private.sessions AS s SET provider_cleanup_pending=false,encrypted_credentials=''
 FROM pg_temp.farm_reviewed_recovery_targets AS t
 WHERE s.id=t.source_id AND s.revoked_at IS NOT NULL AND s.provider_cleanup_pending
   AND md5(s.encrypted_credentials)=t.source_fingerprint AND s.reauth_until IS NULL
   AND s.refresh_owner IS NULL AND s.refresh_until IS NULL;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>4 THEN RAISE EXCEPTION 'Source acknowledgement changed; roll back.';END IF;
 UPDATE farm_private.cleanup_jobs AS j SET state='done',completed_tokens=1,encrypted_credentials='',owner=NULL,lease_until=NULL
 FROM pg_temp.farm_reviewed_recovery_targets AS t
 WHERE j.id=t.job_id AND j.source_kind='session' AND j.state='review'
   AND j.source_id=t.source_id AND j.source_fingerprint=t.source_fingerprint
   AND j.owner IS NULL AND j.lease_until IS NULL AND j.completed_tokens=0;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>4 THEN RAISE EXCEPTION 'Cleanup acknowledgement changed; roll back.';END IF;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id)
 SELECT NULL,'cleanup_session_recovery','provider_revoked:batch:1a49ce8c97170f12cdce3b199a043dfc',job_id
 FROM pg_temp.farm_reviewed_recovery_targets;
 SELECT count(*) INTO v_count FROM pg_temp.farm_reviewed_recovery_targets AS t
 JOIN farm_private.sessions AS s ON s.id=t.source_id
 JOIN farm_private.cleanup_jobs AS j ON j.id=t.job_id
 WHERE s.revoked_at IS NOT NULL AND NOT s.provider_cleanup_pending AND s.encrypted_credentials=''
   AND j.state='done' AND j.completed_tokens=1 AND j.encrypted_credentials='';
 IF v_count<>4 THEN RAISE EXCEPTION 'Final cleanup state not confirmed; roll back.';END IF;
END $$;

COMMIT;
SELECT 'PASS: exact four-session recovery committed; unrelated sign-ins protected. This is not a permanent worker fix.' AS result;
