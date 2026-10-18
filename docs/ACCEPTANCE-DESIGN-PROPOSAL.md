# Acceptance screen proposal — centred form approved and implemented locally

Owner approved this direction and requested implementation. The acceptance-only screen now follows it; the saved HTML remains a dummy visual reference. Fresh local regression/browser evidence and remaining manual/hosted gaps are recorded in HANDOFF.md and ACCEPTANCE-BROWSER-QA.md. Older awaiting-review instructions below describe the proposal checkpoint and are superseded by this approval.

## Current direction — supersedes the alternatives below

The owner reviewed and dropped Botanical editorial and Field notebook. The revised proposal is [acceptance-centred.html](../design-system/ohajiugwo-organic-farms/proposals/acceptance-centred.html), viewable at **http://127.0.0.1:4324/acceptance-centred.html** while the static proposal server runs. It is a standalone browser document, also openable with Ctrl+O. Desktop and mobile previews have independent selectors for nine states. This is a visual proposal, not application implementation.

A horizontally centred 432px form sits directly on the warm-cream page. The unchanged existing logo, embedded local wordmark fonts, Lora/DM Sans content typography, fine divider, forest-green action and deliberate spacing supply the identity. There is no enclosing card, shadow, split layout, illustration or notebook styling. Desktop uses modest top spacing rather than forced viewport centring. Mobile uses 24px gutters, a shorter logo-to-form gap and ordinary document scrolling; no fixed height, keyboard-dependent centring or sticky action is imposed. The mobile preview is 390px wide and also shrinks to its available width.

Errors have a pale-red background, dark-red heading/text/icon and a clear next step; invalid fields have a heavier border and a message directly below. Retry uses a distinct warm-paper/brown treatment with a retry icon and prominent “Try again” action, retaining dummy values. Success uses sage/check treatment. Information uses neutral paper. Completed and invalid/expired/reused screens remove all form fields, password helper text, submission instructions and acceptance action. Their heading and message describe the result and relevant next step. The same completed/rejected copy cleanup must be carried into a later approved implementation.

The prototype uses only dummy read-only values, simulated actions and a CSP that denies API connections and form submission. It does not import the controller/provider or change existing tested behaviour. Its state checks are presentation checks only. Proposed live-region/focus and all security requirements below remain acceptance criteria for later implementation and renewed automated/manual QA. Owner review of this revised visual remains pending; do not implement merely because the earlier concepts were reviewed.

## Superseded alternatives — retained as design history

Scope: revise only acceptance-screen presentation after owner review. The current tested screen/controller/security/validation are unchanged. Stage 2 implementation/manual fixture QA pauses at this design-selection checkpoint; no previous checks are invalidated or marked manually passed. No public website, live bootstrap, account, mail, SMTP, migrations or deployment changes.

Review visual: `design-system/ohajiugwo-organic-farms/proposals/acceptance-directions.html`. It is a presentation-only inline preview with dummy, read-only password fields, local message-state switches and Desktop/Mobile options. It calls no API and embeds the unchanged owner logo. Fonts follow the approved system: Lora/DM Sans for content and Manrope/Source Serif 4 for the wordmark. The proposal is not wired to the acceptance service or fixture server.

## Botanical editorial — recommended

Desktop: an approximately 36/64 split, forest-green botanical linework panel and an uninterrupted warm-cream form surface. The original logo sits on cream. Leaf outlines and a restrained earth-coloured accent provide the agricultural cue; no floating card, shadow, dashboard decoration or large corner radius. Mobile: artwork becomes a 104px cropped band, with compact logo/form spacing and the action in normal document flow.

## Field notebook

A warm-cream editorial spread under the shared logo masthead. A quiet introduction and curved cultivation-row motif occupy one column; a fine rule separates the form column. Earth tones appear in rules and small labels. Mobile: the editorial column contracts to a short heading/motif above the form rather than stacking a desktop hero; supporting prose is removed. Flat surfaces, square/2px field corners and no shadows.

## Message states in both previews

- Password: “Set your password.” / “Choose a password to accept your administrator invitation.” Clear labels, helper text and one primary acceptance action.
- Confirmation error: pale-red summary, dark-red alert icon and “Your passwords don’t match.” / “Re-enter the confirmation below so it matches your new password.” Mark confirmation input, put “Enter the same password in both fields.” immediately below it and retain both entered values.
- Password error: same separated error treatment, “Use a longer password.” / “Choose at least 12 characters, then enter the same password in both fields.” Mark password input and show its error below. Also retain the existing 72-byte maximum; an overlength error should say “This password is too long. Shorten it, then confirm it again.”
- Invalid/expired/cancelled/reused link: “This invitation can’t be used.” / “It may have expired, been cancelled or already been accepted. Ask the maintainer for a new invitation.” No automatic resend or unapproved email action; remove the password form as today.
- Retry: “We couldn’t confirm completion.” / “Keep this tab open and try again. Your entries are still here.” Retain values/context and give “Try again” the full-width primary action. Never assert that nothing happened when completion is uncertain.
- Success: sage fill/check icon, “Invitation accepted.” / “Your administrator access is ready. You can close this page. You have not been signed in automatically.” Form/passwords clear as today; no invented working sign-in action.
- Information: neutral paper/earth rule/info icon, “Before you begin.” / “Use at least 12 characters. You’ll sign in separately after accepting.” Visually distinct from red errors and sage success.

Proposed error text `#75251e` on `#f9e7e2` measures approximately 8.6:1 contrast. Icon, heading, explanatory text, field border and placement reinforce colour. Keep 16px input text and readable mobile message text; no tiny labels to force a fit.

## Interaction/accessibility requirements for later implementation

After a failed submit, announce a concise error summary once (`role=alert`); focus the first invalid field for field errors, linking its error with `aria-describedby` and setting `aria-invalid=true`. For a form-level/transient failure, focus the separated message area with the primary retry action next in logical order. Success receives polite announcement and focus on its heading. Information uses a polite status only when it changes. Do not cause duplicate announcements on every keystroke.

Preserve entered values while correction/retry is possible, paste/password-manager support, visible focus, native keyboard order, show-password control, touch targets and reduced-motion preference. Preserve tested password limits, explicit POST, CSRF/Origin checks, fragment removal/memory-only context, duplicate-submit protection, completion receipts, terminal cleanup and generic provider errors. Layout/state-copy mockups do not prove any of this in a browser; re-run automated and manual browser checks after the selected design is implemented.

Proposal validation only: inline JavaScript syntax parses; two direction variants are present; original logo embedded; no API calls; error text contrast computed. No product tests or browser QA were rerun for this presentation-only change. Await owner choice/refinement before editing acceptance-screen application files.
