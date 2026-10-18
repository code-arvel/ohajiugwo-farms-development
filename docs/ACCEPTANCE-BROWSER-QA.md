# Acceptance fixture browser QA

**Current design: owner-approved centred form, implemented locally.** The owner approved its appearance and separately reported a visual review at actual 200% zoom. Hosted migrations 001–004 and their recorded owner-run SQL checks remain complete; do not repeat them. No real account/email/SMTP/provider/migration/deployment operation is part of this checklist. Live bootstrap remains disabled.

The owner has now reviewed the **implemented** form and approved its appearance, including a later visual review at actual 200% zoom. These are visual results only. Uncompleted accessibility checks below, including screen-reader, visible-focus and physical keyboard behaviour, remain pending; hosted authentication verification remains pending separately. Do not mark the functional/manual checklist passed solely from appearance approval.

## Recorded results and provenance

Owner subsequently reports the implemented centred form looks good at **actual 200% browser zoom**. This is owner-reported visual review only (browser/version/viewport unspecified). Keep visible focus, screen-reader and all unconfirmed keyboard/touch checks pending. The combined mobile/zoom checklist row below is not fully passed by this visual report.

Owner reports that **the previous design** passed local fixture validation, password visibility, success, invitation rejection and retry; controls were reachable by keyboard and mobile layout looked good. Visible focus, Space/Enter and 200% zoom were unconfirmed. Browser/version and exact viewport were not supplied. Do not silently transfer these passes to the redesigned screen or to hosted authentication.

After implementation, **agent-run automated** isolated headless Chrome checks passed at desktop 1440px and phone widths 375px/320px: validation/inline feedback/focus, preserved correctable values, Tab navigation/computed 3px focus outline, Space checkbox toggle, Enter submission, terminal copy/cleanup, expired/cancelled/reused rejection, explicit retry recovery, same-origin requests, empty local/session storage and no uncaught exceptions. Desktop and mobile screenshots were inspected. A shorter viewport also permits normal scrolling, but this is not a real virtual-keyboard test. Run this optional local check with installed Chrome: `node tests/admin/browser/acceptance-qa.mjs`. It creates/stops its own disposable server and browser profile and loads no hosted config. This was included in the **181 admin / 51 public-editor** automated regression passes recorded in the current handoff.

Current manual statuses below mean **owner manual interaction checks**. The owner-reported appearance review at 200% is recorded separately. Installed-Chrome automation has verified computed focus styling and keyboard activation for the tested controls; screen-reader announcements and physical mobile keyboard/touch remain pending. Automated evidence does not convert unperformed owner checks into manual passes.

## Start

In the project directory run `npm run admin:dev-acceptance` and leave that terminal running. If the owner's fixture server is already running, stop/restart it in its original terminal to load the new screen assets and fresh fixtures; do not start another listener on the same port. Open `http://127.0.0.1:4323/__fixtures/` in a desktop browser. Use the exact `127.0.0.1` address; this harness checks its Host/origin. The index and acceptance screen must say they are local tests. Use only a dummy password such as `DummyFarmPass123!`; do not save it in your browser password manager.

Restart the server with Ctrl+C and the same npm command when you need fresh fixtures. Return to the index by entering its URL; the invitation fragment is deliberately removed from the acceptance page. Refreshing that clean page cannot recover an uncompleted link—reopen the original link from the index instead. No fixture setup uses `.env.admin` or hosted configuration.

## Expected manual checks

