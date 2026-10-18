# Migration 004 — owner-run SQL, existing development project only

**Latest hosted checkpoint — completed:** owner reports migration 004 “Success. No rows returned.” and the entire reauthentication SQL verification PASS without errors. This supersedes historical pending/execution instructions below. **Do not rerun migrations 001–004 or completed checks without cause.** Actual provider/HTTP/HTTPS/concurrency and recovery remain separately unverified.

Status: **owner-run hosted migration and full rollback verification completed successfully**. The execution steps below are retained as historical runbook context, not instructions to rerun. Local mocked tests and the later narrow HTTP access probe are separate evidence.

**Latest owner result:** marker/column/function prerequisite is clean (true, false, 0, 0); do not repeat it. The separate trigger result was not visible. Run only `supabase/inspect-auth-user-triggers.sql` to get one explicit count/list row: zero and [] permit continuing at step 3; nonzero means stop for names/side-effect review. Migration 004 and its verification remain pending.

## What changes

`supabase/migrations/202610170004_reauthentication.sql` adds two nullable columns (`reauth_parent`, `reauth_until`) to private sessions and three new service-role-only functions: prepare, finish and abort password confirmation. Prepare stores encrypted new credentials in a revoked, cleanup-pending session with a 60-second staging deadline. Finish atomically revokes the parent and activates the staged session after server-side recipient/password verification, preserving the original absolute expiry. Abort invalidates revoked staging. Deadline checks use wall-clock time after locks.

The migration does not delete or replace existing rows, change existing RLS/Storage policies or grants, enable signup/bootstrap, or invoke Auth/email operations. Existing session rows receive NULL in the two new columns. New function execution is explicitly denied to PUBLIC, anon and authenticated, and granted to service_role. This is a source assessment; the hosted test must establish execution results. Migration 004 does not implement a cleanup worker or enable live reauthentication.

## Prerequisites and exact steps

Use the existing **ohajiugwo-development** project, with migrations 001–003 already completed, and its SQL Editor with owner/postgres privileges. Review the complete freshly saved migration and `supabase/tests/reauthentication.sql` first. No database password, SMTP setting, real account or API key is required in chat.

1. If this SQL Editor session may have an open/failed transaction, execute this alone first:

   ```sql
   ROLLBACK;
   ```

   A “no transaction in progress” warning is harmless. Do not combine this recovery step with the migration/test selection.

2. In a fresh query, paste and run **all** of `supabase/inspect-reauthentication.sql`. This is a new read-only prerequisite inspection, not a repeat of completed security checks. Expected first row:

   | migration_003_present | migration_004_present | reauth_columns | reauth_functions |
   | --- | --- | --- | --- |
   | true | false | 0 | 0 |

   The second result lists names of noninternal `auth.users` triggers. If there are any, stop for review of their side effects before running fixture SQL: database rollback cannot undo external effects from a custom trigger. Share names/status only, never trigger bodies or credentials. If 004 is already present, **do not rerun it**; report that result. If 003 is missing or columns/functions are partly present, stop and report the non-secret summary.

3. With a clean prerequisite result, open a fresh query and paste **the entire current** `supabase/migrations/202610170004_reauthentication.sql`, from `BEGIN;` through `COMMIT;`. Clear any selection so the whole file executes. Run it **once**. Expected result: **Success. No rows returned.** Stop on any error; do not retry migrations automatically.

4. Open another fresh query. Paste **the entire current** `supabase/tests/reauthentication.sql`, from `BEGIN;` through `ROLLBACK;` and its final result SELECT. Run the whole file, with no partial selection and no earlier errors. The test uses random SQL-only identity/membership/session fixtures; it calls no Auth provider, creates no persisted account and rolls its rows back. Its revoked-membership assertion now uses fresh unexpired staging so expiry cannot mask that guard.

5. Report the migration outcome and the complete PASS/error message, without secrets. A valid PASS begins **“PASS: reauthentication service grants, revoked staging, rotation…”**. The last SELECT is unconditional: executing only that line, or seeing it alongside an earlier error, proves nothing. On error, run `ROLLBACK;` separately and stop for diagnosis; do not rerun the migration.

A whole-script PASS covers grants, direct browser/anonymous denial, revoked staging, rotation, original expiry, cleanup retention, replay, abort, expiry and membership guards. It does **not** prove real Auth/password/HTTP/HTTPS flows, multi-connection locking, provider cleanup, email delivery or runtime hosting. Keep those pending in [the single Stage 2 checklist](STAGE-2-CHECKLIST.md).
