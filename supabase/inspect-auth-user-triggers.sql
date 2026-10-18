-- Read-only standalone follow-up when the second prerequisite result tab was not visible.
-- Always returns one row: zero and [] explicitly mean no noninternal auth.users triggers.
-- Names only; no trigger bodies, account data or credentials.
SELECT count(*) AS auth_user_trigger_count,
 COALESCE(jsonb_agg(jsonb_build_object(
  'trigger_name',t.tgname,
  'function_schema',n.nspname,
  'function_name',p.proname
 ) ORDER BY t.tgname),'[]'::jsonb) AS auth_user_triggers
FROM pg_catalog.pg_trigger AS t
JOIN pg_catalog.pg_proc AS p ON p.oid=t.tgfoid
JOIN pg_catalog.pg_namespace AS n ON n.oid=p.pronamespace
WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal;