| Check | Action | Expected result | Manual status |
| --- | --- | --- | --- |
| Initial link | Open `valid` without submitting. | Shared logo, local-test notice, labelled password/confirmation form; address becomes `/admin/accept` without invitation/query material. Opening the link does not activate anything. | Pending |
| Confirmation | Enter `DummyFarmPass123!` and `DifferentDummy123!`; submit. | Passwords-do-not-match message, form remains usable, no success and no acceptance POST. | Pending |
| Length | Enter `short` in both fields; submit. | At-least-12-characters message; no acceptance POST. | Pending |
| Show/paste | Paste the dummy password into both fields; toggle Show passwords on and off. | Paste works; both fields switch together, then mask again; values are preserved. | Pending |
| Success | Submit matching `DummyFarmPass123!` in `valid`. | Busy state, then “Invitation accepted.” and administrator-access-ready message explicitly saying you have not been signed in automatically. Form, password instructions and intro disappear; password fields clear. No real account is created. | Pending |
| Malformed/missing link | Open `http://127.0.0.1:4323/admin/callback#broken` or `/admin/accept` with no fragment. | “This invitation can’t be used.” and actionable invalid/expired/already-used explanation in pale-red summary; form and password instructions hidden. | Pending |
| Expired | Open `expired`, enter matching dummy password and submit. | Form may appear initially; submission produces the safe invalid/expired/already-used message and hides form. No success. | Pending |
| Cancelled | Repeat with `cancelled`. | Same safe terminal error after submission; no success. | Pending |
| Reused | Repeat with the pre-consumed `used` fixture. | Same safe terminal error after submission; no new activation. | Pending |
| Same-browser receipt | After success, reopen the original `valid` fixture link from the index in the same browser within five minutes. | May show completion directly via the encrypted receipt. This is recovery of the previous result, not another activation. For rejection testing use `used` or a separate private browser context. | Pending |
| Retry | Open `retry`, enter matching dummy password, submit once. | Safe could-not-confirm message and Try again button; form/context remain. No raw provider text or technical details. | Pending |
| Retry completion | Click Try again in that same tab without refreshing. | Completes successfully. No repeated clicks or refreshed link required. Fixture is consumed after success. | Pending |
| Keyboard | On a fresh valid form, use Tab/Shift+Tab, the skip link, Space on Show passwords, and Enter to submit. | Visible focus, sensible order, reachable fields/checkbox/button, working skip link, no trap. Field errors focus the affected input; retry/rejection focus the message; success focuses its heading. Text explains state independently of colour. | Pending |
| Mobile layout | Use desktop browser responsive mode at 375×812 and 320px width, then desktop around 1440×900; also check 200% zoom. | No horizontal scrolling/clipped text; logo and controls fit; button text wraps if needed; normal vertical scroll, readable labels, comfortable targets and visible focus. | Owner reports 200% appearance looks good; remaining combined checks Pending |
| Optional offline recovery | On a fresh valid loaded form, temporarily select Offline in browser developer tools, submit dummy values, restore Online, then Try again in the same tab. | Safe retry message while offline, no false success; explicit retry works after reconnect. | Pending |
| Optional privacy/network | Inspect that tab's Network and Application/Storage panels. | Assets/API only use this loopback origin; acceptance is POST-only, secrets absent from URLs; no invitation/password in localStorage/sessionStorage; no admin-session cookie. Short-lived encrypted CSRF/receipt cookies are expected. | Pending |

Expired/cancelled/used fixtures are checked on submission; displaying their form initially is expected. An already completed link in the same browser can show its completion receipt, so that is distinct from rejecting a reused link in a fresh context. The responsive-mode check establishes layout only, not physical mobile keyboard/touch behaviour. The fixture server stays loopback-only; a physical phone's `127.0.0.1` points to that phone, so do not expose the server to the network for this checklist.

Record any clipping, focus loss, unexpected success, raw provider text, missing local-test notice or stalled retry. The offline harness does not serve the full public website; its home links are not a public-site navigation test.

## Report

Report browser/version, viewport/zoom, each check's Pass/Fail/Not tested, and a short symptom for failures. No real credentials, cookie values or invitation URLs are needed. Until new interaction results arrive, manual interaction statuses above remain Pending; the owner visual review and previous-design owner results remain recorded separately. Stop the fixture server with Ctrl+C when finished.
