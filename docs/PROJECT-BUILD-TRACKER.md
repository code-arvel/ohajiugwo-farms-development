# Whole-project build tracker

21 November 2026. Owner requests completing local construction before returning to deferred hosted verification. This inventory is not a claim that Stage 2 is complete, a replacement for the approved architecture, or permission to launch. Checkpoints in HANDOFF.md take precedence over historical plan checkboxes.

## Current sequence

1. Review the disposable UI proposal, select spacious A or compact B, and approve the resulting design specification before product UI changes.
2. Implement the shared administrator shell, overview, forms and filters by reusing the current frontend, editor and protected API contracts. Keep local regression checks alongside changes.
3. Review contextual homepage photo candidates and replace only approved selections, with provenance, responsive sizes/crops, descriptive alternatives and source/licence records.
4. Finish remaining local publishing/recovery operations against isolated fixtures and mocked transports: reviewed change summary, immutable release manifest, build/deploy coordination, failure recovery/rollback, retention and independent encrypted backup/restore workflows. A functional publish button must not be enabled against hosted services by this work.
5. Finish the reporting/dashboard adapters and explicit not-configured/loading/empty/error/stale states; implement consent and instrumentation locally without activating real analytics. Never fabricate operational or visitor metrics.
6. Resume pending hosted migration/HTTP/provider/browser/recovery checks at the preserved checkpoint. Reconcile all evidence before any merge/release/completion claim. Review production domain, credentials, automated publishing and backup responsibilities before live setup.

## One inventory, with separate evidence

| Area | Existing local construction | Remaining local work | Hosted / owner gates |
| --- | --- | --- | --- |
| Brand and public website | Approved homepage, Blog, shared logo, renderer and editor | Context-matched photography replacements; preserve approved layout/copy and footer/overlay removals | Owner image selection; final responsive image/layout review |
| Admin workspace | Working draft/account/media interfaces; admin home placeholder | Approved shared shell, Notion-inspired overview, Linear-inspired forms/list organisation, Airbnb-inspired filters; loading/empty/failure states | Visual approval of proposal first; regression and real-device accessibility remain distinct |
| Accounts and sessions | First-admin, acceptance, sign-in, reauthentication, account inventory/lifecycle and reset components exist | Resolve implementation gaps exposed by recovery/provider checks; preserve security during UI changes | First admin accepted/signed in and basic account checks owner-verified; equal-admin/reset delivery, old-JWT/cross-session/concurrency gates remain |
| Durable Auth cleanup | Journal/worker and read-only review diagnostic implemented locally; last full admin run 210/210 passed on 14 November | Root-cause diagnosis followed by an evidence-based recovery path; no blind requeue or false acknowledgement | Three revoked application sessions still have provider rows; **011 prepared, not confirmed applied**; full SQL test and private HTTP inspection deferred |
| Persistent editing | Save/load, revision history, restore/trash and explicit PT409 conflict handling | Recheck affected flows after redesign; independent-user and failure-recovery cases | Owner verified persistence/restoration and two-tab winning-save protection; broader races remain |
| Private media | Upload, private previews, derivative processing, usage protection and cleanup implemented | Recheck redesigned library, metadata and accessibility; abandoned-upload and recovery cases | Owner verified upload/reference protection/removal; automatic cron deletion verified for one new unused image; broader format/race/recovery checks remain |
| Publishing and retention (Stage 3) | Shared rendering/build baseline; see approved original proposal | Inspect actual source before filling gaps: release snapshots/change review, guarded publishing, rollback, retention, backup/export/restore and failure recovery | No automatic publishing/production launch enabled by this request; backup destination/owner, credentials, scheduler and restore drill require verified setup |
| Reporting (Stage 4) | Public architecture and reporting requirements documented | Source-specific dashboard adapters, consent/instrumentation, date/freshness/error states and local checks | Analytics/monitoring provider setup and real events not verified; show Not configured until real evidence exists |
| Hosting/release | Development Pages Preview, internal image Worker and private scheduled cleanup Worker recorded | Preserve environment separation/artifact exclusions; finish release runbook and local readiness checks | Existing free development infrastructure is not production readiness. Production configuration/launch and any paid services require a concrete reviewed action |

## Proposal review

Open `design-system/ohajiugwo-organic-farms/proposals/workspace-review.html` in Brave. It works as a local file and offers screen, desktop/mobile and A/B density selectors. The inner full-size page can also be opened directly. All sample records and state transitions are simulated and disappear on reload. There is no fetch to project APIs, browser persistence or live save. Stock references load from Pexels/Unsplash and need internet access; they do not depict this farm.

References reviewed: [Linear](https://linear.app/features), [Airbnb](https://www.airbnb.com/), [Notion projects](https://www.notion.com/product/projects). These inform navigation, hierarchy and interaction patterns; farm branding remains its own. Photo candidates: [Alex Gamaliel / Pexels](https://www.pexels.com/photo/african-farmers-working-in-lush-green-field-31472079/) and [Osni Shelby / Unsplash](https://unsplash.com/photos/a-pineapple-growing-on-a-plant-in-a-field-TREt-D05Ruw). Both provider pages describe free stock; final image/licence/crop selection and owner approval remain pending. Neither was added to public configuration.

Authoritative evidence remains [HANDOFF.md](../HANDOFF.md) and [Stage 2 checklist](STAGE-2-CHECKLIST.md). Do not convert dummy demonstrations into verification claims or delete earlier evidence.
