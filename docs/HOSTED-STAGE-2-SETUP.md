# Hosted Stage 2 — owner setup and readiness

**Current continuation:** the owner reports all hosted migration/rollback checks 001–009 passed. Do not rerun them. Safe RPC/anonymous Storage probes passed, and an owner-approved direct user-JWT probe confirmed an authenticated non-member is denied content and private-object reads; its temporary Auth identity and object were verified deleted, with no email sent. Active-member behavior, provider-recovery, app-preview and concurrency remain separate gates; see the [current Stage 2 checklist](STAGE-2-CHECKLIST.md).

**Earlier hosted checkpoint:** owner reported migration 004 and its reauthentication SQL verification passed. A newer handoff entry records hosted SQL 005–009. **Do not rerun migrations 001–009 or completed checks without cause.** Actual provider/HTTP/HTTPS/concurrency and recovery remain separately unverified.

## Earlier next action — 18 October, before owner ran migrations 005–009

Local account lifecycle/reset, persistent content editing, private media and durable cleanup implementation now have fresh automated/browser coverage. Admin tests pass **181/181** and public/editor tests **51/51**; these are local-only. Cloudflare Workers Free and an empty project list were owner-reported. A private Images Worker/service-binding architecture is prepared locally; it is not deployed or configured.

At that checkpoint, migrations 005–009 and their rollback scripts had been source-reviewed and none had been applied. The owner has since reported the entire sequence passed. Hosted SQL does not establish hosted HTTP, Storage, Auth/provider, concurrency or email behavior.

First deployment, real administrator/account creation, sending emails, SMTP changes and purchases still require separate owner approval. Live bootstrap, media/cleanup gates and cron remain disabled. Sender selection remains deferred. See the [single current Stage 2 checklist](STAGE-2-CHECKLIST.md).

## Historical 17 October status (superseded below)

Reversible configuration of the existing Free Supabase project and free hosting preparation are now authorised. First deployment, real accounts, email sending and purchases still require approval; live bootstrap stays disabled and SMTP/sender selection remains deferred. No remote push or automatic deployment is authorised.

Use **[STAGE-2-CHECKLIST.md](STAGE-2-CHECKLIST.md)** as the single current checklist. Migrations 001–003 and their recorded hosted checks are complete; never repeat them without a concrete reason. New **004 has only source review**, not a PostgreSQL execution result. Owner confirms its marker/column/function preflight is clean; the unseen Auth-trigger result needs only the standalone `supabase/inspect-auth-user-triggers.sql` follow-up. Follow **[the exact owner-run 004 prerequisite/migration/rollback verification steps](MIGRATION-004-OWNER-STEPS.md)**. Local mocked service/browser tests are separate from hosted results.

Cloudflare owner inventory: signed into existing account; Workers & Pages reports **No projects found**, no applications/deployments/Git integrations listed. Owner now confirms Billing **Workers Free — Active**; read-only plan inspection complete. See **[read-only billing check and local hosting preparation](HOSTING-PREPARATION.md)**. No first deployment or project creation has occurred. The actual application entry is now composed behind an unset development gate; default administration and bootstrap remain closed.

**All sections below are historical setup/checkpoint context.** Do not follow their old “empty schema”, credential creation, migration, repeated inspection or earlier local test/hosting status instructions as fresh work. Preserve the existing `.env.admin` and session key. The checklist and current linked owner steps take precedence.

**Latest checkpoint (supersedes historical pending/application instructions below):** migrations **001, 002 and 003** were reported successful; do not rerun them. Foundation SQL checks, private bucket, disabled signup and schema inspection were confirmed. Owner supplied the corrected whole-script session SQL PASS, successful session HTTP probe (`serviceCommandVerified:true`, `anonymousCommandDenied:true`), and now the whole-script `supabase/tests/first-admin.sql` PASS with fixtures rolled back. These checkpoints are complete; do not repeat them without cause. This is owner-run hosted SQL/HTTP evidence. Real provider account/token/password flows, browser integration, multi-process concurrency, full DB/Storage authorisation and email delivery remain separate.

