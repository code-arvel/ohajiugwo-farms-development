-- READ ONLY, owner/postgres in ohajiugwo-development. Counts only.
-- Run after separately approved recovery; never infer completion from a static PASS.
WITH recovered AS (
 SELECT DISTINCT j.id,j.source_id,j.state,j.completed_tokens,j.encrypted_credentials,
        s.revoked_at,s.provider_cleanup_pending,s.encrypted_credentials AS source_credentials,
        s.provider_session_id
 FROM farm_private.security_events AS e
 JOIN farm_private.cleanup_jobs AS j ON j.id=e.target_id AND j.source_kind='session'
 JOIN farm_private.sessions AS s ON s.id=j.source_id
 WHERE e.event_type='cleanup_session_recovery'
   AND e.outcome='provider_revoked:batch:1a49ce8c97170f12cdce3b199a043dfc'
)
SELECT check_name,result FROM (VALUES
 (1,'audited_recovered_jobs',(SELECT count(*) FROM recovered)),
 (2,'completed_jobs',(SELECT count(*) FROM recovered WHERE state='done' AND completed_tokens=1 AND encrypted_credentials='')),
 (3,'cleared_revoked_app_sessions',(SELECT count(*) FROM recovered WHERE revoked_at IS NOT NULL AND NOT provider_cleanup_pending AND source_credentials='')),
 (4,'provider_sessions_remaining',(SELECT count(*) FROM auth.sessions AS a JOIN recovered AS r ON a.id::text=r.provider_session_id)),
 (5,'refresh_tokens_remaining',(SELECT count(*) FROM auth.refresh_tokens AS t JOIN recovered AS r ON t.session_id::text=r.provider_session_id)),
 (6,'session_review_jobs_remaining',(SELECT count(*) FROM farm_private.cleanup_jobs WHERE source_kind='session' AND state='review'))
) AS checks(position,check_name,result) ORDER BY position;
