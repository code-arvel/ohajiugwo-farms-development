-- READ ONLY. Owner/postgres in ohajiugwo-development. Do not delete/requeue anything.
-- Results are counts/flags and a non-secret checksum binding the reviewed batch.
WITH review AS (
 SELECT j.id AS job_id,j.source_id,j.source_fingerprint,j.owner,j.lease_until,
        j.completed_tokens,s.id AS app_id,s.user_id,s.provider_session_id,
        s.revoked_at,s.provider_cleanup_pending,s.reauth_until,
        md5(s.encrypted_credentials)=j.source_fingerprint AS source_matches
 FROM farm_private.cleanup_jobs AS j
 LEFT JOIN farm_private.sessions AS s ON s.id=j.source_id
 WHERE j.source_kind='session' AND j.state='review'
)
SELECT check_name,result
FROM (VALUES
 (1,'review_jobs',(SELECT count(*) FROM review)::text),
 (2,'eligible_jobs',(SELECT count(*) FROM review WHERE app_id IS NOT NULL
    AND revoked_at IS NOT NULL AND provider_cleanup_pending AND source_matches
    AND reauth_until IS NULL AND owner IS NULL AND lease_until IS NULL
    AND completed_tokens=0)::text),
 (3,'distinct_provider_sessions',(SELECT count(DISTINCT provider_session_id) FROM review)::text),
 (4,'provider_identity_matches',(SELECT count(*) FROM review AS r
    JOIN auth.sessions AS a ON a.id::text=r.provider_session_id AND a.user_id=r.user_id)::text),
 (5,'active_app_session_conflicts',(SELECT count(*) FROM farm_private.sessions AS s
    WHERE s.revoked_at IS NULL AND s.provider_session_id IN (SELECT provider_session_id FROM review))::text),
 (6,'refresh_tokens_cascade',EXISTS(
    SELECT 1 FROM pg_constraint AS c
    JOIN pg_attribute AS a ON a.attrelid=c.conrelid AND a.attname='session_id'
    JOIN pg_attribute AS dest ON dest.attrelid=c.confrelid AND dest.attname='id'
    WHERE c.contype='f' AND c.convalidated AND c.confdeltype='c'
      AND c.conrelid=to_regclass('auth.refresh_tokens')
      AND c.confrelid=to_regclass('auth.sessions')
      AND c.conkey=ARRAY[a.attnum] AND c.confkey=ARRAY[dest.attnum]
 )::text),
 (7,'custom_session_delete_triggers',(SELECT count(*) FROM pg_trigger
    WHERE tgrelid=to_regclass('auth.sessions') AND NOT tgisinternal
      AND tgenabled<>'D' AND (tgtype & 8)<>0)::text),
 (8,'owner_can_delete_sessions',has_table_privilege(current_user,'auth.sessions','DELETE')::text),
 (9,'review_set_fingerprint',(SELECT md5(coalesce(string_agg(
    concat_ws(':',job_id::text,source_id::text,source_fingerprint,user_id::text,provider_session_id),
    '|' ORDER BY job_id),'empty')) FROM review))
) AS checks(position,check_name,result)
ORDER BY position;
