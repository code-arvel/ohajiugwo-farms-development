# First-administrator local implementation detail

Implements work sequence 2 of the approved hosted Stage 2 plan and `docs/admin-blog-proposal.md`. The owner explicitly authorises continuing local implementation and routine coding decisions, using mocks/isolated fixtures only. Work stays in the existing `stage-2-secure-content` checkout to preserve its uncommitted work. No repeat migrations, provider changes, real Auth accounts, emails or deployment.

## Contract and decisions

1. Maintainer bootstrap reserves zero-admin setup through the existing singleton lock. A new additive migration stores encrypted nonce/provider invitation/progress and leases, with service-only commands. Existing migrations remain byte-for-byte unchanged.
2. Use the provider's server-side generated **invite** token for local acceptance tests; generating a real token can create an Auth identity, so the installed CLI refuses live execution. The injectable command runner is tested against isolated dependencies. Default CLI/help never loads `.env.admin`. Sender selection and actual delivery remain deferred. Generated links are not delivered mail.
3. Keep nonce and provider invite material encrypted, bound to invitation ID/generation (nonce encryption uses its digest as associated data). Only nonce digests are used for lookup/checks. A future delivery adapter must place invitation secrets in an app link fragment; this local implementation creates no delivery URL or email. No endpoint or CLI prints invitation material. No GET consumes provider tokens. Delivery adapters/templates and a browser acceptance shell remain a later integration gate; never use the default provider confirmation GET as a substitute for explicit POST.
4. Acceptance handler is dependency-injected and tested locally, not connected to the closed production handler. GET supplies only a signed, expiring CSRF cookie/token. Explicit same-origin, CSRF-protected POST supplies invitation ID, nonce, provider token hash and password. Bounded JSON bodies, durable keyed account/IP counters and generic errors apply. No invitation material goes into a response, browser storage or logs.
5. Check current invitation/lease/nonce/generation before any provider effect. Verify the provider token's recipient via the provider user endpoint, never mutable metadata. Save encrypted verified progress before password work. Set password through that recipient's user token and prove it via password sign-in, rechecking recipient identity. Passwords allow paste/spaces, minimum 12 characters and maximum 72 UTF-8 bytes. Never store passwords.
6. Atomic activation rechecks expiry/state/generation/lease and zero active administrators, confirmed Auth recipient, actual password presence and pending membership. Consumes once and activates exactly that pending recipient. It creates no app session; recipient later signs in normally. Reset/invite JWTs alone never grant farm permissions. Provider sessions are cleaned up; failed cleanup retains encrypted credentials for future worker integration.
7. DB/provider network calls cannot be one transaction. Persist generated material before use; persist verified credentials before password setup. Resume those checkpoints after restart. If invite generation may have succeeded but no result was saved, mark it for maintainer review rather than silently generate another identity/link. Explicit cancellation invalidates the generation; no automatic identity deletion. Provider verification followed by a lost progress write fails closed and may need cancellation/reissue; no false atomicity claim.

## Local task/checklist

- [x] Add failing provider, bootstrap, acceptance HTTP and command tests, using an isolated RPC fixture (not evidence of PostgreSQL enforcement).
- [x] Implement server service/provider methods, blocked-by-default maintainer entry point and injectable HTTP adapter.
- [x] Prepare additive migration and rollback-only SQL verification; do not apply hosted SQL.
- [x] Test happy path, pending-only status, duplicate setup, wrong/unconfirmed recipient, weak password, expiry/cancellation/replay, leases, provider/DB failure recovery, cleanup failure, CSRF/origin/body limits, secret redaction and live command refusal.
- [x] Run existing public checks/build, all admin tests, function compilation and diff checks. Review the implementation separately for authority/side effects.
- [x] Record actual local results and next hosted SQL verification in HANDOFF/setup guide. Full Stage 2 is not complete.

Final evidence: 54 admin tests (27 new), 51 public/editor tests, build, function compilation and diff checks pass. Separate read-only review completed; saved-token refresh and cleanup-record retention were each fixed after a failing regression test. SQL was prepared/reviewed only and awaits hosted verification. No browser shell/delivery adapter/live account claim.

## Next hosted gate

Review then apply only the new first-admin migration to the existing development project, followed by its entire rollback-only SQL fixture test, before any real bootstrap. Hosted SQL/grants/row locks, real provider generation/verification/password behaviour, browser/callback/HTTPS integration, delivery and background cleanup remain unverified by isolated tests. No real bootstrap or template/SMTP change is authorised by this local implementation.
