-- Read-only preflight. Run only in ohajiugwo-development, not another project.
-- Does not read passwords, token values, user identities or photograph contents.
BEGIN TRANSACTION READ ONLY;
SELECT
  EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'farm_private') AS farm_private_schema_exists,
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS public_table_count,
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'farm_%') AS existing_farm_table_count,
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity) AS public_tables_without_rls;
SELECT
  count(*) AS bucket_count,
  count(*) FILTER (WHERE public) AS public_bucket_count,
  count(*) FILTER (WHERE id = 'farm-photographs') AS proposed_photo_bucket_exists
FROM storage.buckets;
SELECT count(*) AS existing_auth_identity_count FROM auth.users;
ROLLBACK;
