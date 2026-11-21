# Migration 010 — explicit editing conflicts

Prepared 14 November 2026 after the real two-tab test displayed “Content is temporarily unavailable” instead of a conflict. **Not applied to hosted Supabase by the agent.**

## Why this is needed

The existing revision guard raises SQLSTATE `40001`. PostgREST treats that as a transaction/serialization failure rather than an application HTTP 409. Supabase documents that affected PostgREST versions can retry this error repeatedly. Migration 010 changes the guard's error code to `PT409`, which PostgREST maps to HTTP 409. The existing editor already handles 409 by explaining that the saved version changed elsewhere. No application redeployment is needed for this SQL-only correction.

This is a confirmed source/local-reproduction defect consistent with the screenshot; the exact earlier browser response or server logs were not captured. Hosted correction and a fresh two-tab test remain required before claiming the owner's issue is fixed.

## Changes and prerequisites

- Existing project: `ohajiugwo-development`. Use owner/postgres SQL Editor.
- Completed migrations 001–009 remain applied; **do not rerun them**. Migration 010 must not already be applied.
- Replaces `farm_content_save`, `farm_content_restore`, `farm_content_trash` and `farm_content_untrash` with the same signatures, bodies, SECURITY DEFINER and fixed empty search path, except for `40001` → `PT409` at the revision guards.
- `CREATE OR REPLACE` retains function ownership and ACLs. No grants, RLS policies, locks, revision conditions, triggers or Storage policies are changed. Existing content, histories, memberships and sessions are not changed. The only inserted row is the migration marker; PostgREST is notified to reload its schema.
- A transaction contains the full change; prerequisite/repeat checks fail closed. Fixtures and local tests do not prove hosted behavior.

## Before running

Copy any unsaved dummy draft text into a temporary local note. Stop clicking Save in the stale tabs. A disabled Save button after 503 is the editor's uncertain-outcome protection, not an intentional two-tab editing ban. Do not reload before preserving any text you want to keep.

Run this read-only preflight in a fresh SQL Editor query:

```sql
SELECT
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170009_media_content_refs') AS migration_009_present,
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140010_content_conflict_status') AS migration_010_present;
```

Expected: `true`, `false`. If 010 is already present, stop and inspect rather than rerunning it.

## Owner-run application and verification

1. Open `supabase/migrations/202611140010_content_conflict_status.sql` locally. Copy **the entire file** into a new SQL Editor query in the existing project, with no partial selection. Run once. Expected: **Success. No rows returned**. On error, stop and report safe error text; do not rerun 001–009 or reset anything.
2. In a separate query, paste **the entire freshly saved** `supabase/tests/content-conflict-status.sql` and run it without a selection. It checks all four stale-revision guards, winning content/history preservation, current-version behavior, session denial, RLS and unchanged user-only function/direct-table grants. Its randomly named SQL-only user, membership, session and draft fixtures roll back inside the test and at the final ROLLBACK. No Auth API, password, invitation or email is used. Identity sequences can advance despite rollback; do not reset them.
3. Report the full-script PASS or safe error. A PASS statement alone is not verification. If a failure leaves an aborted transaction, run `ROLLBACK;` alone before rerunning the corrected whole test; never rerun the successfully committed migration.
4. Only after genuine PASS: reload both editor tabs after preserving unsaved text. Open the disposable test draft in each; save a distinct edit in A, then attempt a different edit from stale B. Expect an actionable conflict in B, and verify A's saved text remains after a safe reload. Record as owner-reported hosted HTTP/browser evidence separately from SQL/local tests.

Do not restart the project or terminate database backends merely on suspicion. If SQL/API calls remain stuck, inspect safe activity/log metadata first; any backend termination needs specific evidence and a separately reviewed action.

Sources: [Supabase serialization retry guidance](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b), [PostgREST error/status mapping](https://docs.postgrest.org/en/stable/references/errors.html).
