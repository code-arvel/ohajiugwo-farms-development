# Local reports and optional consent

Implementation is local and provider-injected. No GA4 property exists; collection remains disabled. No reporting credentials, monitoring accounts, public tracking markup, network activation, scheduled checks or provider operations were created. Local mock observations are test evidence, not production reports.

## Application integration

```js
import {createReportingService} from './reporting/service.mjs';
import {createReportingScreenHandler} from './reporting/screen.mjs';
const reporting = createReportingScreenHandler(config, {
  auth,
  service: createReportingService(), // deliberately unconfigured
  assets,
});
// Dispatch exact /admin/reports and /admin/reporting/* to reporting(request).
```

`config.origin` must be the trusted admin origin. Optional shell flags are `accountLifecycleEnabled` and `privateMediaEnabled`. `auth.authenticate(request)` is the existing session/membership guard; it must enforce all existing membership and password-confirmation rules. No alternate authentication path is introduced. All report and reporting-asset requests authenticate first, including CSS. Authentication status 401 redirects to `/admin/login`; 428 redirects to `/admin/confirm-password`; unexpected failures return 503. Cross-origin and cross-site requests are rejected. Only GET is accepted.

Register protected asset `/admin/reporting/reporting.css` from `admin/reporting/reporting.css` in the existing `{body,type}` asset map. The page reuses `withWorkspaceShell` and existing `/admin/workspace/screen.css` and `/admin/accept/logo.css`; retain their existing asset routing. Add a Reports navigation link to `/admin/reports` in the shared shell when integrating. The new page needs no browser JavaScript. Every response is private/no-store/noindex, has no-referrer/nosniff and a CSP; the page allows only local styles/fonts/images/forms and no scripts or provider connections.

`GET /admin/reports?period=7|28|90` and `?period=custom&start=YYYY-MM-DD&end=YYYY-MM-DD` return server-rendered accessible reports and tables. Duplicate and unknown parameters are rejected. Custom ranges are inclusive, past/current only, at most 366 days. Default is 28 days. The date clock is Africa/Lagos (UTC+1, no daylight saving); preceding comparisons contain exactly as many calendar days. Today is explicitly partial. Recent reporting delays remain possible even for completed calendar days. The refresh timestamp is displayed separately from collection start.

## Server provider interfaces

`createReportingService({analytics=null,availability=null,evidence={},now=Date.now,collectionStart=null})` exposes `read(query={})`. Return shape is `{range,collectionStart,analytics,health}`. Each result has `source`, `state`, `observedAt` and optional parsed `data`; valid states are `unconfigured`, `empty`, `error`, `fresh`, `stale`. Missing configuration is never zero. Failed providers are independent and never turn into a successful empty report. Error messages and raw responses are not sent to browsers.

`server/reporting/providers.mjs` exports:

- `createGA4Adapter({propertyId,getAccessToken,fetcher=fetch,now,sleep,cacheMs})`, with `read(range)`.
- `createServiceAccountTokenProvider({clientEmail,privateKey,fetcher=fetch,now,sleep})`, an async access-token function using Web Crypto RS256/PKCS8 service-identity JWT exchange and the read-only Analytics scope. It caches the short-lived token in server memory and refreshes before expiry; no private key/token is returned to report consumers. An independently managed server-side OAuth token provider can be injected instead.
- `createBetterStackAdapter({monitorId,token,fetcher=fetch,now,sleep})`, with `read()`.

GA4 uses a four-report `properties/{id}:batchRunReports` request with named current/previous ranges for sessions/page views, public page paths, session referral sources, and `email_click` event counts by `customEvent:placement`. The property must use Africa/Lagos; an explicitly different response timezone is rejected. Register `placement` as an event-scoped custom dimension before live validation. Private admin/preview/draft/test paths are excluded by the request and display parser. Query/email-like page rows and referral rows are dropped. Email-click placement is a fixed allowlist (`header`, `hero`, `about`, `products`, `contact`, `footer`). Rows are bounded to 20 per table across both periods; the UI discloses that limit. Metrics are aggregate reports, never claims that emails were sent. No fabricated history is provided.

GA4 cache defaults to five minutes; Better Stack uses one minute. Cache holds at most 32 range entries per adapter and coalesces in-flight equivalent requests. Failed refreshes preserve prior observation timestamps and return `stale`; a first failure returns `error`. Each HTTP request has an eight-second timeout, redirects are refused, and 429/network/5xx requests retry at most twice with 250/500ms backoff. Other 4xx errors do not retry. Injected transports must respect abort signals. Cache and token state are process-local and must not be considered durable across Worker instances.

Better Stack reads only the configured monitor from its availability API, maps the provider's actual `status` and `last_checked_at`, and marks observations older than ten minutes stale. It never treats a successful API HTTP response as proof that the monitored website is up. Pending/no timestamp is No data yet. Incident histories and response-time charts are not implemented; the panel reports only this monitor's latest check.

## Supplied health evidence

`evidence` accepts independent keys `labMobile`, `labDesktop`, `field`, `links`, `publishing`, `backups`, each `{source,observedAt,status,detail?,url?,device?}`. Use real timestamped outcomes; explicitly label any supplied local lab/release/check/restore result as local. `state:'error'` can represent an actual failed observation. Missing source evidence remains Not configured; configured evidence without a timestamp is No data yet. Invalid/future timestamps fail. Prior results become stale after 24 hours, backups after 36 hours. Freshness means observation age only: a fresh `Failed` result remains visibly Failed. No overall-green status is calculated.

The report service does not run Lighthouse, fetch external links, publish releases, back up data or issue heartbeats. Those systems must inject their own confirmed evidence. Field performance needs a real field-data integration and enough observations; it remains unconfigured here. Link checks cannot prove mail delivery; backup success requires a separate readback and restore drill.

