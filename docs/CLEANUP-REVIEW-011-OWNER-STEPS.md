# Migration 011 — read-only cleanup review inspection

Prepared 14 November 2026. **21 November: owner applied 011 and whole rollback verification passed. Do not rerun 001–011.** Historical application instructions below remain a record, not a repeat instruction.

Current safe read-only HTTP diagnostic found four review jobs, all revoked app sessions with matching/decryptable identity data and expired-token rejections. No cleanup/recovery was performed. Owner subsequently confirmed review_jobs=4, revoked_app_sessions=4, matching_sources=4 and provider_sessions_present=4. Next run the entire `supabase/diagnostics/cleanup-recovery-preflight.sql` and report all nine vertical rows. It checks owner permissions, targeted-session eligibility, active-session conflicts and refresh-token cascade; no mutations. The non-secret batch fingerprint will bind a reviewed recovery to this exact set. Never select raw encrypted credentials or tokens into chat. Local diagnostic now supports both Supabase error response shapes; six focused tests passed. This does not prove provider sessions have been removed.

The owner diagnostic shows three session jobs under review: attempts 1, completed tokens 0, application sessions revoked, credentials retained, source fingerprints matching, and provider sessions still present. This does not identify the cause or prove provider logout. Preserve these jobs and the current session key.

## What changes

Migration 011 adds `farm_cleanup_review_read(integer)`, a bounded, read-only command restricted to `service_role`. It returns only session jobs in review, with their existing encrypted payload and source-match metadata, to the private maintainer process. Browser roles and PUBLIC cannot execute it. It uses SECURITY DEFINER with a fixed empty search path. No existing functions, policies, grants, sessions, credentials, content or queue rows are changed. The only data inserted is the migration marker; PostgREST receives a schema-reload notification.

The local maintainer script decrypts in memory using the unchanged private configuration. It prints flags and a restricted provider status classification, never tokens, ciphertext, identity/session IDs or provider messages. For a revoked, matching source and matching token identity, it makes only an authenticated GET to Auth's user endpoint. It does not refresh tokens, sign out sessions, claim/acknowledge/requeue jobs or create accounts. Provider verification remains pending until this command actually runs against the existing project.

## Exact owner-run steps

Use the SQL Editor of **ohajiugwo-development**, as owner/postgres. Do not rerun migrations 001–010.

1. In a new query, run this read-only preflight:

   ```sql
   SELECT
    EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140010_content_conflict_status') AS migration_010_present,
    EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140011_cleanup_review_inspection') AS migration_011_present;
   ```

   Expected: `true`, `false`. If different, stop and report the two flags; do not rerun a recorded migration.

2. Open `supabase/migrations/202611140011_cleanup_review_inspection.sql` locally. Copy the **entire freshly saved file** into a separate new SQL Editor query, without a partial selection, and run once. Expected: **Success. No rows returned.**
3. In another query, paste the **entire freshly saved** `supabase/tests/cleanup-review-inspection.sql` and run it without a partial selection. This script checks bounds, session-review filtering and denied browser-role execution. It rolls back, creates no fixtures/accounts and calls no provider. Do not run just its final PASS statement.
4. Report the full PASS or safe error text. If a test error leaves an aborted transaction, run `ROLLBACK;` alone before the corrected whole test. Do not rerun the successfully applied migration.

After a genuine hosted SQL PASS, the maintainer can run the read-only inspection from the project directory:

```bash
node --env-file=.env.admin scripts/inspect-cleanup-review.mjs --confirm-project enijmijdrqkxsxscibhy
```

Keep `.env.admin` private with its existing session key; do not paste it or credentials into chat. No Worker or Pages deployment is required for this diagnostic. Inspection does not resolve these review jobs: any recovery must follow the observed cause and preserve valid active sessions. Local tests, hosted SQL, provider HTTP and completed recovery are separate evidence gates.
