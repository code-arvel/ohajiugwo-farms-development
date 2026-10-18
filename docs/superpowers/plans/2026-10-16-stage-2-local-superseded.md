# Superseded local-only Stage 2 plan

Historical reference only. The hosted plan replaces the Docker/Mailpit requirement and local-only account restrictions. Do not execute this document.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after owner approval. Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch agents without separate authorisation.

**Goal:** Replace browser-only content persistence with a locally tested, invite-only administrator system, private photographs/previews and recoverable structured drafts, preserving the approved public website.

**Architecture:** Keep the existing static public renderer/build and reuse the current free Tiptap editor. Add a separate, loopback-only Node administration server at `http://127.0.0.1:4322`, serving `/admin/` and its same-origin API; local Supabase supplies Auth, Postgres and private Storage, with Mailpit capturing authentication mail. A server boundary holds Supabase credentials and sessions; browser scripts receive neither refresh tokens nor privileged keys.

**Tech Stack:** Existing Node 22+, JavaScript modules, constrained Tiptap JSON, esbuild; proposed additions are pinned stable Supabase CLI, `@supabase/supabase-js`, maintained image-decoding/re-encoding library (`sharp`), pgTAP/SQL policy tests and a development-only browser test runner. Use Node's existing HTTP APIs with focused routing modules; no frontend/framework replacement or unrestricted page builder. Review versions/licences before installation; no packages have been added by this plan.

**Spec:** [Approved staged proposal](../../admin-blog-proposal.md). This document refines Stage 2 only. Hosting portability is an acceptance constraint, not permission to configure Cloudflare or any hosted service.

## Verified baseline and branch gate

Verified 16 October 2026: clean `main` at `effda5630f164b818d50af4f1768f0a4b4f85fb6` (`Complete approved Stage 1 website and blog`). `stage-1-blog-foundation` and `approved-stage-1-v1` point to that same commit. `approved-website-v1` remains `d89943d754e667f8fa5f50251c36bbfb17e84073`. The owner reports all 51 checks passed; this planning pass did not rerun the unchanged product suite. The preceding verification is recorded in HANDOFF.md.

Attempted `git switch -c stage-2-secure-content`; `.git/refs/heads/...lock` is read-only to this environment. **The owner subsequently created the branch; Git verification confirms `stage-2-secure-content` is checked out at `effda5630f164b818d50af4f1768f0a4b4f85fb6`.** Both recovery tags remain unchanged. The following setup command is retained as history, not an instruction to recreate the existing branch:

```bash
cd /home/marvel/Projects/ohajiugwo-organic-farms
git switch -c stage-2-secure-content
git branch --show-current
git log -1 --format='%H %s'
```

If it already exists, inspect its target/status instead of resetting it. Planning documents can be carried onto this branch; no public code has changed. Never move either recovery tag.

## Global constraints

- Preserve the approved homepage, Farm Journal/article layouts, responsive contents navigation, SVG/font assets, manual cream footer mask, Maps link and lighter hover colours. Public contact remains **ohajiugwochimeziebibi@gmail.com**, exclusively by email.
- Further editor styling is deferred. Reuse `local-editor/writer.mjs`, field renderers and existing styles, with only functional controls/status/accessibility adjustments required by real accounts, media and persistence.
- Local backend and email inbox only. No hosted account, real email, purchased domain, production SMTP, remote push, deployment or publishing hook.
- Drafts and original photographs are private; authentication alone does not grant administrator access. Equal permissions for all active administrators, with no public signup or bootstrap endpoint.
- Stage 2 saves/restore operations create drafts only. Stage 3 owns live publishing and scheduled independent backups; Stage 4 owns analytics/health reports. No fake publish buttons or health/analytics numbers.
- Keep the Stage 1 `/__editor/` prototype distinct, explicitly unauthenticated, loopback-only and excluded from static output. The new `/admin/` must never fall back to that prototype or silently load fixture data after a backend failure.

## Review focus

1. A revoked, idle-expired or logged-out administrator's still-valid Auth JWT must fail API, direct database and Storage access.
2. Simultaneous administrator revocations must not remove the last active administrator; stale content/media saves must never overwrite a newer revision.
3. A cancelled/older invitation or replayed recovery link must not activate membership; opening an email link must not consume it merely because a mail scanner fetched it.
4. Interrupted uploads and misleading file extensions must not expose files or leave selectable, incomplete media.
5. Session expiry, network loss and conflicting edits must preserve the current writer's text for deliberate retry/copy without quietly retaining private drafts on a shared browser.