**Email inspection complete (owner-dashboard report):** custom SMTP is disabled; the built-in Supabase sender is in use, with no external SMTP provider configured. The intended first farm administrator will use the same email already listed as an organisation Owner. No address or credentials were requested. This records configuration/recipient status only, not successful email delivery or an existing farm administrator. Do not repeat the inspection without cause or add organisation members to bypass sender restrictions.

**First-admin local implementation complete for the server slice:** injected maintainer command runner, pending invitation checkpoints, recipient/password verification, single-use activation and JSON acceptance adapter have isolated tests. Final administrator suite: 54 passing tests (27 new); existing website/editor suite: 51 passing tests. Build/function compilation and diff checks pass. The live executable refuses hosted effects; production routes remain closed. No real Auth account, email or delivery test has run. Browser acceptance shell/callback/delivery integration and durable cleanup worker are still pending. See [first-admin local runbook](FIRST-ADMIN-LOCAL.md).

**Local browser step now implemented/tested:** new acceptance screen/callback integrates with the API only through injected offline fixtures; production routes and bootstrap remain closed. Final local results: 68 admin and 51 public/editor tests pass, build/function compilation and artifact exclusion checks pass. Actual browser QA was unavailable (no browser surfaces; in-app browser unavailable). Review using `npm run admin:dev-acceptance` and the loopback `/__fixtures/` index with fake passwords only; see the local runbook. Next gates are real-browser QA, normal sign-in/session HTTP integration, provider/lost-checkpoint recovery and separately authorised disposable provider/HTTP/DB/Storage tests. Migration 003's owner-run SQL PASS remains separate completed hosted evidence. No further migration is required for this slice; do not repeat 001–003. Live bootstrap, real accounts/mail, SMTP/template/settings changes and deployment remain on hold; sender selection stays deferred.

Status: implementation started, not a working administrator system yet. Owner confirms `ohajiugwo-development` exists on Free, healthy, Stockholm (`eu-north-1`). Foundation and session-command results are recorded above; full application accounts and hosted delivery remain unverified. No website deployment, repository push or automatic deployment has occurred.

## 1. Supabase Free project

1. Sign into your existing account at https://supabase.com/dashboard.
2. Select the existing `ohajiugwo-development` project (Free, Stockholm). **Do not create another project.** Keep its database password privately in your password manager; it is not needed in the app environment for API inspection.
3. Stop if asked to upgrade, start a paid trial or pay for another project. Do not change existing projects to free a slot without review. Free capacity and pauses are limitations, not permission to upgrade.
4. Wait for database readiness. Supply only the project URL/ref in chat; never its password, API secret, connection string or token.
5. Leave the schema/buckets empty until project inspection and reviewed migrations. Auth configuration will disable new-user signup and anonymous sign-ins, retain email/password and restrict callback URLs. Provider console team members are not automatically farm administrators. Do not invite extra console members just to work around test-email restrictions.

Before migrations, inspect/record the organisation plan, project identity, existing schemas/objects, Storage buckets, allowed Auth providers, signup setting, URL allowlist and email configuration. No destructive reset. If credentials cannot be accessed by this execution environment, the owner runs reviewed SQL in the project's SQL Editor and shares non-secret verification results. Keep migration application results separate from source-only tests.

## 2. Secure local configuration (after the project exists)

The server-only template is `.env.admin.example`; real configuration belongs in ignored `.env.admin`:

```bash
cd /home/marvel/Projects/ohajiugwo-organic-farms
# Run once; do not overwrite a file you have already filled in.
test -e .env.admin || (umask 077; cp .env.admin.example .env.admin)
chmod 600 .env.admin
```

The agent has now created `/home/marvel/Projects/ohajiugwo-organic-farms/.env.admin` with owner-only `0600` permissions and an automatically generated session key. It did not print/read back the key. Preserve this file and its key; do not replace it with the blank example.

Open that exact file in your local editor. Enter:

