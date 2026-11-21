-- Owner/postgres only in ohajiugwo-development. Read-only counts; no credentials or IDs.
-- Run after migration 011's entire rollback verification has passed.
SELECT
 count(*) AS review_jobs,
 count(*) FILTER (WHERE s.revoked_at IS NOT NULL) AS revoked_app_sessions,
 count(*) FILTER (
  WHERE s.id IS NOT NULL
    AND md5(s.encrypted_credentials) = j.source_fingerprint
 ) AS matching_sources,
 count(*) FILTER (
  WHERE EXISTS (
   SELECT 1 FROM auth.sessions AS a
   WHERE a.id::text = s.provider_session_id
  )
 ) AS provider_sessions_present,
 count(*) FILTER (WHERE s.id IS NULL) AS missing_sources
FROM farm_private.cleanup_jobs AS j
LEFT JOIN farm_private.sessions AS s ON s.id = j.source_id
WHERE j.source_kind = 'session' AND j.state = 'review';