## Local setup requirements — checked, not installed

| Item | Observed state | Required before implementation/testing |
| --- | --- | --- |
| Git | Baseline verified; writes blocked in this environment | Owner creates the branch in their terminal; verify actual ref before code. |
| Node/npm | Node 22.22.1, npm 9.2.0 | Existing Node requirement is met. |
| Docker | Client 29.9.0 installed; daemon socket access denied here | Run `docker info` in the owner's terminal. A successful host result establishes access only for that terminal, not this environment. Resolve daemon/runtime permissions using the host's normal administration; do not make the socket world-writable. |
| Supabase CLI | Not on PATH; not in package dependencies | After approval, install a pinned stable project dev dependency and use `npx supabase`. No `supabase login`, linking or hosted project is needed. |
| Memory/disk | About 43 GB disk available; ~1.9 GiB available RAM and almost all 4 GiB swap used at inspection | Close unused heavy applications, then check again. Start only when services can run without sustained swapping; report OOM/start failures. These are snapshot observations, not guaranteed capacity or official minima. |
| Local ports | Not yet tested for availability | Reserve admin 4322; current public preview 4321; check Supabase ports from generated config, normally API 54321, DB 54322, Studio 54323 and Mailpit 54324. Avoid interfering with other local projects. |
| Downloads | Not attempted | First CLI/container/browser downloads require internet access and time. If blocked, provide exact host commands; do not substitute hosted services. |

Use stable container-based local development. Experimental native Supabase runtimes are not the default workaround for this permission issue. Ensure exposed service ports bind to loopback using the chosen runtime/network configuration; verify from the host before putting any private test content in them. Studio and Mailpit are developer tools, not administrator permission boundaries.

After plan approval and dependency/configuration work, expected maintainer workflow is `npx supabase start`, `npm run dev` and a proposed `npm run admin:dev`. Mailpit's address comes from local CLI output (normally `http://127.0.0.1:54324`); do not paste credential-bearing CLI output into chat. Normal stop must preserve volumes. Never run a destructive reset or remove volumes containing useful drafts without an export and explicit review.

**Costs:** local development requires no domain or external account, and no service subscription. Mailpit tests invitations/password resets, not actual inbox delivery. Keep the existing Gmail address for enquiries. A separately approved free transactional-email provider and owner-controlled sending domain are launch requirements; defer domain registration/renewal entirely during Stage 2. Hardware/internet/storage consumption still applies. Current official [CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started) documents project installation, container operation and the bundled inbox.

## Security and data contracts

### Server boundary and sessions

Browser uses same-origin `/admin/api/*` only. Login is server-mediated Supabase email/password authentication. Store access/refresh credentials encrypted at rest in a private server session table; the browser receives an opaque random session cookie, with only its hash stored for lookup. Encryption keys/configuration belong in ignored local secrets, not Git, fixtures, logs or bundles. Serialise refresh per session and test token rotation/reuse, not concurrent refresh races.

Use HttpOnly, SameSite=Lax, host-only cookies, path `/admin`, session ID rotation after login/recovery, and Secure cookies under HTTPS. A clearly isolated loopback-HTTP mode omits Secure solely for local testing; production mode must refuse insecure origin/configuration. Enforce 30-minute idle and 12-hour absolute limits server-side; invitations/revocations require password reauthentication within five minutes. Logout revokes the application session immediately and attempts provider sign-out; revoke all application sessions after password reset/access revocation, with retryable provider cleanup. Provider outage never turns an invalid session valid.

Every mutation requires session/member checks, strict Origin validation and CSRF token validation, including login/logout where applicable. Strict callback/redirect allowlists; no arbitrary `next` URLs. Generic login/reset responses, persistent IP/account rate counters (not process-local memory), backoff and redacted audit events. Initial configurable limits: five failed sign-ins per account and twenty per IP per 15 minutes; reset requests three/account and ten/IP per hour; invitations ten/administrator per hour. Test limits, concurrent counters and account-enumeration responses. Do not trust forwarded IP headers outside a configured proxy. CAPTCHA integration remains a separately approved hosted gate; local challenge tests cannot prove provider protection.