- `SUPABASE_PROJECT_REF`: Project Settings → General → Reference ID.
- `SUPABASE_URL`: Project Settings → Data API → Project URL, exactly `https://REFERENCE.supabase.co` with no trailing slash.
- `SUPABASE_PUBLISHABLE_KEY`: Project Settings → API Keys → current publishable key (`sb_publishable_…`).
- `SUPABASE_SECRET_KEY`: same API Keys page → secret key (`sb_secret_…`). Use these current keys where available; legacy anon/service-role JWT keys are also supported by the read-only check. These are server configuration values, never pasted into chat or browser source. No database password is required here.
- `ADMIN_ENVIRONMENT=hosted-development`, with `ADMIN_ORIGIN=http://127.0.0.1:4322` while the app is local.
- Leave the already-generated `ADMIN_SESSION_KEY` intact and save it privately in your password manager. Keep both other `ADMIN_*` defaults unchanged.

Do not display `cat .env.admin`, keys, cookies, generated test links or connection strings in chat/logs/screenshots. A loaded environment file grants server privileges; do not share the file. Only confirm that it is filled in. Ignore rules explicitly exclude `.env.admin`, `.dev.vars`, runtime caches and exports; the blank example is intentionally trackable.

After saving, reply only **credentials saved**. The agent can then attempt `npm run admin:inspect`. If network access is blocked in the execution environment, run that same command in your own terminal. Its safe summary does not print keys or user records; never substitute `cat .env.admin` or a credential-bearing curl command. This check is read-only and does not prove RLS, actual session permissions or successful email delivery.

API keys do not grant DDL/migration privileges. No extra account-wide access token is requested. For database setup the agent will supply reviewed, versioned SQL to run in the selected project's SQL Editor. Start with `supabase/inspect-development-project.sql`, which is a read-only, count/boolean-only preflight; it makes no changes or administrator accounts. Do not reset the database or run setup SQL from an unrelated project. Auth settings requiring dashboard access (such as disabling public signup) will be verified separately, with exact steps when needed.

Actual callback paths and allowed URLs will be provided with the implemented Auth flows; don't add wildcard redirects. Do not assume an env template or encryption helper establishes working authentication.

## 3. Authentication emails — decision deferred

The owner chose to inspect existing configuration before selecting a sender. Supabase's default sender currently only mails organisation-team addresses, is limited to two messages/hour and is unsuitable for production. Do not repeatedly trigger invitation/reset tests or equate generated links with delivered emails. Test to an already-permitted address only after checking the project settings and limit.

A server-only test harness may exercise generated provider links with disposable accounts; results must say **email delivery bypassed**. It must never expose an endpoint that hands out invitation/recovery tokens. These tests cannot establish inbox delivery/spam placement.

We will ask before selecting SMTP, configuring a sending domain or any setup needing a purchase. A later free transactional sender generally needs a verified owned domain; your Gmail address cannot authorise sending as `gmail.com`. Existing Gmail remains the customer enquiry address. No domain purchase is needed to prepare this code or Cloudflare's free subdomain. Mailpit on a laptop is not a hosted-Supabase SMTP destination without additional networking; no tunnel/inbox exposure is authorised.

Reference: https://supabase.com/docs/guides/auth/auth-smtp

## 4. Cloudflare Free account

1. Create an owner-controlled account at https://dash.cloudflare.com/sign-up, verify the account email yourself and keep recovery access securely.
2. If offered a domain/website onboarding wizard, skip it or return to the dashboard. No domain registration, transfer, DNS setup, paid Workers plan or payment upgrade is needed now.
3. Open Workers & Pages to inspect any existing projects; do not choose Import repository, Connect Git, Deploy or upload files yet. We can prepare all configuration without a first deployment.
4. If no suitable existing project exists, prefer manual/direct-upload setup later. Do not assume connecting Git is harmless: it normally triggers builds/deployments. A Pages project reservation may be made only if the workflow creates no deployment; otherwise defer creation entirely.

Current local configuration: `wrangler.toml` names the proposed project and `hosting-output` directory. This is a local file, not evidence that a Cloudflare project exists. No API token is needed for writing/testing these files. Scope any later API token to the selected account/project and store it in provider/local secret settings.

References: https://developers.cloudflare.com/pages/configuration/git-integration/ and https://developers.cloudflare.com/pages/get-started/direct-upload/

## 5. Existing GitHub account

