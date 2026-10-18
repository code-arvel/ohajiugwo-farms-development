# Hosted Stage 2 Secure Content Implementation Plan

**Current progress/authority:** [single Stage 2 checklist](../../STAGE-2-CHECKLIST.md). Owner now permits reversible existing Free-project configuration and free hosting preparation; first deployment, real accounts/mail and paid actions require approval. Setup statements below about not yet having a Supabase project are historical and superseded by verified 001–003 checkpoints.

> **For agentic workers:** Use superpowers:executing-plans, task by task. The owner authorises hosted development and free service configuration after sign-in/secure access. No deployment of the website, remote push, automatic deployment or paid setup is authorised. The earlier local-only plan is retained in `2026-10-16-stage-2-local-superseded.md` as historical reference, not instructions.

**Goal:** Secure, persistent administrator editing against an owner-controlled hosted Supabase development project, plus deployment-ready Cloudflare server/build configuration without deploying the website.

**Baseline:** `stage-2-secure-content` starts at `effda5630f164b818d50af4f1768f0a4b4f85fb6`, tagged `approved-stage-1-v1`. Original `approved-website-v1` remains `d89943d754e667f8fa5f50251c36bbfb17e84073`. Neither tag may move. Reuse the approved Tiptap editor and shared renderer/logo. Further editor styling remains deferred. Preserve public designs, cream footer mask, Maps link, hover colours and email-only enquiries at ohajiugwochimeziebibi@gmail.com.

**Spec:** `docs/admin-blog-proposal.md`, amended by the owner's hosted-development/service-setup instruction. That instruction supersedes local Docker/Mailpit and blanket no-external-account requirements for Stage 2. Live publishing remains Stage 3; analytics/monitoring remain Stage 4.

## Architecture and boundaries

- Hosted Supabase Free: Auth, Postgres/RLS and private Storage with disposable data only. No Docker or local Supabase prerequisite. Keep migrations/versioned SQL in Git; apply only to the explicitly selected development project after a reviewed schema inspection. Never run a reset against a shared project.
- Local administration server on loopback during implementation; use portable Request/Response/Web Crypto handlers shared with Cloudflare Pages Functions. Browser calls same-origin `/admin/*`; server-only secrets and provider refresh tokens never enter browser storage or bundles. No UI framework/backend rewrite.
- Cloudflare Pages hosting **preparation** uses a separate build directory and explicit function routing. Keep Git integration absent: no first-build risk, deploy hooks, Actions workflows, remote push or upload. Prefer an existing suitable project after inspection; otherwise reserve a manual-upload project only if this creates no deployment. Free Pages subdomain later needs no purchased domain.
- Public static build remains independent of the editing database. Draft changes never change the homepage/blog output. Deployment artifacts must physically exclude Stage 1 `/__editor`, `/__review`, source fixtures, drafts and secrets. Authenticated administrator scripts may be bundled outside public assets and served only through protected functions. Public sign-in resources contain no protected content.
- Hosted preview documents and photographs remain session-authorised, no-store/private/noindex and no-referrer. These headers supplement access control; hidden URLs/noindex never count as protection.
- Image decoding/re-encoding must not assume native `sharp` runs in Cloudflare Pages. Use an authenticated Supabase image-processing function with bounded WASM decoding if needed, following Supabase's supported example; verify Free execution limits with actual samples. It is a private backend integration, not a website deployment. Until validated, uploads cannot be marked ready or the hosting checklist complete. No paid image service is implied.

## Service setup and access gates

Known state: owner has a Supabase account without a project, an existing GitHub account (actual username not supplied), and needs a Cloudflare account. Reuse accounts, inspect existing projects before creating duplicates. Owner signs in themselves. Never request passwords, tokens or database passwords in chat.