Tie each approved application session to the Supabase JWT `session_id` and user ID. Database/Storage policy helpers require that current session plus active membership and unexpired server-side times; fail closed if JWT session ID is missing. This prevents direct API use of a revoked but unexpired JWT. Ordinary content operations use a user-context Supabase client so RLS remains effective, rather than a universal service-role client. Privileged Auth calls use a separate server-only module after permission checks. No member can directly insert a session or membership to promote themselves. Supabase's token lifecycle is documented in [sessions](https://supabase.com/docs/guides/auth/sessions); application limits/revocation still require our enforcement.

### First administrator, invitations and recovery

A maintainer-only CLI refuses non-local targets for this stage. Under a singleton database lock it permits a bootstrap reservation only when no active administrator and no valid bootstrap reservation exists. It creates a pending membership/invitation, sends a Supabase invitation to a disposable identity captured in Mailpit, and records recoverable send failure without leaving an active administrator. A documented retry resumes that reservation; no public bootstrap URL and no normal browser first-admin setup.

The recipient deliberately accepts the invitation and sets their own password; activate membership only after verified identity, current invitation generation, expiry and password completion pass. The first administrator invites the second account through the dashboard. Every active administrator then has identical abilities. Existing members and duplicate/pending/revoked invitations have explicit states; do not treat an Auth user as an administrator automatically.

Use Supabase invitation verification with local custom email templates linking to a fixed server callback. Add an application invitation generation/nonce stored only as a hash; cancellation/resend invalidates the old generation even if a provider token is still valid. Proposed invite expiry: 24 hours, bounded by provider expiry. Callback GET shows a confirmation step with no third-party resources; explicit POST performs token verification. Provider tokens never go into localStorage, public assets or logs; callback pages use no-referrer/no-store and clear sensitive URL parameters before ordinary navigation. Replayed, expired, wrong-email and cancelled links fail closed. [Supabase invitation API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) is the provider mechanism, not the authorisation policy.

Password reset uses a separate, short-lived, one-use recovery context: it can set a new password, not edit content or invite users. Membership must still be active to resume administration afterward. Disable all other application sessions after success. Disable public registration/anonymous login in Auth configuration and test direct signup rejection, not just absence of a button.

Admin list shows active, pending, expired/revoked access and invite actions. A locked transactional command checks active-member count before revoke/disable, including self-revocation and two concurrent cross-revocations. Pending accounts never count as active. Audit the actor, target, outcome and timestamp. Platform/database owners can still override data; that privileged maintainer capability is separate from equal application permissions.

### Persistent content, media and revisions

| Tables/domain | Purpose and write boundary |
| --- | --- |
| `admin_memberships`, `admin_invitations` | Invite-only access state. Changes only through narrowly granted transactional commands; no direct member writes. |
| `admin_sessions`, `auth_attempts`, `security_events`, `auth_jobs` | Server-private encrypted tokens, rate counters, redacted audit and retryable invitation/revocation operations. Auth network calls are not falsely treated as one atomic Postgres transaction. |
| `content_items`, `content_revisions` | Typed `homepage` singleton and blog records. Immutable revisions, current draft revision, author/time and optional trash timestamp. No browser-controlled published state. |
| `media_items`, `media_versions`, `media_usages` | Descriptions/alt text, tags/folders, provenance/licence, focal point, checksum, upload state, immutable private object versions and revision references. |

All editorial tables use RLS and least-privilege grants. Anonymous requests and authenticated non-members get no records. Security-definer functions use fixed safe search paths, explicit actor/session checks and revoked public execution privileges. Service keys never appear in browser code. Audit/revision history is append-only to application users. Test actual anon/authenticated SQL/REST/Storage access, including forged metadata and JWTs containing obsolete roles. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) applies alongside database rules.

`saveDraft({id, kind, baseRevision, payload})` validates the existing constrained homepage/article structures on server and database transaction boundary, then atomically compares the base revision. Return the new revision on success; HTTP 409 on conflict, with an authorised comparison/reload/copy flow. Never blind overwrite. Editing metadata, deletion and restoration also require base revisions. Do not silently import browser-local drafts; explicit validated import previews a diff, saves as a new draft and keeps review-only provenance immutable by ordinary edits.

