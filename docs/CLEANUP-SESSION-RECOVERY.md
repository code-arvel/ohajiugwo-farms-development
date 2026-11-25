# Four-session cleanup recovery

Status, 25 November 2026: **owner-run hosted rollback-only rehearsal returned the expected PASS**, shown in the SQL Editor screenshot. Its data changes were rolled back. **Owner-run real application returned the expected committed PASS on 25 November. Owner screenshot confirms saved-state counts 4/4/4/0/0/0: this reviewed batch is database-verified recovered. Owner reports fresh Preview login and protected writing desk access succeeded afterward. Owner also confirms this new sign-in survives refreshing the protected writing desk. Preservation of the earlier browser sign-in remains unconfirmed; a new login cannot prove it.** This is owner-run maintenance, not migration 012. Do not rerun migrations 001–011 or repeat the completed rehearsal without cause.

Owner-reported hosted preflight on 21 November 2026:

| Check | Result |
| --- | --- |
| Review jobs / eligible jobs | 4 / 4 |
| Distinct provider sessions / matching identities | 4 / 4 |
| Active app-session conflicts | 0 |
| Validated refresh-token cascade | true |
| Custom session DELETE triggers | 0 |
| Owner can delete session rows | true |
| Reviewed batch fingerprint | `1a49ce8c97170f12cdce3b199a043dfc` |

These results establish prerequisites, not recovery. Four revoked app sessions still have provider records; their expired access tokens cannot perform normal authenticated logout. No accounts or memberships are to be removed. Current sign-ins must be preserved.

## Concrete proposed operation

Both maintenance scripts bind to that exact four-job checksum, recheck revoked/pending sources, identity, encrypted-source/AAD bindings and absence of leases, and lock target records. They inspect and lock the cascade graph; only ordinary `auth.sessions`, `auth.refresh_tokens` and `auth.mfa_amr_claims` tables are accepted, with only validated single-column `session_id → sessions.id` cascade edges. Unexpected cascades, custom DELETE triggers/rules or reference actions cause refusal. Other managed schema versions may therefore require further inspection; never weaken a guard to force a PASS.

The operation deletes exactly those four old provider session records and their associated cascading records. Only after checking provider/refresh-token absence does it clear the matching encrypted cleanup credentials and mark those jobs done. It records four maintenance audit events, without claiming an administrator performed them. It checks that previously existing unrelated provider sessions remain. No user account, membership, content or media is changed. Other simultaneous logouts can conservatively cause refusal.

The script cannot discover the Supabase project name reliably from a universal database setting: the owner must select **ohajiugwo-development** in Dashboard. The batch checksum guards selection, but an exact restored clone could share it.

## First approval: rollback-only rehearsal

Review [the complete rehearsal](../supabase/maintenance/cleanup-review-recovery-rehearsal.sql). **Owner approved this rehearsal on 22 November 2026; run only this file, not the application file.** It actually attempts the guarded operations inside a transaction and ends with `ROLLBACK`, restoring the data rows. PostgreSQL audit sequence counters can advance even after rollback. This is isolated from migrations and creates no permanent function, privilege or schema change.

After approval:

1. Select the existing **ohajiugwo-development** SQL Editor, owner/postgres context. Use a fresh query containing the entire freshly saved rehearsal file; no selected fragment or stale editor copy.
2. Run the whole file once. Expected final result: `PASS: exact four-session recovery rolled back; unrelated sign-ins protected. This is not a permanent worker fix.`
3. If any error appears, run `ROLLBACK;` alone and report the guard/error text. Do not execute a trailing PASS by itself, edit the checksum/count or retry a partial transaction.
4. Report the actual result. A successful rehearsal does **not** resolve the jobs: all four remain for the separate real application.

## Second approval: real application

Only after genuine hosted rehearsal PASS and separate explicit approval, use the whole [application file](../supabase/maintenance/cleanup-review-recovery-apply.sql), with the same guards but ending `COMMIT`. This permanently revokes the four old provider sessions. Do not run it as part of the rehearsal, or refresh old tokens/global-sign-out users instead.

Then run the entire read-only [verification](../supabase/diagnostics/cleanup-recovery-verification.sql). Expected audited/completed/cleared counts: **4/4/4**; provider sessions/refresh tokens remaining: **0/0**. Session review jobs remaining should be 0 if no new jobs arrived; inspect any new jobs separately. Before application, the audit-derived counters are zero and do not prove provider absence. Confirm the owner's existing browser sign-in still opens the protected workspace. Report counts only; never share credentials or raw cleanup payloads.

## Evidence boundaries and remaining work

Isolated PostgreSQL fixtures exercise these scripts, including rollback, exact scope, cascade/identity/lease/schema refusal, unchanged unrelated accounts/sign-ins, late-failure rollback and replay refusal. They are not managed Supabase, real provider HTTP, multi-process concurrency or browser verification. Hosted preflight above is owner-reported and separate. Hosted rehearsal now has owner-provided SQL PASS evidence, separate from local tests. Real application also has owner-provided committed SQL PASS evidence. Saved-state counts are now owner-verified at 4/4/4/0/0/0. Post-recovery HTTP/browser verification remains pending.

This is a one-off repair. Permanent expired-token cleanup/recovery handling, remaining Stage 2 verification, pending migrations 012–014 and production readiness remain open. This operation does not enable bootstrap, send email, configure SMTP, deploy or authorise production/main changes.