1. Owner creates/selects a **Free** organisation and `ohajiugwo-development` Supabase project, initially empty/disposable. Record project URL/ref, region and Free status. Store database password privately. Project URL/ref is safe to supply; credentials go only into ignored `.env.admin` or provider secret settings. Inspect schema/buckets/Auth settings before changes.
2. Owner creates/signs into Cloudflare Free; skip domains and repository connections. No paid trial/upgrade. Account/project names are non-secret; tokens, if later needed, are scoped and stored through local credentials/provider settings, never copied into logs/chat.
3. Existing GitHub is sufficient for now. Private repository creation can wait; no source push is authorised. Later repository integration must be reviewed for deployment side effects first.
4. Local `.env.admin` contains selected project URL and exact expected project ref, server publishable/anon key, server secret/service-role key, session encryption key, and app origin. No database password is needed in browser code. Migrations can be applied by the owner in SQL Editor after review if direct DB credentials/CLI are unavailable. Keep a migration execution record; do not claim it ran until verified against hosted schema.
5. No package/provider credentials are printed to troubleshoot connectivity. Integration tests require both explicit disposable-development acknowledgement and matching expected project ref; never auto-discover or seed a production project.

### Authentication email decision — explicitly deferred

Owner chose **inspect existing setup first; defer new sending services**. Inspect Auth email configuration, actual permitted recipients and current rate limits before sending. Supabase's default sender is restricted to organisation-team addresses and currently two messages/hour; it is not production SMTP. Do not add the father to the provider organisation merely to bypass this restriction: provider-console access differs from application administrator access.

Use existing approved SMTP if present and appropriate. Otherwise controlled mail tests may be possible to existing permitted team addresses, but do not claim invitation/reset success for arbitrary recipients. Server-only generated test links may exercise acceptance/reset mechanics in disposable tests; label these as **delivery bypassed**, never proof of delivered email. No public endpoint returns test links. Integration tests must not flood the real sender.

Ask the owner before selecting a transactional sender or DNS/domain work. A production sending arrangement generally needs a verified owner-controlled domain; the Gmail enquiry address remains unchanged. Domain purchase can remain deferred. Hosted Supabase cannot send to a laptop-only Mailpit inbox without additional network exposure; do not open a tunnel or expose a local inbox implicitly. Real invitation/reset delivery remains an explicit acceptance gap until approved and tested.