Keep current three product/service cards, copy limits, section order, typography and layouts. Store additional company-profile fields without automatically rendering them. Introduce a validated media reference alongside existing fixture-cover compatibility; do not turn legacy articles into unrestricted HTML. Separate immutable baseline/public snapshots from mutable drafts. Static builds continue from the approved baseline, never query the editing database, and keep current production/publication safeguards.

Uploads: up to ten files per batch, each <=10 MiB, JPEG/PNG/WebP only, at most 24 megapixels; decoder-verified type/dimensions with bounded processing concurrency. Reject SVG/GIF/HTML and extension/MIME mismatches. Strip metadata by re-encoding, normalise orientation and create a private preview derivative using `sharp`; keep original bytes private and never serve originals as preview content. Plan responsive published derivatives for Stage 3. Random immutable object IDs, no overwrite-in-place; replacement creates a version. Quarantine incomplete files; only a fully validated upload becomes selectable. Private objects require an active session on storage access; use a server-authorised media proxy for previews so revocation applies to later requests, rather than distributing lasting signed URLs. Cancellation/failed finalisation cannot leave visible records; cleanup must not delete referenced versions. No third-party image URL fetcher/SSRF path.

Whole-page/article preview renders a specific **saved revision**, through existing templates, on the admin origin after authorisation. No public bearer preview URLs, no automatic access through article slugs, no raw original photo URLs. Apply no-store/private, noindex, no-referrer, no service-worker caching and session checks to document and media requests. Links stay in the private preview context where needed; reject unsafe navigation and prohibit forms/scripts from content. Stage 1 public output remains independent of Supabase outages.

Every successful save/metadata change writes an immutable revision. Provide history comparison and restore-to-new-draft, plus soft delete/restore for content and photos; referenced media cannot be permanently removed. Do not build retention purges now. Stage 3 adds 90-day revision/30-day trash cleanup, scheduled independent backups and full disaster recovery. State clearly that revisions and Docker persistence are not independent backups; Stage 2 is for disposable content until the Stage 3 backup gate passes. A maintainer takes local DB-plus-photo exports before destructive operations and tests a restore into an isolated local project; no laptop-always-on or scheduled-backup claim.

## Implementation sequence and acceptance checks

For each task: write the named failing tests, run the specific suite to confirm the failure, implement the smallest change, rerun it and existing checks, review the diff and save a local commit only after approval of implementation. Never weaken unrelated preservation/security tests.

### Task 1 — Reproducible local backend and deny-by-default schema

**Create:** `supabase/config.toml`, `supabase/migrations/202610160001_stage2_foundation.sql`, `supabase/tests/permissions.test.sql`, `server/config.mjs`, `.env.example`, `tests/admin/config.test.mjs`, `docs/LOCAL-ADMIN.md`.
**Modify:** `.gitignore`, `package.json`, `package-lock.json`; keep generated CLI files, exports and credentials ignored.
**Interface:** `loadAdminConfig(env)` validates loopback origin/URLs and required server secrets; `has_active_admin_session()` supplies the shared SQL authorisation predicate.

- [ ] Verify branch/runtime/ports/resources, then pin/install approved dependencies and initialise only the local Supabase project. Configure email-only Auth with signup disabled and Mailpit templates; no production SMTP or CLI login/link.
- [ ] Test: missing keys/non-local URL refuse startup; anonymous and authenticated non-member cannot read/write each editorial table/bucket or execute privileged functions.
- [ ] Apply versioned migrations and restricted grants/RLS to a disposable local project; no default administrator/password seed. Seed approved homepage as a draft/baseline snapshot, sample posts explicitly review-only.
- [ ] Run proposed `npm run check:admin:unit` and `npm run check:db` (CLI `supabase test db`). Verify schema recreation from migrations and ensure `.env`, runtime exports and credentials never enter dist or Git.

### Task 2 — Secure server sessions and real sign-in/logout

**Create:** `server/index.mjs`, `server/auth/{sessions,guards,rate-limits,provider}.mjs`, `server/http/{router,errors,csrf}.mjs`, `admin/auth.mjs`, `admin/index.html`, `tests/admin/auth.test.mjs`, `supabase/tests/sessions.test.sql`.
**Interface:** `requireAdmin(request)` returns verified actor/session; `requireRecentAuth(request)` enforces five-minute reauthentication; all later API routes use these guards. Browser receives an opaque cookie, never provider tokens.