## Optional public consent contract — keep off

`src/analytics/consent.mjs` exports `renderConsentMarkup(config)` and `createConsentController(config,{window,document})`. Module import is inert. Markup is empty unless all of these are provided: `enabled:true`, `production:true`, a valid `measurementId`, an HTTPS `productionOrigin`, nonempty `publicPaths` from the immutable approved public release, `privacyApproved:true`, and `retentionMonths:2|14`. Missing notice approval or retention leaves collection off. Never include this module in admin/private previews. Never infer production from hostname alone.

After a separately approved production/privacy setup, a static release builder may include the markup and a local module bootstrap with that exact public configuration. Public config must contain only measurement ID, production origin and approved paths, never reporting property credentials, service identity or monitor tokens. It must not contain titles/draft inventory or administrator records. Optional markup references `/privacy/`; publish the approved notice there before activation.

The controller offers equally worded Accept/Decline and persistent Change/Withdraw controls. Before acceptance or after decline it creates no Google script, Google request, consent-mode ping, queue or preconnect. Accepted choice is remembered in localStorage; blocked storage requires a fresh choice on each visit. Withdrawal sets the GA disable flag immediately, removes the tag script/queued events and expires host GA cookies. Earlier data already transmitted cannot be recalled. Multi-tab withdrawal is handled through the storage event.

Collection additionally requires the current origin and exact pathname to match the release allowlist. Admin/preview/draft/test paths, query-bearing URLs and personal/encoded paths cannot collect. `administrator:true` or localStorage `ohajiugwo_analytics_admin_excluded=1` excludes browsing. The root application also sets a noncredential `ohajiugwo_analytics_admin_excluded=1; Path=/; Max-Age=43200; SameSite=Lax; Secure` marker on successfully authenticated admin HTML. The controller checks this cookie as well as localStorage and fails closed if either store is unreadable or contains an ambiguous marker. HTTP-only `/admin` authentication cookies remain separate and are never read by the public module. It is a best-effort browser marker, misses other devices/cleared storage, and does not replace private-route exclusion.

Only a sanitized allowlisted page path, generic public title and blank referrer are supplied. Email instrumentation requires `<a href="mailto:…" data-analytics-placement="contact">` (or another allowlisted placement); destination addresses, link text, draft titles and query strings are never event parameters. Copy-email actions are not counted. Config disables advertising personalization and Google Signals. It uses manual page views, so homepage anchors create no extra views.

Before activation, disable **all GA4 enhanced measurement**, automatic page-change tracking and advertising/Signals features in the property; this controller intentionally provides only manual page views and fixed-placement email clicks. Review the Google loader itself and real browser network traffic with the chosen property. The code is a proposed basic-consent control, not evidence of regulatory compliance. Do not add advanced consent mode, cookieless pings or other tags.

## Verification and external gates

Focused local command: `node --test tests/reporting/*.test.mjs`. Tests cover Lagos/equal ranges and invalid dates, independent source states, bounded retries/cache/stale timestamps, aggregate parsing, timezone/provider failures, server-only JWT signature/token reuse, authentication/private asset headers, escaping, production allowlist, consent decline/accept/withdraw and sanitized email events. Tests use mock HTTP transports and generated ephemeral keys; they do not contact providers.

Remaining external gates: approved privacy notice and consent controls; owner-created GA4 property and dedicated read-only reporting identity, API enabled and Africa/Lagos timezone; event-scoped placement dimension; secure server-only secret injection; disable enhanced measurement and verify real consented events/withdrawal/admin exclusion; owner-approved Better Stack monitor and alert recipient; actual hosted HTTPS availability; timestamped deployed lab/link/publishing observations; independent backup/restore evidence. Full application checks, hosted provider authorization checks and browser QA belong to root integration. Collection stays disabled until those owner-authorized gates pass; Stage 2/production readiness is not established by these local tests.

Provider request formats were checked against primary documentation: [GA4 batchRunReports](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/batchRunReports), [Google service identity OAuth](https://developers.google.com/identity/protocols/oauth2/service-account), and [Better Stack monitor API](https://betterstack.com/docs/uptime/api/get-a-single-monitor/).

## Privacy notice and consent presentation integration

`renderPrivacyNotice(config={})` returns a standalone HTML `<section>` suitable for the public privacy page renderer; it is intentionally useful with no analytics configuration and explicitly says analytics is off/unapproved. It escapes optional `privacyContact` text. The root release builder supplies the normal public page shell and `/privacy/` route. `src/analytics/consent.css` styles both this section and the consent markup; use the normal public asset build if/when those views are included. The module introduces no global style mutations.

Activation requires `privacyApproved:true` and a verified `retentionMonths` value of 2 or 14 in addition to the earlier production/release controls. The notice distinguishes browser preference storage, GA cookies, GA user/event retention, aggregate retention and essential hosting/admin processing. Browser GA cookies explicitly use `cookie_expires:2592000` (30 days) and `cookie_update:false`; this does not prove provider-side deletion of aggregates. The notice names Google and the prepared Cloudflare Pages hosting, explains potential international processing and leaves owner review/contact responsibilities explicit. It makes no legal-compliance assurance.

The tag dispatcher now uses `function gtag(){window.dataLayer.push(arguments)}` semantics (with the injected window) for config, page views and email clicks, matching [Google’s official installation snippet](https://developers.google.com/tag-platform/gtagjs). Cookie controls follow the [official GA4 configuration reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/config). Tests assert real Arguments command objects, no Google queue/network on excluded or uncertain admin state, notice escaping and honest off defaults. No live tag/provider request was performed.
