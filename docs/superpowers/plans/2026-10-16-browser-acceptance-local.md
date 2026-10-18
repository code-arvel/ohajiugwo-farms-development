# Local browser acceptance and callback integration

Continuation of approved hosted Stage 2 sequence 2; owner explicitly authorises local implementation with mocks/isolated fixtures and preservation of existing website/editor design. Existing stage-2 branch/worktree and uncommitted work are retained. Migrations 001–003 and their owner-run SQL results are complete and must not be rerun. No real provider/client credentials, accounts, email, SMTP/settings or deployment.

## Implementation contract

- A separate acceptance page reuses the shared logo, forest/cream palette, serif headings and accessible 16px form controls; no public/editor styling is modified. New assets are outside public output.
- Page/callback GET never consumes an invitation. An inline nonce-authorised script captures the fragment into a closure and immediately removes fragment/query from history before importing the client. Accept only exactly one id/nonce/token_hash; reject implicit provider access/refresh-token callbacks and query tokens. Never put link material/password into DOM text, globals, logs or browser storage. Only form fields briefly hold the password. Clear on terminal state/pagehide, retain only in-memory link context for a manual retry.
- `/admin/accept` HTML and `/admin/callback` share the browser screen; `/admin/accept` with JSON Accept header and POST use the existing API. Same-origin credentials, no-store/no-referrer/noindex and strict CSP apply. Use only same-origin allowlisted assets; no external fonts/analytics. Preserve the unavailable production handler and disabled live bootstrap; injected browser handler is exercised by a separate loopback fixture server only.
- Explicit submit validates confirmation and 12-character/72-UTF-8-byte password rules, gets fresh CSRF and POSTs. No background acceptance or automatic POST retries. Busy feedback prevents duplicate submit; terminal invalid/expired/cancelled/reused links use one safe message. Transient/network/CSRF errors retain in-memory context and permit explicit retry. Do not display provider response text.
- A five-minute encrypted HttpOnly completion receipt, scoped to acceptance and bound to invitation ID, lets a same-browser retry recover a lost success response via safe GET. It grants no admin session and never reactivates membership. A reused link in a fresh context remains denied. Receipt keys use existing injected crypto config, never `.env.admin` in fixtures.
- A test-only fixture server imports the existing isolated fixture/provider and real service/HTTP handler. It binds loopback, uses an exact origin and rejects hostile Host/Origin. A labelled local scenario index contains fake disposable links only. It cannot load hosted configuration, send email or enable live routes. No fixture/status endpoints enter hosting output.

## Checks

- Test-first fragment/password parsing, controller states and safe errors, transient retry/completion recovery, receipt binding/expiry and production route closure.
- Actual loopback HTTP checks for page/callback/assets/CSP/cookies and successful/expired/reused/cancelled/retry acceptance through the real service with mocks.
- Existing admin/public checks and build/function compilation. Browser UI checks if an enabled browser is available; report unavailability explicitly, never equate controller/HTTP tests with browser QA.
- Read-only security review, handoff/runbook update. No new SQL or schema changes.

## Remaining real-setup gates

Real Auth wire behaviour/refresh and lost-checkpoint recovery, controlled disposable provider tests, browser/HTTPS/callback and restrictive redirect verification, delivery adapter/template and separately authorised email test, normal sign-in/session integration, full non-member/revoked DB/Storage checks and cleanup worker. Sender selection remains deferred. This slice does not authorise real first-admin creation or deployment.
