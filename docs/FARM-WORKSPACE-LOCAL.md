# Farm workspace — local review and verification

21 November 2026. Approach A is implemented locally on the Stage 2 development branch. This is the administrator UI slice, not completion of Stage 2 or the whole project. No hosted deployment, migration or provider request is part of this checkpoint.

## Review in Brave

From the project directory run:

```bash
npm run admin:dev-workspace
```

Open **http://127.0.0.1:4330/admin/** in Brave. This is a local fixture with a visible dummy-data banner and `owner@example.test`; no real sign-in is required. No `.env.admin` is loaded. Stop it with Ctrl+C. If the port is occupied, use `WORKSPACE_FIXTURE_PORT=4331 npm run admin:dev-workspace`, then open that port instead. Do not expose this fake-authentication fixture beyond loopback or deploy it.

The fixture composes the actual screens, browser assets and safe content services with in-memory fake provider responses. Draft saves, revisions/trash actions and errors are local demonstrations; they disappear when the server restarts. The photo library is empty in this review fixture and uploads/provider account issuance are deliberately unsupported. Separate automated media/account browser fixtures exercise these flows with dummy providers. A simulated sign-out does not establish authentication verification; use the dedicated session tests for that evidence.

## What changed

- Authenticated overview with real authorised content loading in the application, honest unavailable/empty/retry states, quick links and reporting marked Not configured.
- Shared branded navigation for overview, writing desk, photographs and administrator access. Disabled feature links stay hidden. Password confirmation remains reachable on mobile.
- Existing Tiptap writer and structured homepage fields retain their safe formatting and backend command contracts. Lists/search/filter dialogs use applied state, explicit Apply/Clear and mobile sheets.
- Content filters use loaded post titles and update dates. Photo filters use actual dimensions and upload dates; no pretend names/tags/usage fields are introduced. Totals describe loaded results.
- Prominent typed feedback, adjacent field messages, invalid-field associations, error focus, retained correctable values and cleared stale validation when changing drafts. Native Enter/Space/Escape and focus return work for filters.
- Pending loads/saves block panel/hash changes and editing races. Uncertain-save reconciliation and conflict handling remain in place. Centred acceptance/sign-in/password-confirmation layouts and credential clearing are retained.

## Evidence boundaries

Automated local browser checks use installed headless Chrome with temporary profiles, not the owner's Brave profile. Dummy services are injected. No account, email, SMTP, provider setting, Storage or hosted SQL action occurs.

`tests/admin/browser/workspace-qa.mjs` checks real screen composition, overview success/failure/recovery, five responsive widths, filter Enter/Space/Escape/focus return, field feedback/retained values, cleared stale errors, primary-action contrast, same-origin requests and no browser storage. It captures implemented screenshots under `docs/review/implemented-workspace-*.png`.

`tests/admin/browser/workspace-recovery-qa.mjs` checks a deliberately delayed save, blocked hash/input changes, failed-list filtering that never becomes a successful empty list, and exact company/indexed service field associations. The new save-race and field-path regressions failed before their fixes; the final browser run passed.

Existing isolated editor/media/account browser scripts also passed during implementation: saving/revision history/restore/trash/conflict preservation; private upload/preview/draft attachment/used-photo protection; and mocked account preparation/reset/revocation. These are not hosted persistence/security or email-delivery proof. Final post-fix checks: 220/220 administrator tests and 53/53 public/editor tests passed sequentially; local hosting composition and build passed. The editor browser regression also passed again after pending-operation guards. No deployments, hosted provider tests or migration executions occurred.

The 200% check is **CSS zoom/reflow approximation only**. Manual 200% browser zoom on this implemented design, screen-reader behaviour, physical mobile keyboard/touch and hosted end-to-end authentication remain pending. Previous owner approval/manual checks concern earlier designs and must not be transferred to these screens.

## Next project work

Use [PROJECT-BUILD-TRACKER.md](PROJECT-BUILD-TRACKER.md). Homepage image replacements still need individual selection; current public images/layout/copy are unchanged. Local publishing/release/recovery/backups and reporting remain to be built under their own concrete scopes. Deferred hosted work resumes at pending migration 011/Auth review inspection, without rerunning 001–010. Stage 2 remains incomplete.
