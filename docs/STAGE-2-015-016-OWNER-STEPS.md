# Next Stage 2 database steps: 015 and 016

These are NEW updates. Updates 001–014 and their owner-run SQL checks are already complete. Do not run them again. Keep automatic session reconciliation and account email delivery disabled until their own verification is complete. First-administrator bootstrap stays off.

## What changes

**015 fixes the expired-session cleanup gap.** It adds a tightly limited server command for removing one already-revoked provider session when its expired token prevents normal logout. It checks the cleanup job, its owner/time limit, matching user/session, encrypted credential record, absence of any active app-session alias, and the actual Auth foreign-key/trigger structure. Only the claimed session and its linked refresh/AMR rows may be removed. Unrelated sessions/users stay intact. Unknown database structure fails safely. Records are acknowledged and credentials cleared only after provider-session absence is verified. Applying this update defines the commands; it does not run cleanup or delete existing data.

**016 finishes additional-administrator invitation and recovery delivery.** It adds a private delivery status to existing invitation records and two server-only commands that record an email request before the provider call and its acceptance afterward. Existing rows start as `not_sent`; no membership is activated by sending. The inventory reports provider acceptance separately from actual inbox receipt. Uncertain requests require review rather than automatic resending. Existing recent-password, session, lease, recipient/password-proof and single-use acceptance controls remain. Applying this update does not create accounts or send emails.

Both updates preserve existing content, media, memberships, access controls and designs. They do not grant direct Auth-table deletion to the service role, enable public signup, schedule retention, publish or deploy anything. Their full verification scripts use disposable SQL fixture records inside transactions that end with ROLLBACK. There are no provider/SMTP calls. The 015 script temporarily deletes only its own dummy provider-session fixture before rolling it back.

## Prerequisites

- Existing **ohajiugwo-development**, SQL Editor using owner/postgres.
- 014 present; 015/016 absent before first application. 016 requires 015.
- Owner role can delete `auth.sessions`; existing Auth session/refresh tables available. 015's verification also checks supported Auth cascade/trigger structure and stops if it differs.
- Use the freshly saved complete files from this checkout. No selected text or standalone PASS statement.
- Keep new runtime gates off. No real account/email approval is implied by running these SQL files.

## Exact owner-run sequence

1. In SQL Editor, run all of `supabase/inspect-stage2-015-016.sql`. Expected first run: **true, false, false, true, true, true**. Report the flags if different; do not rerun an update whose marker is already true.
2. If those flags match, open `supabase/migrations/202611250015_session_reconciliation.sql` in VS Code. Select all, copy it into a fresh SQL Editor query in this project, and run the **whole file**. Expected: “Success. No rows returned.”
3. Run `ROLLBACK;` alone in that same SQL Editor session. Then replace the query with the **entire** freshly saved `supabase/tests/session-reconciliation.sql` and run it. Report its complete PASS message or the error. A genuine PASS covers SQL protections only; it does not verify the deployed worker or real provider concurrency.
4. After a genuine 015 PASS, run the whole `supabase/migrations/202611250016_account_email_delivery.sql` once. Expected: “Success. No rows returned.”
5. Run `ROLLBACK;` separately, then run the **entire** freshly saved `supabase/tests/account-email-delivery.sql`. Report its PASS message or error. It sends no email and does not establish real provider/inbox/browser acceptance.

If any file errors, run `ROLLBACK;` alone and report only the error message. Stop dependent steps. Do not automatically rerun an applied migration or run only its final PASS statement. These updates do not repair/requeue the previously reviewed four jobs; that earlier recovery is complete.

## What comes afterward

After SQL passes, build/review and update only the existing Stage 2 Preview and private cleanup Worker as needed. Verify the new service-only/anonymous HTTP boundary before enabling either gate. Use a new disposable revoked session to verify natural automatic cleanup, preservation of the fresh sign-in, retry/lost-response handling and independent-worker claims; do not reuse the completed four-session repair as proof.

Account email delivery must stay off until the existing invitation AND password-recovery templates are verified to use the application's exact `/admin/accept` destination and the appropriate provider TokenHash proof. The invitation template has earlier owner evidence; **recovery template readiness is not yet confirmed**. Do not change SMTP credentials or templates silently. Never paste secrets or bearer invitation links into chat.

Then request specific approval for the controlled second-recipient invitation to **knoah1971@gmail.com**. The address alone is not approval to create/send. Observe actual provider acceptance, owner inbox receipt, intended-recipient password setup/acceptance, normal login, reset delivery/acceptance, invalid/reused-link denial and revocation/old-session denial. Each result remains separate from local and SQL checks. Passwords are entered privately by the owner. No first-admin bootstrap, production release, payment or main merge is part of these steps.

Provider reference checked against the official [Supabase email template guide](https://supabase.com/docs/guides/auth/auth-email-templates) (`RedirectTo` / `TokenHash`) and [password recovery API guide](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail). These references explain the integration; they do not verify this hosted project’s actual templates or inbox delivery.
