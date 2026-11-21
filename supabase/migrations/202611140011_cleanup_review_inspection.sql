-- Read-only maintainer inspection of session cleanup review. No row changes.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140010_content_conflict_status') THEN RAISE EXCEPTION 'Migration 010 is required.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140011_cleanup_review_inspection') THEN RAISE EXCEPTION 'Migration 011 already applied; do not rerun.';END IF;
END $$;
CREATE FUNCTION public.farm_cleanup_review_read(p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid review limit.';END IF;
 SELECT coalesce(jsonb_agg(v.payload ORDER BY v.created_at,v.id),'[]'::jsonb) INTO v_result
 FROM (
  SELECT j.id,j.created_at,jsonb_build_object(
   'id',j.id,'source_kind',j.source_kind,'state',j.state,
   'encrypted_credentials',j.encrypted_credentials,'aad',j.aad,
   'source_user_id',s.user_id,'provider_session_id',s.provider_session_id,
   'source_revoked',s.revoked_at IS NOT NULL,
   'source_matches',md5(s.encrypted_credentials)=j.source_fingerprint
  ) AS payload
  FROM farm_private.cleanup_jobs AS j
  LEFT JOIN farm_private.sessions AS s ON s.id=j.source_id
  WHERE j.source_kind='session' AND j.state='review'
  ORDER BY j.created_at,j.id LIMIT p_limit
 ) AS v;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.farm_cleanup_review_read(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.farm_cleanup_review_read(integer) TO service_role;
INSERT INTO farm_private.schema_migrations(version) VALUES('202611140011_cleanup_review_inspection');
NOTIFY pgrst,'reload schema';
COMMIT;