No duplicate account needed. The supplied text “[your username]” is a placeholder; no real username or repository identity has been confirmed. A source remote is unnecessary for current local coding. If a private empty repository is later needed, inspect existing repositories first; do not enable Pages, Actions or Cloudflare integration, and do not push until separately authorised. The owner retains account/recovery ownership.

## Hosting-readiness checklist

- [x] Stage 2 branch verified; both recovery tags preserved.
- [x] Hosted-development plan supersedes Docker requirement.
- [x] Server-only config validation, encryption/cookie/CSRF primitives have local unit tests.
- [x] Pages function compiles in-memory using existing esbuild; no files uploaded.
- [x] Private/prototype routes fail closed during implementation; no fake sign-in or setup endpoint.
- [x] Separate release-build command refuses to produce deployable review-only sample content.
- [ ] Selected owner Free Supabase project inspected; secure access ready.
- [ ] Migrations/private Storage/RLS applied and tested against actual hosted project.
- [ ] Signup disabled, first-admin/invitations/reset/session/revocation fully implemented and tested.
- [ ] Persistent editor, real uploads/private previews/history/trash implemented and tested.
- [ ] Compatible image-processing runtime and Free limits measured; no paid fallback.
- [ ] Cloudflare Free account confirmed; no Git integration or automatic deployment.
- [ ] Real email route separately approved and tested, or delivery explicitly incomplete.
- [ ] Wrangler runtime/HTTPS function tests completed; in-memory esbuild compilation is not a deployment/runtime test.
- [ ] Stage 3 independent backups/publishing gates complete before real content/launch.
- [ ] Owner explicitly authorises a first deployment after review (not authorised now).

Current checks: `npm run check:admin:unit` tests only the implemented primitives/closed routes; it does not prove working accounts or hosted policies. `npm run hosting:check` compiles the function without writing/deploying it. `npm run hosting:build` intentionally fails until Stage 3 supplies an approved release, preventing accidental publication of Stage 1 review content. Existing `npm run build` remains the local review build in `dist/`; do not deploy that directory as a substitute.

## Current connection results and next database step

The owner ran `npm run admin:inspect` in their terminal successfully: API credentials verified; public signup was enabled, anonymous sign-in disabled, photo bucket absent, editor schema absent. The agent cannot resolve the hosted address in this environment (`EAI_AGAIN`), so this is host-terminal evidence, not an agent-run hosted test. `.env.admin` is verified ignored/untracked, mode 0600, with all required values valid; none were printed.

Before applying a migration:

1. In Authentication → Sign In / Providers, disable **Allow new users to sign up**, save, leave Email/password enabled and anonymous sign-in disabled. Rerun the safe inspection and confirm `publicSignupDisabled: true`.
2. In the selected development project's SQL Editor, open a new query, paste **the entire local file** `supabase/inspect-development-project.sql`, run it and report only the count/boolean results. It is read-only.
3. If the farm schema/table/bucket counts are zero, review `supabase/migrations/202610160001_security_foundation.sql`. This prepared migration has **not been executed or SQL-runtime-tested yet**. Do not run it until the preflight results have been reviewed. It uses one transaction, stops on existing farm objects and performs no destructive reset.
4. Preflight is now approved: owner reports no farm schema, public tables, buckets or Auth identities. Select `ohajiugwo-development` in SQL Editor, choose the owner/postgres database role, paste the **entire** `supabase/migrations/202610160001_security_foundation.sql` into a new query and Run with no partial selection. It creates the private membership/session/audit/rate tables, guarded active-admin count, RLS-protected draft/revision/media tables and Storage policies. It deliberately grants no direct browser writes and creates no active administrator. Secure bootstrap/session/save operations are separate upcoming implementation.

   After SQL succeeds, run `npm run admin:configure-storage` from the project terminal. It loads ignored `.env.admin`, uses the supported Storage API to create **only** private `farm-photographs` (10 MiB/file; JPEG, PNG, WebP), and reads it back to verify. An existing identical configuration is left unchanged; a differing configuration stops without an overwrite. No credentials are printed. Bucket creation is intentionally outside the SQL transaction; a bucket-command failure does not undo the schema, so report the error instead of rerunning the first migration.
