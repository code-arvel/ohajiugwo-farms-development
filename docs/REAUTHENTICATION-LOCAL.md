# Recent password confirmation — local checkpoint, not hosted-ready

**Latest hosted checkpoint — completed:** owner reports migration 004 “Success. No rows returned.” and the entire reauthentication SQL verification PASS without errors. This supersedes historical pending/execution instructions below. **Do not rerun migrations 001–004 or completed checks without cause.** Actual provider/HTTP/HTTPS/concurrency and recovery remain separately unverified.

**Current execution instructions:** [owner-run migration 004 steps](MIGRATION-004-OWNER-STEPS.md); [single Stage 2 checklist](STAGE-2-CHECKLIST.md). New authority permits this reviewed existing-project configuration; the agent has not executed SQL. Shared hosting composition now includes these adapters behind an unset explicit development gate; default routes and live bootstrap remain closed. Older “factory only” descriptions below describe the earlier checkpoint.

The original slice below added an injected server method and HTTP endpoint. Current browser integration and separate HTTP access evidence are documented in [REAUTHENTICATION-BROWSER-LOCAL.md](REAUTHENTICATION-BROWSER-LOCAL.md). It preserves the approved acceptance/sign-in/public/editor designs. Browser password confirmation is now locally integrated; 004 SQL and a narrow new command-access HTTP probe separately passed. Real account/password/provider/mail and deployed routes remain unverified/disabled.

`createAuthService(...).reauthenticate(request, {password, clientIp})` requires a live session, matching Origin/CSRF and a verified current provider identity. Account/IP attempts use keyed durable counters. The server uses that identity's email (never a supplied recipient) for the password proof. The proof must have a different provider session and its verified recipient must match the current user. New tokens are encrypted in a **revoked** staging row before the proof-verification network call; they grant no app/Storage access while staged. Only successful verification is followed by atomic activation of the new row and revocation of its old parent.

On success, opaque cookie, CSRF and provider-session identifiers rotate. The original absolute session deadline is preserved and bounds the new cookie lifetime. Old credentials remain encrypted in the old revoked row until provider cleanup is acknowledged. Failed/aborted staging stays revoked with cleanup pending if provider sign-out fails. A lost finish acknowledgement can be recovered by reading only the matching new live cookie hash; no finish is automatically retried. Unknown outcomes that cannot be confirmed fail closed and need recovery, not a success claim.

`authenticate(request, {requireRecent:true})` now rejects missing, future or at-least-five-minute-old password-confirmation timestamps with status 428. Normal password sign-in is initially recent; ordinary session refresh does not make it recent again. **Future invitation/revocation/reset-sensitive database commands must also check recency and membership inside their own transaction.** No such account-management operation is enabled by this helper.

`POST /admin/api/reauthenticate` accepts only bounded JSON `{password}` plus the current session's CSRF header. It returns only safe user/rotated-CSRF/cleanup status and the opaque HttpOnly cookie. The route is present only in the injected local factory. Production `server/handler.mjs` and live bootstrap remain closed.

## Local verification and limits

`node --test tests/admin/reauthentication.test.mjs` passes 11 isolated tests. They exercise the real auth service/HTTP adapter with in-memory RPC/provider outcomes: rotation, identity/password/CSRF rejection, attempt limits, preserved expiry, five-minute bounds, concurrent fixture requests, verification/cleanup failures, lost finish acknowledgement, original provider-session reuse and malformed/oversized HTTP requests. Mock concurrency is **not PostgreSQL locking evidence**. Review exposed a provider-reuse cleanup edge case; a failing regression reproduced it, and rejecting reuse before proof verification now preserves the original provider session. Another failing regression led to storing revoked cleanup work before provider verification can fail.

Fresh broader results: **106 admin / 51 public-editor checks**, local build/function compilation and portable HTTP compilation pass. Existing real-Chrome session fixture checks pass after the shared service change. No acceptance appearance checks were needlessly repeated. Owner appearance/200% zoom reports retain their visual-only scope; other manual accessibility and all hosted results remain pending.

**Remaining recovery gap:** if Auth returns a proof but the staging database write is unavailable and provider cleanup also fails, there may be no durable credential record for that proof. This fails closed for application privileges but requires an approved provider reconciliation/revocation procedure before live use. An ambiguous finish plus failed confirmation/abort can also leave a session whose outcome needs reconciliation. No worker is integrated yet. Workers must skip live staging leases and atomically abort/claim expired staging **before** provider cleanup, so a waiting finish cannot activate cleaned-up credentials. Do not enable live reauthentication merely because these local tests pass.

## Prepared migration 004 — owner review required before execution

New files:

- `supabase/migrations/202610170004_reauthentication.sql`
- `supabase/tests/reauthentication.sql`

They have been source-reviewed but **not executed in PostgreSQL or hosted Supabase**. No local PostgreSQL runtime is installed. The migration adds two nullable session columns and three service-only commands. It preserves existing rows/data/RLS/Storage policies and existing grants; the new functions deny anon/authenticated execution. It requires the completed 003 marker and refuses repeat 004 application. It defines commands without invoking them, creating no account or email. Prepare/finish lock membership, parent session and staged session consistently; staging expiry is checked with wall-clock `clock_timestamp()` after locks, rather than transaction-start time. These locking/deadline claims still require database verification.

Prerequisites: keep the existing **ohajiugwo-development** project, completed migrations 001–003 and private bucket/security settings; review both new files in full and confirm authority to run owner/postgres SQL. Do not rerun 001–003, reset the database or enable bootstrap. No new credentials, SMTP, real account or email is needed.

After separate owner review/authorisation of this new hosted step: apply **only migration 004 once**, then run the **entire** saved rollback-only verification file. If an aborted transaction remains, run `ROLLBACK;` separately first. The script uses random SQL-only fixture identities/memberships/sessions and rolls them back; it sends no mail and calls no Auth provider. A genuine whole-script PASS (not an isolated final statement) verifies only its SQL assertions. Multi-connection locks, clock/lease expiry during waits, real provider/HTTP/HTTPS/old-JWT access and cleanup/reconciliation remain separate tests. No hosted execution is requested or performed by this local checkpoint.

Next local work can continue with mocked password-confirmation browser integration and account lifecycle design/commands while 004 review is pending. Equal-admin invitations/resets/revocation, durable worker/reconciliation, persistent editing and private media remain unfinished. Stage 2 is incomplete.
