# Farm workspace — Approach A design

21 November 2026. **Approach A and this written implementation scope approved by owner, 21 November 2026.** Visual reference: `design-system/ohajiugwo-organic-farms/proposals/workspace-review.html` with Approach A selected. This document describes the next local UI implementation slice, not completion of the entire project.

## Intent and alternatives

Give occasional farm administrators a calm, coherent place to write, organise photographs and manage access. Keep the farm recognisable through the original logo, cream/forest palette and existing fonts. Adopt Linear's navigation/form discipline, Airbnb's filter interaction and Notion's page hierarchy; do not import their branding, backend, assets or business concepts.

The owner selected **A: Farm workspace**, with compact navigation and a spacious editorial content canvas. **B: Compact operations** fits more records on screen using tighter rows and smaller sans-serif headings, but gives writing less room. A is the source of truth for implementation; B stays a disposable comparison, not a second supported theme.

## Scope and architecture

Reuse the current Node ES-module rendering, plain CSS/browser modules, Tiptap writer, content validators and protected HTTP service boundaries. No framework rewrite, Bootstrap, new UI library or dependency is required. Create a small shared admin shell/style layer and adapt the current screen renderers rather than copying the throwaway prototype into production.

Primary existing surfaces are `server/auth/session-screen.mjs`, `server/content/content-screen.mjs`, `server/media/media-screen.mjs`, `server/auth/accounts-screen.mjs` and their respective `admin/` browser/style modules. Register any new shared assets through the existing asset/build machinery. Exact helper names and module layout are builder decisions, constrained by the existing routing/security model.

### Shared navigation and overview

- Desktop: restrained left navigation, original symbol/wordmark, clear active-page state and breadcrumbs; forest text, thin dividers and quiet cream surfaces. Main content gets the space rather than oversized navigation or ornamental charts.
- Navigation exposes Overview, Posts, Company information, Products & services, Photo library and Administration. Keep current route contracts (`/admin/`, `/admin/content`, `/admin/media`, `/admin/accounts`, password confirmation/sign-out); the content client may use validated hash/query state to open its existing panels without losing unsaved-change protection. A link must open the named panel, not an unrelated article, unlike the reduced demonstration.
- Replace the signed-in placeholder at `/admin/` with an authenticated overview. Provide quick actions for writing, homepage fields and photos plus a bounded recent-drafts list from the existing authorised content list. The prototype's titles, counts and “edited today” labels are dummy data and must not be copied as live content.
- Use existing returned timestamps only where present and valid. Omit unsupported freshness claims and counts. Empty data says “No drafts yet”; request failures say “Drafts couldn’t load” with reload/retry and do not masquerade as an empty list. Draft previews or shortcuts do not publish.
- Keep sign-out, current identity, recent password confirmation and account access easy to reach. Feature-gated surfaces remain hidden/disabled according to existing configuration and actual permission state.
- Website insights says “Not configured” until a real reporting integration exists. Do not introduce chart samples, green health indicators, a persistent task manager, customisable blocks or operational metrics in this slice.

### Editing and forms

- Keep the actual rich-text writer, supported formatting, link/image constraints, fixed homepage fields, validation limits, saved revisions/history, restore/trash/undo rules and unsaved-change protection. The plain textarea in the proposal is a spacing example, not a replacement for Tiptap.
- Use visible labels, short help text, clear grouping and one primary action per context. Put article settings alongside the editor when space permits and below it on narrow screens. Avoid nested ornamental cards, heavy shadows and excessive rounding.
- Apply the coherent form styling to company/products/services, photo upload/existing metadata presentation and account/session forms. Preserve the previously approved centred acceptance/sign-in/password-confirmation composition: typography, control/feedback consistency may align, but no split layout or new authentication flow is introduced.
- Error area: pale red, dark red text, icon and short heading; explain both problem and next action. Mark invalid controls and place messages directly below them, linked by `aria-describedby`/`aria-invalid`. Preserve correctable content values. Password/token clearing on pagehide, completion, rejection or security boundaries remains as currently required; “preserve values” is not permission to retain credentials.
- Distinguish informational/success/retry/conflict states using words and icons as well as colour. Announce status/errors appropriately and move focus after failed submission without duplicate alerts. Keep focus stable while typing and preserve password-manager/paste support.
- A definite transient failure may offer a safe retry. An **uncertain write** must retain edits, block blind repeat submission and offer checking/reloading the saved version according to existing reconciliation behaviour. A stale revision must keep unsaved edits and explain preservation/reload choices; never silently overwrite or discard.
- Completed/rejected invitations must retain the corrected terminal-state wording and never show stale password-entry instructions. Real account/email operations are not exercised during local UI work.

### Filters and lists

- Apply the Airbnb-inspired pattern to drafts and the photo library: prominent labelled filter control, grouped options, visible applied state, Clear and explicit Apply. Desktop uses a dialog; mobile uses an intentionally sized bottom sheet with scrollable contents and reachable actions. Never introduce booking, pricing, map or guest controls.
- Search and filters operate over the existing successfully loaded authorised list. Draft filters initially use supported record kind and `updatedAt`; compute Today using the browser’s local calendar and ignore invalid/missing timestamps for that filter. Photo filters use returned `metadata.width`/`height` for landscape/portrait/square orientation and valid `createdAt` for upload date. All served derivatives are WebP, so omit a meaningless format selector. No photo name, caption, tags, alt-text editor or usage filter is exposed until its storage/API contract is implemented in a later local media slice; the current list does not return those fields. Do not create database changes to achieve a visual filter.
- Matching is local to the loaded result set and labelled accordingly if the service is bounded/paginated. Do not claim global totals. Empty results provide Clear/search recovery. A service error is distinct from zero matches.
- Opening the dialog starts with applied values; Cancel/Escape preserves them, Apply commits them, and Clear affects only filter/search state. Restore focus to the opener on close. On mobile, allow content scrolling without losing the action footer. Keyboard and pointer users can use every control.

