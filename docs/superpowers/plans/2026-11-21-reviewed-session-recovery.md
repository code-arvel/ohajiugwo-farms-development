# Reviewed four-session recovery implementation plan

> Execute inline with executing-plans; verification-before-completion applies. Prepare and test locally only. Hosted rehearsal/application require separate explicit owner approval.

Goal: prepare a concrete owner-run, batch-bound recovery of four already-revoked application sessions whose provider records remain and whose old access JWTs are expired.

Architecture: self-contained owner/postgres transactions, no new permanent function/migration/grant. Rehearsal ends ROLLBACK; separately reviewed application ends COMMIT. Bind to owner-reported count4/checksum 1a49ce8c97170f12cdce3b199a043dfc. Preserve other provider sessions/accounts and app data. Validate cascade/delete-trigger graph before DML. Record maintenance audit with no falsely attributed app actor. This is a one-off recovery, not the permanent worker expiry fix.

1. Add isolated PostgreSQL tests with four target sessions/tokens, unrelated active sessions/accounts and other cleanup work. Prove rehearsal rollback, successful bounded apply/cascade/audit/credential disposal, refusal of changed batch/active source/identity mismatch/leases/missing cascade/custom child triggers/unauthorised caller, rollback on late failure and replay refusal.
2. Implement self-contained rehearsal/application scripts with identical guards: owner-selected project plus 011 marker, checksum/count4, source-before-job locks, revoked/pending/source ciphertext/AAD/lease checks, exact provider identity locks, no active aliases, validated refresh-token cascade, stable exact-edge Auth cascade graph and no custom DELETE triggers/rules. Delete exact Auth sessions only, verify session/refresh absence then clear source/job credentials and mark done; protect other existing provider IDs. Fail atomically on drift.
3. Add count-only post-verification/runbook, independent read-only review, resolve material issues and run relevant local suites sequentially. Record hosted preflight separately. Ask approval for the concrete rollback-only hosted rehearsal; do not execute hosted writes or instruct live apply before that approval and result.

Ruling: use owner-reviewed targeted maintenance rather than refreshing expired tokens or global sign-out. This avoids manufacturing a provider session or signing out unrelated current users. Cost: one-off repair is owner-operated and provider-schema-specific; permanent guarded expiry cleanup still needs implementation and hosted verification. Verify actual cascade/schema prerequisites and refuse drift.