Sources checked: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Pages Functions local development](https://developers.cloudflare.com/pages/functions/local-development/), [Supabase image processing](https://supabase.com/docs/guides/functions/examples/image-manipulation).

## Security/data contracts

**Accounts:** disable public registration and anonymous sign-in at provider level and test direct attempts. Authentication alone grants no administrator permission. Maintain pending/active/revoked membership and invitations; all active administrators have equal permissions. First administrator uses an explicitly invoked maintainer CLI with server credentials, a singleton bootstrap reservation and zero-active-admin check. No first-admin HTTP endpoint. Activation follows verified invitation/password completion, not mere Auth account creation.

**Invitations/recovery:** active administrator plus recent password reauthentication required to invite/resend/cancel/revoke. Hash application invitation nonces and bind them to verified identity, generation, expiry and one-use acceptance. Resending/cancelling invalidates previous application links. Callback GET must not consume a link; an explicit POST completes verification. Strict redirect allowlist, no tokens in browser storage/referrers/logs. Reset-only context cannot edit content or revive revoked access. Reset invalidates other sessions. Guard last-active-admin removal with a database lock including simultaneous cross-revocation; pending users do not count. Provider Auth calls use recoverable/idempotent jobs rather than pretending network requests participate in one SQL transaction.

**Sessions:** opaque random cookie, digest-only lookup, encrypted server-side Auth credentials. HttpOnly/SameSite=Lax/host-only; Secure for HTTPS, isolated loopback-only exception for local HTTP. Thirty-minute idle, twelve-hour absolute, five-minute recent reauthentication. Rotate identifiers after authentication/recovery, serialise refresh, CSRF and Origin enforcement on mutations. Logout immediately revokes application session even if provider cleanup fails. Check membership and application-session state on every API/preview/media request. RLS also checks JWT `session_id`, active membership and live application-session times so old provider JWTs fail after revocation/logout/timeout. No direct user writes to sessions/memberships. Durable account/IP abuse counters, generic reset/login responses, backoff, redacted audit. CAPTCHA provider testing is a later explicit setup gate; no fake protection claim.

**Database/Storage:** every editorial table/bucket deny-by-default; anon and authenticated non-admin direct requests denied. Least-privilege grants, locked-down functions/search paths, immutable revision/audit writes. Ordinary record operations use the verified user's JWT/RLS rather than a service-role client for everything. Privileged Auth operations require explicit checked server permission first. Storage is private, originals/derivatives separate, no public bucket or long-lived preview URLs. Scope checks apply on upload initiation/finalisation, metadata, replacement, media reads and deletion. Storage does not become secure merely because the admin UI is hidden.

**Content:** fixed company/homepage/product/service fields with existing length/card-count limits and safe article JSON; no unrestricted HTML. `saveDraft({id,kind,baseRevision,payload})` performs validation and atomic compare-and-swap; stale save/metadata/delete/restore returns 409 with copy/reload/compare. Saved revision history is append-only. Keep review-only fixtures flagged; normal edits/imports cannot silently authorise sample publication. Explicit import validates/displays a diff. No private localStorage fallback after server error; retain current unsaved text in memory with warnings/copy options. Public build never reads draft tables.

**Photographs:** real progress/retry/cancel, 10 MiB/file, max ten/batch and 24 megapixels, JPEG/PNG/WebP allowlist, decode actual bytes and reject mismatches/corrupt/oversized files. Strip EXIF/location metadata by re-encoding, normalise orientation; original stays private. Immutable versions, alt/description/licence/provenance/focal point/tags/folders and usage references. Incomplete/quarantined objects are not selectable. No arbitrary remote URL fetching. Private media proxy rechecks session; no public bearer preview links.

**Recovery:** Stage 2 includes history comparison, restore-to-new-draft and soft delete/restore with base revisions; never auto-publish. Do not permanently delete referenced media. Stage 3 supplies 90-day revision/30-day trash retention cleanup and scheduled encrypted independent DB-plus-photo backups. Hosted Free persistence is not an independent backup; use disposable content until Stage 3 backup/restore acceptance. Maintainer-run exports before destructive tests; test recovery in a separate isolated destination. Never assume the laptop runs continuously.

## Work sequence (tests first)

### 1. Hosted configuration, safe output and permission foundation

Files: `server/config.mjs`, `server/security.mjs`, `.env.admin.example`, `supabase/migrations/*`, `tests/admin/*`, `scripts/build-hosting.mjs`, `wrangler.toml`, `functions/admin/[[path]].js`, `.gitignore`, hosting/setup runbooks.

- [ ] Verify branch/tags; revise plan before code (this document).
- [ ] Add failing tests for absent/mismatched project configuration, unsafe origins, insecure cookies/CSRF, secret-free artifacts and blocked prototype/review routes.
- [ ] Build safe configuration, portable security primitives and separate hosting artifact assembly without deployment. Missing secrets/backend fail closed; no fake login or content success.
- [ ] Inspect selected hosted project, then apply migrations and private bucket policies with owner-controlled access. Verify grants/RLS through direct hosted requests.

### 2. Sessions and account lifecycle

Files: `server/auth/*`, `server/provider.mjs`, `scripts/bootstrap-admin.mjs`, `admin/auth.mjs`, transactional admin/session migrations, account and integration tests.

- [ ] Tests: disabled direct signup, generic auth/reset responses, rate counters, CSRF, session fixation/rotation/refresh, idle/absolute expiry and logout with old cookies/JWTs.
- [ ] Implement first-admin CLI/reservation, invite/password acceptance, two equal accounts, administrator list/invite/cancel/resend/revoke and reset-only context.
- [ ] Hosted tests: wrong recipient/expired/cancelled/replayed link, provider send/cleanup failure, concurrent last-admin revocations, revoked user reset and direct DB/Storage old-JWT access. Record email delivery separately from generated-link tests.

### 3. Persistent structured editing and recovery

Files: `server/content/*`, `admin/content-api.mjs`, reused existing editor/writer/fields, revisions/RPC migrations and content/conflict/recovery tests.

- [ ] Prove durable save/load across browser/server restart and backend network failures; no silent fixtures/localStorage fallback.
- [ ] Preserve all safe formatting/legacy compatibility/import validation, fixed homepage layout/slots and unsaved-change warnings; change only functional statuses/actions. No publish action.
- [ ] Two-admin stale saves and restores fail atomically. History/trash restores create drafts; no loss of revision history or referenced media.

### 4. Private photographs and saved-revision previews

Files: `server/media/*`, authenticated hosted image processor if required, `admin/photographs.mjs`, preview adapter around existing renderer and media/security tests.

- [ ] Prove byte/type/size/dimension/metadata processing, real progress/cancel/interruption/replacement and draft usage references.
- [ ] Render saved homepage/article revisions through private routes only. Session checks cover page and every private media response. No published URL, sitemap, bundle or static build contains drafts/photos.
- [ ] Test anon/non-admin/revoked access directly against hosted Storage/API/database; compare desktop/mobile previews against approved public layout.

### 5. Hosting readiness and final verification

- [ ] Run existing build/51 checks, all new unit/integration tests and Cloudflare local function compilation/emulation where available. Report missing downloads/runtime/provider access instead of assuming success.
- [ ] Verify package licences/lockfile, environment separation, no source secrets, private/no-store headers, function routing, body/upload limits, public baseline preservation and physical absence of prototype/review/drafts from hosting artifacts.
- [ ] Record exact hosted project/environment, migrations applied, policy tests, account/email tests and remaining launch gates. Account-owned Supabase config is not evidence of successful public hosting.
- [ ] Update HANDOFF.md, hosting-readiness checklist and owner runbook; stop for visual/security review. No push, public deployment, automatic deployment or Stage 3 work.

## Hosting-readiness checklist

- [ ] Free owner-controlled Supabase project selected; schema/grants/private buckets/Auth signup restriction verified.
- [ ] Server credentials only in ignored environment/provider secrets; scoped keys, encryption key and rotation/recovery inventory recorded privately.
- [ ] Separate build includes approved static pages and protected functions only; prototype/review/draft files absent.
- [ ] Cloudflare Free account selected; Git integration/automatic deployments absent; no upload/first deployment run.
- [ ] Same-origin secure Auth callbacks, cookies, CSRF and media protections ready for later HTTPS verification.
- [ ] Image-processing runtime/free limits demonstrated; no hidden paid dependency.
- [ ] Hosted Auth/RLS/Storage tests pass with disposable identities and revoked/expired tokens.
- [ ] Delivery-capable email setup separately approved/tested, or explicitly NOT READY (never represented as production-complete).
- [ ] Stage 3 publishing/recovery and Stage 4 reporting still disabled; scheduled independent backup remains a pre-launch gate.
- [ ] Separate owner approval obtained before **any** public deployment.

## Setup progress and outstanding access

Supabase account exists; project URL/ref/access not yet supplied. Cloudflare sign-up guidance sent; readiness not confirmed. GitHub account exists; repository creation/push is deferred. Owner chose to inspect existing email setup and defer sender selection. No provider credentials have been requested in chat. Local coding/unit verification can proceed while service access is pending; hosted permission/account tests cannot honestly pass without that access.

## Execution checkpoint — hosted foundation confirmed

17 October local continuation: recent-password-confirmation service/HTTP and prepared-only migration 004 plus rollback-only SQL verification are added. Fresh 106 admin/51 public checks, mock Chrome session regression, build/function and portable HTTP compilation pass. SQL/provider/concurrency/reconciliation remain unverified; 004 has not been executed. Existing migrations/checkpoints, approved styling and live restrictions are preserved. See latest HANDOFF and REAUTHENTICATION-LOCAL.md before any owner review/hosted execution. Account lifecycle/editor/media work remains unfinished.

Newest local checkpoint: browser sign-in/logout and protected session confirmation are implemented through injected mock-only routes; 95 admin/51 public-editor checks, isolated real-Chrome session QA, build/function and portable client/screen compilation pass. Review plus a failing regression fixed pre-import pagehide/restoration cleanup. The owner reports acceptance appearance looks good at 200% zoom; this is visual only, not screen-reader/visible-focus/keyboard or hosted Auth verification. Production/live bootstrap, real identities/mail, SMTP/settings/migrations and deployment remain disabled. Continue remaining local lifecycle/recovery work; see HANDOFF and SESSION-BROWSER-LOCAL.md.

Latest local checkpoint supersedes the older local counts/statuses below: owner visually approved the implemented centred acceptance form; this is appearance approval only, with incomplete accessibility/hosted checks still pending. The next sequence-2 slice added injected sign-in/session/logout HTTP integration with isolated mocked providers and loopback tests. Fresh 86 admin/51 public-editor checks, build/function compilation and portable adapter compilation pass. Production admin routes and live bootstrap remain closed; approved screen/public/editor styling, hosted migrations and settings are unchanged. See HANDOFF and docs/SESSION-HTTP-LOCAL.md for limits and next steps. No real accounts, mail or deployment.

Local browser acceptance screen/callback step is now implemented via injected offline fixtures, preserving public/editor styles. Final local results: 68 admin tests, 51 public/editor checks, build/function compilation and artifact exclusion pass. Separate review plus failing regression tests fixed DOM readiness and busy-lease retry handling. Real-browser QA was attempted but unavailable (no enabled surfaces; in-app browser unavailable). Production routes and live bootstrap remain closed; no SQL, hosted accounts, email or settings changed. See HANDOFF and FIRST-ADMIN-LOCAL for the fixture review command and remaining real-setup gates. This supersedes the pending-local-screen statements below, without superseding owner-run hosted results.

Latest owner-run hosted checkpoint: migration 003 succeeded and the whole first-admin SQL verification passed with fixtures rolled back. This supersedes pending-003 statements below. Migrations 001/002/003 and their completed checks must not be repeated without cause. Local 54 admin/51 public test results remain separate. Next is local browser acceptance and callback/HTTP integration with mocks; real provider accounts/mail, live bootstrap, SMTP/settings changes and deployment remain on hold. Provider/browser/delivery and multi-process concurrency are still unverified; Stage 2 remains incomplete.

First-admin local server slice now has an injectable maintainer command runner, pending invitation checkpoints, verified recipient/password acceptance and single-use activation. Installed live command and production routes remain closed; browser shell/delivery/callback integration is not implemented. Final local checks: 54 admin tests (27 new) and existing 51 public/editor tests pass, build/function compilation and diff checks pass. Read-only review plus red/green regression tests fixed saved-token expiry recovery and earlier probe-cleanup record loss. New migration `202610160003_first_admin.sql` and rollback-only `supabase/tests/first-admin.sql` are prepared, **not applied/executed**. Next hosted gate is review/application of only that new migration and whole-script SQL verification. No provider identity/email or real administrator was created, and sender selection remains deferred. Full Stage 2 remains incomplete; details/remaining risks in HANDOFF and `docs/FIRST-ADMIN-LOCAL.md`.

Email inspection is now complete: owner reports custom SMTP disabled (built-in sender), and the intended first-admin email already belongs to an organisation Owner. This does not establish farm membership or email delivery. Sender selection stays deferred; owner explicitly prohibits sending email or creating the administrator yet. Next is local implementation/testing of maintainer bootstrap, recoverable pending invitations and verified recipient/password acceptance, with no real provider side effects. Do not repeat the email inspection or completed SQL/HTTP checks without cause.

Latest owner-run results supersede the pending migration/test statements below: session migration `202610160002` succeeded, corrected whole-script SQL verification passed with fixtures rolled back, and the HTTP probe returned `serviceCommandVerified:true` / `anonymousCommandDenied:true`. Do not rerun either successful migration or repeat completed checks without new cause. Continue account lifecycle implementation; inspect existing email/SMTP and permitted-recipient status before triggering mail, preserving the deferred sender-selection decision. No real bootstrap/invitation has been performed.

Owner confirmed private Storage creation, disabled public/anonymous signup and schema visibility via terminal. Foundation DB tests passed with rollback. Server provider/session modules now have 12 local tests; safe HTTP-access-probe module has two more (27 total Stage 2 unit checks). Session migration `202610160002` and its rollback-only SQL tests await owner execution. Admin HTTP routes deliberately remain unavailable; first-admin CLI/acceptance, reset/invitation management, durable cleanup retries and persistent editing are not yet complete. No hosted account-flow result is inferred from mocked tests.

Initial abuse limits conservatively count all sign-in attempts, including successful ones: five/account and twenty/IP per 15 minutes. Scope keys use keyed HMAC rather than raw addresses. Revisit legitimate-user throttling after end-to-end testing; controls are server/DB enforced. Further editor styling stays deferred.