### Responsive and brand rules

- Existing tokens: forest `#203e30`, deep `#173226`, cream `#f8f6ef`, paper `#eeede4`, sage `#dfe5d7`, muted `#596459`, earth `#9a7049`, divider `#d6dacd`, focus `#aa672e`. Keep semantic error/retry tokens with verified text/background contrast.
- Keep local Lora headings and DM Sans controls/body, plus the existing logo's Manrope/Source Serif lettering. Use the shared logo renderer and unchanged symbol; no recolouring/tracing or replacement wordmark. New icons should be consistent small local SVGs, not the prototype's Unicode stand-ins.
- Restrained 3–5px control rounding; rounded filter chips/dialog sheet corners are allowed for recognition. Flat surfaces and borders; no heavy shadows, decorative dashboards or motion dependencies.
- Mobile: natural vertical scrolling, approximately 20px side padding, single-column forms, readable inputs at least 16px, primary touch controls at least 44px high. Collapse navigation intentionally without hiding routes or blocking the keyboard. No vertical centring that fights an on-screen keyboard, horizontal page overflow or zoom restrictions.
- Use content-driven responsive breakpoints; verify 390px and 1440px as reference sizes plus 375/768/1024px, 200% zoom and long labels/content. Maintain 4.5:1 normal text contrast, visible focus, reduced motion and semantic heading order.

## Homepage photography and later work

The owner authorised more realistic context-matched homepage photography, while keeping approved layout/copy/section order, branding and earlier footer/overlay removals. Treat this as the next reviewable slice after admin fundamentals; the two prototype stock examples are **not individually approved replacements**. Prefer authentic owner photography when available, otherwise select licensed documentary stock with crop/region context reviewed. Keep provenance/alt metadata accurate and never represent stock people/land as this farm. Avoid staged isolated fruit, exaggerated images or invented evidence of organic certification. Confirm images visually and document licence/source before replacing public references; reserve dimensions and use responsive formats/crops with eager hero/lazy other assets.

Full local publishing/release/recovery/backups and reporting remain in `docs/PROJECT-BUILD-TRACKER.md`; this UI approval does not silently choose their detailed provider or operational policies. They require subsequent concrete implementation scopes, retaining local-first authorisation and deferred hosted checks. A reporting placeholder is not completion of reporting.

## Security and hosted boundaries

Stage 2 remains incomplete. Keep migration 010's owner-run result and migration 011's pending status, existing environment/session key, credential handling, private/no-store/noindex responses, CSP, server authorisation, CSRF, content/media isolation and session cleanup semantics. Reuse current protected commands and deny-by-default routes. Do not add fixture fallbacks, public preview media, raw HTML support or browser service credentials. Any security/API deficiency discovered must be fixed and regression-tested without weakening the gate.

No hosted SQL, review-job acknowledgement/requeue, real account/email, SMTP/provider change, deployment, remote push, purchase or main merge is included in this local implementation slice. Already scheduled development infrastructure remains as last configured; this spec does not disable or redeploy it. Preserve `.env.admin` and its session key and never expose credentials. No rerun of migrations 001–010; pending 011 returns later at the preserved checkpoint.

## Verification and acceptance

Run meaningful targeted regressions for authenticated overview/asset access, real-data empty/error states, filter Apply/Cancel/Clear, field/focus feedback, retained edits/conflict/uncertain saves, navigation/unsaved-change guards and disabled capability states. Run full administrator/public/editor suites sequentially after integration and check hosting assembly/asset exclusion where affected. Do not repeatedly run unrelated expensive checks without cause.

Capture desktop/mobile local screenshots and exercise keyboard, dialog Escape/focus return, Enter/Space, 200% zoom, overflow and relevant form states using isolated fixtures/browser tooling where available. Label source inspection, headless screenshots, automated interactions, owner manual and screen-reader/physical-device evidence separately. Do not claim hosted verification, email delivery, genuine persistence or cleanup recovery from fixture tests. Keep prototypes and their dummy data out of deployed artifacts and real dashboard output.

Acceptance of the slice requires working authenticated overview/navigation and existing forms/editor/media/account flows with the selected design, honest status handling, passing relevant regressions and documented visual/accessibility gaps. Update HANDOFF/checklist/tracker with local versus hosted evidence. Stage 2 and the whole project remain incomplete until their independent gates pass.

## Decisions left to the implementer

Choose internal shared helper/component names, exact spacing within the approved visual, responsive thresholds, content-list timestamp availability handling, SVG artwork and test-fixture organisation. Reuse existing dependencies. Do not ask the owner to settle routine coding decisions. Ask only if actual source constraints change functionality/scope or if a specifically gated hosted operation becomes necessary.

## Builder review

A fresh independent builder reviewer read this specification and reported “nothing important left”. Source follow-up confirmed content returns `updatedAt`, and media returns dimensions/byte size/MIME/`createdAt` but no editable names/alt metadata; filter scope above is limited accordingly. This review establishes planning clarity only, not product implementation, accessibility or hosted verification.
