# Farm Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the owner-approved Approach A administrator workspace locally, preserving protected routes and tested editing/authentication behaviour.

**Architecture:** Shared server-rendered navigation and shared local CSS/browser helpers compose with existing screen handlers. Overview data comes from the current authenticated content endpoint; filters work only on loaded records. The writer, account/session services and provider protocols stay in place.

**Tech Stack:** Node ES modules, browser ES modules, CSS, existing Tiptap/esbuild and Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-21-farm-workspace-design.md` — owner approved 21 November.

## Global Constraints

- Stage 2 remains incomplete; migration 011 and hosted verification are deferred. No migrations 001–010 rerun, provider operations, mail, remote push or deployments.
- Reuse existing Node frontend/Tiptap and dependencies. Preserve cream/forest brand and centred acceptance/session composition.
- Preserve private/no-store/noindex/CSP/CSRF, session guards, pagehide cleanup, writer validation, conflict/uncertain-write protection and feature gates.
- Never substitute dummy data for failed API reads, expose credentials or include proposal fixtures in hosting output.
- Mobile uses natural scrolling, approximately 20px gutters, 16px input text and 44px primary touch controls; verify 375/390/768/1024/1440px and 200% zoom.

## Review Focus

- Disabled media/account features must not leak links or new route capabilities (Task 1).
- A failed or stale overview request cannot render an empty/successful list or repopulate after pagehide (Task 1).
- Filter Cancel/Escape leaves applied state intact, including after an empty result (Task 2).
- Content hash navigation must preserve existing unsaved-change guards, including rejected navigation (Task 2).
- Form errors/uncertain writes retain entered edits while credentials still clear at security boundaries (Tasks 2–3).

### Task 1: Shared shell, asset integration and authenticated overview

**Files:** Create `server/workspace/shell.mjs`, `server/workspace/overview-screen.mjs`, `admin/workspace/screen.css`, `admin/workspace/overview.mjs`; modify `server/application.mjs`, `server/browser-assets.mjs`; test `tests/admin/workspace.test.mjs`.

**Interfaces:** `workspaceNavigation({active,mediaEnabled,accountsEnabled}) -> HTML`; `createOverviewScreenHandler(config,{auth,assets,mediaEnabled}) -> request handler`. Consume existing `GET /admin/api/content` and `POST /admin/api/logout`, with the existing session browser controller retained for logout.

- [x] Write failing tests for authenticated/anonymous overview, nonce/CSP/no-store, escaped identity, feature links, unavailable data and browser asset registration.
- [x] Run `node --test tests/admin/workspace.test.mjs`; observe failure before implementation.
- [x] Add shell/overview handlers and real-data client, reusing session logout DOM contract; serve shared assets through a strict same-origin GET-only route without broad asset exposure.
- [x] Run workspace and application/session/content screen regressions; require exit 0.
- [x] Commit the self-contained shared workspace/overview slice locally.

### Task 2: Draft editor, navigation and applied-state filters

**Files:** Create `admin/workspace/filters.mjs`; modify `server/content/content-screen.mjs`, `admin/content/client-entry.mjs`, `admin/content/screen.css`, `server/browser-assets.mjs`; test `tests/admin/workspace-filters.test.mjs` and existing content tests.

**Interfaces:** Pure `filterDrafts(rows,{search,edited},now=new Date()) -> rows`; pure `filterPhotos(rows,{orientation,uploaded},now=new Date()) -> rows`; `mountFilters({root,onApply}) -> {destroy()}` manages native dialog Apply/Cancel/Clear. Existing writer API and content commands remain unchanged. Validated hash destinations are `posts`, `company`, `products` and `new`; unknown values fall back safely.

- [ ] Write failing tests for loaded-record search/calendar dates/missing metadata, filter state reducer Apply/Cancel/Clear, and unsupported input rejection/defaults.
- [ ] Run `node --test tests/admin/workspace-filters.test.mjs`; observe failure.
- [ ] Add filter helpers/dialog and editor integration; align shell/layout; preserve existing writer, reload/reconcile/save guards. Add field-level errors based on current validators, and prominent typed feedback retaining current error text.
- [ ] Test hash destination/dirty-state recovery and empty-filter versus request-failure behaviour using isolated browser fixtures; run targeted Node checks.
- [ ] Commit editor/navigation/filter slice locally.

### Task 3: Photo/account/session alignment

**Files:** Modify `server/media/media-screen.mjs`, `admin/media/client.mjs`, `admin/media/screen.css`, `server/auth/accounts-screen.mjs`, `admin/accounts/screen.css`, `admin/session/screen.css`; extend shared CSS and relevant tests.

**Interfaces:** Reuse Task 1 navigation and Task 2 filters. Photo filtering consumes validated existing dimensions/`createdAt`, not invented names/tags. Account and session controller element IDs/protocols stay intact.

- [ ] Add regressions for photo orientation/date states and inaccessible features, real upload validation errors and preserved account/session security contracts; observe failures.
- [ ] Integrate responsive photo/account shells and shared control/feedback styling; keep centred acceptance/sign-in, controlled media upload/removal and existing account gates.
- [ ] Run targeted media/account/session regression tests, requiring exit 0; record browser limits separately.
- [ ] Commit the coherent remaining surface changes locally.

### Task 4: Integration verification, visual review and handoff

**Files:** Local fixture/review tooling as needed under `scripts/`/`tests/admin/browser/`, plus `HANDOFF.md`, `docs/STAGE-2-CHECKLIST.md`, `docs/PROJECT-BUILD-TRACKER.md` and design master addendum.

- [ ] Run full administrator suite sequentially, then public/editor suite, then hosting build/checks where affected; inspect each final summary/exit status.
- [ ] Capture desktop/mobile renders and exercise actual filter/dialog/form/navigation interactions with dummy fixtures; check overflow/zoom/focus and pagehide guards. Do not treat headless rendering as screen-reader or hosted proof.
- [ ] Obtain one fresh whole-change review; resolve material issues with failing regression then passing checks.
- [ ] Update evidence and remaining gates; keep photo candidates individually unapproved, hosted 011/auth recovery deferred and whole project incomplete.
- [ ] Commit verified integration and report local results, limitations and next work. Do not merge/push/deploy.

## Execution notes

Owner approved concrete design after requesting implementation; direct local execution continues under that standing authorisation. Current clean branch `stage-2-secure-content` is the dedicated isolated project branch, not main. Reuse it to preserve the owner's working directory and checkpoint; no second checkout is needed. Homepage photo selection and later publishing/backups/reporting remain separate scopes. Task interfaces were cross-checked: shared navigation feeds all protected shells; filter helpers consume existing content/media shapes; no new backend migration is required by this UI plan.
