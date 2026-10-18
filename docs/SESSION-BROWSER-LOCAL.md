# Local browser sign-in and sign-out

This is an isolated mocked-provider Stage 2 checkpoint. No real accounts or emails are created, no `.env.admin` is loaded, and production `/admin/*` routes still return unavailable. The existing acceptance screen, public website and editor styles are unchanged. Session pages reuse the approved centred form CSS as a read-only asset.

Implemented local surfaces:

- `/admin/login`: labelled email/password fields, password visibility, field validation, generic authentication errors, bounded same-origin JSON/CSRF requests and explicit retry. Passwords/tokens never enter URLs, globals or browser storage. A lost login body can be recovered only by a matching verified session GET; there is no automatic POST retry.
- `/admin/`: verifies the existing session service before returning HTML. Anonymous/revoked sessions go to the fixed login route; verification outages fail privately with 503. It confirms the current mock identity and offers sign-out only; it is not a working editor/dashboard. Identity text is escaped and no provider credentials appear in HTML.
- Sign-out: confirms the HTTP service's revocation result before navigating to login. Uncertain/failed application revocation retains the page with an explicit retry; it does not claim success. Provider cleanup remains a separately tracked result.
- Synchronous bootstrap cleanup runs before client import: pagehide clears fields/identity/CSRF markup and hides the form. Delayed imports cannot mount a closed page; restored cached pages reload for server verification. The mounted controller aborts requests and ignores late responses. Form fallback uses POST so a failed script cannot send passwords through a default GET query.

## Run dummy fixtures

```bash
node scripts/serve-session-fixtures.mjs
```

Open **http://127.0.0.1:4325/__session_fixtures/**. The only valid dummy credentials are `owner@example.test` / `DummyFarmPass123!`. Never use real credentials or expose this loopback server to the network. Restart it for fresh state. It does not serve the public homepage; a Home link is not a public navigation test. Stop it with Ctrl+C when finished. Existing acceptance fixtures on port 4323 are separate and untouched.

Try missing/invalid fields, a wrong dummy password, show/hide, valid sign-in and sign-out. Use keyboard and phone-sized views; report observations separately from automation. Remaining owner accessibility checks on the approved acceptance form stay pending, except the owner-reported visual review at 200% zoom. That report does not establish screen-reader, visible-focus or keyboard behaviour.

## Automated local evidence

`node --test tests/admin/session-browser.test.mjs` covers controller/route/inline-bootstrap behaviour. `node tests/admin/browser/session-qa.mjs` requires installed Chrome and creates/stops its own disposable server/browser profile. It checks actual browser form/HTTP/cookie/CSP integration, 1440px desktop and 375px/320px fit, validation/Enter/Space, failed credentials, protected access, nonmember/revocation denial, failed logout retry and old-cookie denial, safe provider outages, empty browser storage and page-exit cleanup. It also pauses the module request and simulates pagehide/restoration before mounting. VM checks separately cover delayed and failed imports; this is not blanket proof of every browser's BFCache behaviour. Screenshots are written to the OS temporary directory as `farm-session-*.png`.

Final checkpoint: **95 admin tests, 51 public/editor checks, local build, function compilation and new browser/controller compilation pass**; isolated Chrome QA passes. A read-only security review found the early module-load cleanup gap; a failing regression reproduced it, synchronous bootstrap listeners fixed it, and final automated/browser runs passed. Appearance/automated evidence is not a manual screen-reader or physical keyboard/touch pass, and no hosted authentication or email result is inferred.

Next local work is recent reauthentication and the remaining invitation/reset/revocation/recovery/cleanup lifecycle, then persistent editing and private media. Real provider/HTTPS/cookie/DB/Storage/concurrency/recovery testing and any real account/email activity require separate authorisation. Sender selection and SMTP stay deferred; live bootstrap, production routing and deployment remain disabled. No hosted approval is needed to continue the remaining mocked local work.