- [ ] Test login failures, generic responses, account/IP counters across restarts, malformed/expired/rotating cookies, CSRF and redirect attacks.
- [ ] Implement encrypted server token persistence and serialised refresh, idle/absolute limits, session fixation protection and logout revocation. Add functional sign-in/logout controls without redesigning the editor.
- [ ] Test expired idle/absolute sessions and logout using old cookies **and** old provider JWTs directly against database/Storage. Verify DB helper/session-time enforcement cannot be bypassed and logs/bundles contain no tokens.
- [ ] Run unit/SQL tests plus local browser sign-in/logout; assert exact cookie flags for loopback mode and HTTPS configuration separately. Real deployed HTTPS remains untested.

### Task 3 — First administrator, invitations, reset and access management

**Create:** `scripts/bootstrap-local-admin.mjs`, `server/auth/{invitations,recovery,administrators}.mjs`, `server/jobs/auth-jobs.mjs`, `admin/administrators.mjs`, `supabase/migrations/202610160002_admin_commands.sql`, `tests/admin/accounts.test.mjs`, `tests/admin/mail-flows.test.mjs`.
**Interface:** transactional membership/invitation commands and idempotent auth-job IDs; account actions never accept a browser-supplied actor ID as authority.

- [ ] Test bootstrap reservation races/retry, refusal once active, direct signup rejection and failure cleanup before enabling setup CLI.
- [ ] Build local invitation acceptance/password setting, admin list/invite/resend/cancel/revoke, and reset-only recovery flows using Mailpit; no fake actions or emailed temporary passwords.
- [ ] Test two equal accounts; wrong-recipient/cancelled/expired/replayed links; passive link GET versus explicit acceptance; provider send failures/retries; generic unknown-user reset; password-reset session invalidation.
- [ ] Run concurrent last-admin revocation and stale-token access tests directly at DB/API/Storage. Test revoked user's recovery link cannot restore membership. Mark real SMTP/CAPTCHA/delivery untested.

### Task 4 — Persistent editing with server validation and conflict protection

**Create:** `server/content/{repository,routes}.mjs`, `admin/content-api.mjs`, `admin/editor.mjs`, `scripts/build-admin.mjs`, `tests/admin/content.test.mjs`, `supabase/tests/content.test.sql`.
**Reuse:** `local-editor/writer.mjs`, `local-editor/company-fields.mjs`, existing editor HTML/CSS structure; extract only shared functional helpers if needed. **Modify:** `src/content/schema.mjs` only for separately validated persistent/media contracts while retaining all legacy validations.
**Interface:** `getDraft(id)` and `saveDraft({id,kind,baseRevision,payload})`; return `{id,revision,savedAt,payload}`, conflict is HTTP 409. Admin bundle is outside `dist/`.

- [ ] Test company/product/service/blog writes survive browser restart and normal backend stop/start, with read-only public baseline unchanged.
- [ ] Adapt Save/settings/import/export to real API persistence, explicit Draft/not-live states and no publishing controls. Editing email changes a draft only. No silent localStorage fallback/cache of private drafts.
- [ ] Test Tiptap safe-link/heading/list round-tripping, legacy block compatibility, malicious JSON/HTML, validated imports and immutable review-only provenance. Browser-local export is deliberate, warned as private and never uploaded automatically.
- [ ] Test two administrators saving the same content/metadata: one succeeds, stale one receives 409 with copy/reload options; failed network/session expiry leaves writer text in memory. Verify unsaved navigation/logout warnings and keyboard/error focus.

### Task 5 — Private photograph library and revision-specific previews

**Create:** `server/media/{uploads,processing,routes}.mjs`, `server/content/preview.mjs`, `admin/photographs.mjs`, `tests/admin/media.test.mjs`, `tests/admin/preview.test.mjs`, `supabase/tests/storage.test.sql`.
**Modify:** `src/content/schema.mjs`/renderer image input only where necessary to accept validated private-preview media URLs without altering default output/layout.
**Interface:** start/upload/finalise/cancel endpoints scoped to an actor and immutable media version; `/admin/preview/:kind/:id?revision=N` and authorised `/admin/media/:version` never map into public build paths.

