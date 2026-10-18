-- Read-only prerequisite for applying NEW migration 004, not a rerun of previous tests.
SELECT
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610160003_first_admin') AS migration_003_present,
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170004_reauthentication') AS migration_004_present,
 (SELECT count(*) FROM information_schema.columns WHERE table_schema='farm_private' AND table_name='sessions' AND column_name IN('reauth_parent','reauth_until')) AS reauth_columns,
 (SELECT count(*) FROM pg_catalog.pg_proc AS p JOIN pg_catalog.pg_namespace AS n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('farm_session_reauth_prepare','farm_session_reauth_finish','farm_session_reauth_abort')) AS reauth_functions;
-- Names only: do not paste trigger function bodies, which may contain unrelated private settings.
SELECT t.tgname AS trigger_name,n.nspname AS function_schema,p.proname AS function_name
FROM pg_catalog.pg_trigger AS t JOIN pg_catalog.pg_proc AS p ON p.oid=t.tgfoid
JOIN pg_catalog.pg_namespace AS n ON n.oid=p.pronamespace
WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal;