5. Run `supabase/tests/security-foundation.sql` as a whole in SQL Editor before any real administrator setup. Its disposable SQL fixtures roll back. A PASS proves those DB/role checks only; actual HTTP/Storage access, two-user concurrent requests, Auth email/password flows and application-session integration still require separate tests.

The migration/test scripts require an owner SQL Editor session. API keys alone cannot apply them. Never put SQL Editor results containing provider credentials or unrelated private data in chat. New provider secret keys are not JWT bearer tokens; the inspection correctly uses `apikey` headers, with a Bearer header only for legacy JWT keys.

### Application order and expected results

1. SQL Editor: run `supabase/migrations/202610160001_security_foundation.sql` as one complete query. Expect SQL success. Do not rerun a successful first migration: its collision guard intentionally stops repeats.
2. Local terminal: `npm run admin:configure-storage`. Expect `created and verified` and `public: false` (or `already configured; unchanged`). This command is the authorised private development-bucket setup, not a website deployment.
3. SQL Editor, new query: run the complete `supabase/tests/security-foundation.sql`. Expect `PASS: foundation DB checks completed; fixtures rolled back…`. It tests real row visibility under active/revoked contexts as well as role grants, timeouts and last-admin protection. Do not select only the final PASS statement.
4. Terminal: `npm run admin:inspect`. Expect credentials verified, signup disabled, anonymous disabled, photo bucket private and editor schema present. This does not yet prove working application sessions/invitations or uploaded-photo privacy.

Share safe summaries or SQL error text only, never environment values, keys or passwords. If any step errors, stop at that step and report it. The migration has one transaction; partial schema success is not expected on a SQL error. If SQL Editor leaves an aborted transaction open, `ROLLBACK;` clears it; do not reset or drop objects. No first administrator should be manually inserted or provider signup re-enabled.

### Reported foundation verification result

Owner returned `PASS: foundation DB checks completed; fixtures rolled back. Provider signup, concurrency and actual HTTP/Storage tests remain separate.` The SQL fixture checks are now owner-reported successful. Request the final `npm run admin:inspect` summary next; do not equate this SQL result with working application accounts or delivered invitations.

## Confirmed foundation and session-command checkpoint

Owner's latest terminal results confirm `farm-photographs` created/verified private, schema visible and both signup methods disabled. Foundation SQL fixture checks passed. Preserve that setup; do not rerun the first migration or create another bucket/project.

Next, using the same project's SQL Editor with postgres role:

1. Run the **whole** `supabase/migrations/202610160002_session_commands.sql` once. This adds service-only database commands and a bootstrap reservation; it does not create an administrator or send email. Expect success; stop on error and share only safe error text.
2. In a new query run the **whole** `supabase/tests/session-commands.sql`, not only the final PASS statement. Expect `PASS: session command privileges, leases, logout, limits and bootstrap reservation checked; fixtures rolled back…`. Run before real administrator setup; its fake identities/reservation disappear on rollback. This is DB verification, not actual provider email/concurrent HTTP testing.
3. In the project terminal run `npm run admin:test-session-access`. Expect `serviceCommandVerified:true` and `anonymousCommandDenied:true`. A missing server function cannot count as success; anonymous 404 counts only after the identical service-key route was proven to exist. The probe never calls bootstrap or creates an account.

Send the SQL result and safe HTTP summary. Do not manually insert an active administrator or re-enable signup. The sign-in/session service is under test and is not yet connected to public/admin HTTP routes; routes still return unavailable. First-admin invitation/password acceptance, reset/invite UI, persistent editor and cleanup worker are still implementation work. SMTP selection remains deferred; real mail delivery is not proven. No website deployment, repository connection or automatic publishing is needed.

### Verification-script correction: ambiguous state

An owner SQL run reported 42702 because the test's local `state` variable collided with the invitation column. The updated `supabase/tests/session-commands.sql` uses prefixed local identifiers and qualified relation columns. No migration or access-control assertion changed. Run `ROLLBACK;` separately to clear an aborted test transaction, then replace the old SQL Editor text with the entire current file and Run. Do not rerun migrations. Only after PASS run `npm run admin:test-session-access`; report errors without credentials. SQL runtime confirmation of this correction is pending the owner rerun.