- [ ] Test signature/extension mismatch, SVG/HTML, corrupt images, oversized bytes/dimensions, orientation/GPS stripping, interrupted upload and restart/cancellation; finalisation rechecks access and object ownership.
- [ ] Add real progress/retry/cancel, library tags/description/alt/provenance/focal point, replacement/usage references and revision conflict checks. Validate accessibility-required alt text for selected meaningful photos.
- [ ] Render saved article/homepage previews with original templates/reading width and private derivatives. No public article fixture is created for private content; unsaved preview asks the editor to save first.
- [ ] Test anonymous/non-member/revoked direct object access, cached preview headers, old-cookie preview requests and no media/draft/secret leakage into static artifacts. Verify browser phone camera/library selection, desktop upload and image crops with supplied/disposable photos.

### Task 6 — Recoverable drafts, integration and handover

**Create:** `server/content/revisions.mjs`, `admin/history.mjs`, `tests/admin/recovery.test.mjs`, `tests/admin/e2e.test.mjs`, `scripts/export-local-content.mjs`, `docs/LOCAL-RECOVERY.md`.
**Modify:** HANDOFF.md, README.md and the local-admin runbook.
**Interface:** `restoreRevision({id,revision,baseRevision})` creates a new draft; trash restore also uses compare-and-swap. Export is maintainer-only and includes DB content/revisions plus actual private photo bytes/checksums.

- [ ] Test history immutability; restore an earlier version without replacing newer revision history; soft delete/restore photos/content; stale restore conflict; referenced media purge denial. No restore publishes.
- [ ] Test isolated local DB/photo export/restore and checksum/reference equality; never run restore over the active project. Document who operates exports (technical maintainer), what is not backed up and the Stage 3 launch backup gate.
- [ ] Run `npm run build`, all existing checks, proposed admin unit/SQL/integration/browser suites. Test two browsers, 375/768/1440px, keyboard navigation, password-manager paste, session/network loss and conflict recovery. Check static output excludes admin/editor/private previews/drafts and compare approved public HTML/CSS to the Stage 1 checkpoint.
- [ ] Record actual passes, skipped tests and host-only checks, then stop for Stage 2 review. Do not merge, enable publishing or proceed to Stage 3 automatically.

## Proposed verification commands (to be added during implementation)

- Existing: `npm run build`, `npm run check`, `git diff --check`.
- New: `npm run check:admin:unit` (pure/server unit tests); `npm run check:db` (local pgTAP/RLS tests); `npm run check:admin:integration` (Auth/DB/Storage/Mailpit); `npm run check:admin:browser` (two-context flows and mobile/desktop).
- Integration tests require an explicitly disposable local project and refuse hosted/non-loopback targets. Reset operations must not erase a user's development drafts. Database/Storage policy tests cannot be replaced by mocked guard tests.
- Dist/privacy scan covers known draft sentinel strings, all selected photo object paths, provider/app tokens and admin bundles; sample review content retains the existing publication blocker.

## Decisions and review checklist

**Recommended defaults:** existing editor/renderer; separate local Node server; project-pinned stable CLI and Docker; Mailpit disposable identities `owner@example.test` and `father@example.test`; equal invite-only permissions; server cookies/RLS session checks; private re-encoded previews; version-based conflict rejection; basic draft history/trash now with scheduled retention/backup in Stage 3. Keep real administrator emails/passwords out of this planning task.

**Owner setup checks before implementation:**

- [x] Owner created `stage-2-secure-content`; agent verified it on `effda56` (agent Git writes remain blocked).
- [ ] Confirm `docker info` succeeds in the owner's terminal, free resources and accept local CLI/image/dependency/browser downloads after plan approval. If the agent still cannot access Docker, the owner runs explicitly documented local backend/test commands and provides sanitised results; unavailable integration tests are reported, never assumed green.
- [ ] Approve this Stage 2 plan and local-only setup. No provider/domain choice or real invitation addresses are required now; no passwords in chat.

**Still intentionally untested:** Docker service startup/ports, migrations, local Auth/Storage behaviour and all new Stage 2 checks (nothing implemented), hosted HTTPS cookies/callbacks, real SMTP/spam delivery, live CAPTCHA, hosted quotas, deployment and independent scheduled backups. Memory/socket access are prerequisites, not reasons to relax controls or use cloud resources.

**Review boundary:** this document and HANDOFF.md are the only planned file changes in this turn. No Stage 2 code, dependency installation, external account, SMTP configuration, tracking, public publishing or remote push.
