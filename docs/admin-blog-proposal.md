# Blog and private administration proposal

**16 October 2026 · Planning only · Awaiting owner approval**

## Staged plan in plain language

This revision keeps the technical requirements below and divides delivery into four reviewable stages. Each stage needs approval before implementation. Approval to build locally does not authorise an external account, paid service, publishing automation or deployment. Analytics can wait until the editing, security, publishing and recovery work is complete.

| Stage | What you will review | Completion boundary |
| --- | --- | --- |
| **1. Blog and structured editing** | Blog listing/articles and fixed editors for existing company, product and service content, using the approved homepage as the reference. | Local-only foundation with test data; no accessible remote editing service or public drafts. |
| **2. Secure accounts, photographs and previews** | Two separate equal administrator accounts, invitations, password resets, uploads and private previews. | Full security tests against local Supabase and its test email inbox; hosted-service tests remain separate. |
| **3. Publishing and recovery** | Publish/unpublish without Git, failure handling, earlier versions, recently deleted content and database-plus-photo recovery. | Local failure/restore tests first; approved external setup and a separately approved deployment are needed to prove real hosting behaviour. |
| **4. Analytics and website health** | Simple reports with clear definitions, dates, limitations and honest health states. | Local report/state tests first; real visitor reports and live availability require deployment and collected data. |

Security is a dependency, not a later add-on to a live editor: Stage 1 editors stay on a developer's machine using non-sensitive fixtures until Stage 2 passes. Permission policies and draft/public separation begin with the data model. No temporary unauthenticated admin endpoints, public draft buckets or “secret link only” previews are permitted in any stage. A local editor prototype is not ready for deployment.

### Where the work can be built and tested

| Environment | What it proves | What it cannot prove |
| --- | --- | --- |
| **Local computer — no external accounts required** | Templates and mobile/desktop layouts; structured validation; blog routes; local Supabase Auth/database/Storage policies; two-user conflicts; invite/reset flows in Mailpit; uploads/private previews; release generation; simulated provider failures; backup/export and restore into a second local database. | Real email delivery, hosted configuration, cloud scheduling reliability, public uptime or genuine visitor statistics. |
| **External accounts, without a public website** | Hosted Supabase policies/Storage/Auth, SMTP/domain verification and controlled delivery tests to the two administrators; private source hosting; hosted backup job/storage integration; reporting/monitoring credentials and provider permissions. | Real public-site availability/performance or production publishing until an approved deployment exists. Provider callbacks may need a separately approved protected test deployment. |
| **Explicitly approved deployed website** | HTTPS cookies/redirects, real invitation/reset links, end-to-end static release promotion and withdrawals, restrictions on retained/preview URLs, availability checks and real performance. Analytics additionally needs consented traffic and reporting time. | Exact visitor counts, proof that a clicked email was sent, or recovery guarantees beyond tested backups. |

Local backend work will need the Supabase CLI and a Docker-compatible runtime, installed only after approval. The developer checks machine compatibility first; an unavailable runtime is reported, not used as a reason to silently create cloud services. [Local Supabase requirements](https://supabase.com/docs/guides/local-development/cli-workflows)

### Email and costs: settled choices

- Keep **ohajiugwochimeziebibi@gmail.com** for customer enquiries throughout. Authentication mail uses a separate sender; it does not replace the public contact address.
- During local development, capture invitations and password resets in **Mailpit**, the local Supabase email-testing inbox (normally `localhost:54324`). Test opening links, setting/resetting passwords, expiry/reuse, cancellation and generic error responses. Messages stay local: these tests do **not** establish inbox delivery, spam placement, DNS reputation or production deliverability. Bind the inbox locally and use disposable test identities. [Local Auth email testing](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)
- **No domain purchase or transactional-email account is needed for local development.** Before real production invitations/resets, plan a free transactional-email service, default Resend SMTP, with a verified domain controlled by the owner. Resend requires an owned sending domain; the Gmail domain cannot be verified by us. An existing domain can supply a sending subdomain without purchasing another domain. If none is owned, its registration and annual renewal are the unavoidable external cost for this selected sending arrangement; the amount depends on the chosen name/TLD. Buying it can wait until hosted email setup before launch. [Sending-domain requirement](https://resend.com/docs/dashboard/domains/introduction)
- Resend's current free allowance is 3,000 emails/month and 100/day; no paid email plan is expected initially. Domain purchase, provider setup and DNS changes still need explicit approval. Local tests continue working while that decision is deferred. [Email pricing](https://resend.com/pricing)
- No paid software subscription is inherently required to complete local stages. Hosting/backend/backup usage may initially fit free allowances, with the limitations and potential charges in the detailed cost table. A domain is not a guarantee of delivery; real delivery checks are a launch gate.

## Baseline and scope

Reviewed HANDOFF.md, the saved design system, live homepage/templates, central configuration, build script, package scripts, QA notes and accessible Git history. **`approved-website-v1` exists and resolves to `d89943d754e667f8fa5f50251c36bbfb17e84073`**, “Save approved farm website”, on `main`. The working directory was clean before this proposal. This is the only commit currently visible. HANDOFF.md's earlier account of inaccessible Git is historical; Git and the recovery tag are now accessible. The existing dated recovery archive remains untouched.

The website currently uses dependency-free Node.js 22+ ES-module templates, generates static HTML into `dist/`, and has 17 existing checks. No frontend framework migration is necessary. This proposal changes no website code or configuration, runs no installation, and creates no external services or deployment configuration.

Preserve the approved homepage: Home → Products → Practices → About → Services → Contact, including its principles strip, original concise copy, centred hero/actions, minimal eyebrows, forest/cream/sage colours, Lora/DM Sans typography and spacing. Do not reactivate the saved expanded sections. Add a **Blog** navigation link to `/blog/`, with articles at `/blog/<slug>/`. On blog pages, company links return to `/#about`, `/#products`, etc. No blog feed or new editorial section on the homepage. All customer contact remains email-only, initially **ohajiugwochimeziebibi@gmail.com**; no comments, public accounts, contact forms, checkout or phone/WhatsApp features.

## Recommended architecture and alternatives

**Default recommendation:** keep the existing public templates and static output; add a separate `/admin/` application and server endpoints; use Supabase Auth, Postgres and private Storage. Proposed hosting is Cloudflare Pages with narrowly routed Pages Functions for administration, private preview and integration endpoints. Public homepage/blog requests remain static and independent of Supabase availability.

| Approach | Trade-off |
| --- | --- |
| **Existing frontend + Supabase + static releases** | Best preserves approval, fast public pages, explicit security and publishing controls. Requires a custom dashboard and publishing coordinator. Recommended. |
| Managed structured CMS + its accounts/media | Less custom editing infrastructure, but administrator seats, revisions, preview and API limits must be checked against two equal users; creates vendor dependence and replaces the preferred Auth approach. Evaluate a named provider only if the owner prefers this direction. |
| Runtime-rendered site + Supabase | Immediate content changes and fewer rebuild steps, but public availability depends on the database unless a separate durable cache is engineered. A framework rewrite adds unnecessary homepage risk. |

Build changes would introduce validated content input, blog templates, clean output generation, sitemap/canonical/article metadata, image processing and release manifests. The existing renderer becomes a shared renderer accepting data rather than importing live database state. Local development uses fixtures; a production build must fail rather than silently substitute fixtures or stale data. Public assets must never contain drafts, administrator details or credentials. Add only dependencies justified by authentication, safe article editing and image processing; keep admin scripts out of public pages.

## Structured content and publishing

| Record | Fields and constraints |
| --- | --- |
| Company/homepage | Existing text slots, mission/values, separate headquarters/farmland, hectares, contact email, photo references and metadata. Fixed section order and card counts; no layout, CSS or arbitrary new-section controls. Store unused profile fields without automatically displaying them. |
| Products/services | Existing three product previews, supporting range/availability note and three service previews. Titles, concise descriptions, images and enquiry labels; length limits based on approved copy and phone previews. More items require a separately approved design change. |
| Blog post | Stable ID, unique safe slug, title, short excerpt, cover image/alt text, constrained rich-text blocks, optional confirmed author, timestamps, draft revision and published revision. Paragraphs, headings, lists, images and safe links; no raw HTML/scripts/embeds. No invented authors or claims. |
| Photographs | Immutable object/version ID, display name, folder/tags, alt text, description, credit/licence/source, authentic/stock provenance, focal point and usage references. Replacement creates a new version. |
| Supporting records | Immutable revisions; soft-deletion timestamps; administrator memberships/invitations; application sessions; audit events; immutable release manifests/jobs; timestamped health results. |

Seed content exactly from the approved homepage. Editing must retain British English and distinguish farm practices from customer services. Certifications remain omitted without evidence; future milestones must be explicitly described as plans if mentioned in a later article. Stock provenance remains in metadata/appropriate alternatives and the asset register, without reinstating visible preview badges or development notes.

**Editing:** Save draft → private preview → review change summary → Publish. Saving never changes the public website. Editing a published post creates a separate draft while the published revision remains online. Preview uses the same templates/styles behind a fresh administrator permission check, with `Cache-Control: private, no-store` and `noindex`. No public preview URLs, draft JSON, signed media links in public output or unprotected hosting preview deployments. Robots instructions alone are not access control.

**Publishing:** a server transaction captures the explicitly selected revisions into an immutable release, based on the current live release; unrelated drafts are excluded. A durable, serial queue triggers a secret Cloudflare build hook. The build claims that release, validates content/links, generates all public pages and copies only its approved photographs into the static output. Deploy atomically; confirm the provider's successful deployment before recording “Published”. A successful build alone is not proof of deployment. Job IDs, idempotent retries, timeouts and provider-status reconciliation handle lost callbacks and duplicate hooks. The dashboard shows Queued / Building / Deploying / Published / Failed and the currently live release. Build hooks must remain server secrets. [Cloudflare deploy hooks](https://developers.cloudflare.com/pages/configuration/deploy-hooks/)

Unpublish/delete runs the same release process to remove the article, listing entry, sitemap entry and unused public media; report removal as pending until confirmed live. A failed deployment retains the last successful release and clearly reports the failure. Rebuild into a fresh directory so deleted articles cannot survive as stale output. Never roll an older queued release over a newer one. Rollback creates a new release and rechecks current withdrawal decisions. Previously public material may remain in visitors' caches, downloads or search caches; unpublishing cannot recall those copies. Retained deployment URLs must also be restricted or retired when content is withdrawn.

**Simultaneous editing:** every save supplies its base revision. Database compare-and-swap rejects a stale save; show “This was changed by another administrator”, a comparison and options to reload or copy the local changes. No silent last-write-wins. Apply this to company information, media descriptions, publish operations and restores, not only posts. Presence hints are optional; revision enforcement is mandatory.

**Recovery:** retain saved revisions for 90 days initially and recently deleted content/media for 30 days. Restoring makes a new draft, never an automatic publication. Block permanent removal of media referenced by retained revisions/releases. Show storage usage before these retention policies become costly.

## Administrator experience

Use the saved design tokens and ui-ux-pro-max accessibility/touch guidance. Administration needs clearly labelled fields rather than public-page decorative layouts. Keep 16px+ form text, 44–48px touch targets, visible keyboard focus, readable contrast, reduced motion and status text alongside colour.

| Screen | Main tasks |
| --- | --- |
| Overview | Drafts, recent changes, live release, publishing failures, selected analytics and shortcuts. |
| Blog | Draft/published filters, create/edit, preview, publish/unpublish, version history and recently deleted posts. |
| Company Information | Fixed homepage fields, locations and contact email, validation and whole-homepage preview. |
| Products & Services | Edit existing compact previews without expanding the homepage. |
| Photographs | Upload/replace, folders/tags, descriptions/alt text, licence/provenance and “Used in” information. |
| Administrators | Active/pending/revoked list; invite, resend/cancel invitation and revoke access. Equal permissions throughout. |
| Website Health | Separate availability, performance, checks, publishing and backup results. |

On phones use a labelled navigation drawer, single-column editors and stacked record cards; seven destinations must not be squeezed into a bottom bar. Desktop uses a sidebar, tables and optional adjacent preview. Save/Preview/Publish controls remain reachable without covering fields or the keyboard. Show last saved time, explicit draft/live states and unsaved-change warnings; confirm destructive actions with the affected item and consequence. Do not claim a save succeeded after a network failure. Preserve text in the current editor for retry and offer copying before session expiry; avoid silently retaining sensitive drafts on shared devices.

Photos: multi-file selection, individual progress/retry/cancel, clear size/type errors and a mobile camera/library option. Validate actual file type and dimensions, reject executable formats, strip location EXIF and make responsive WebP/AVIF derivatives during the Node build. Suggested input limit: 10 MB per photo; originals private. No reliance on paid Supabase image transformation. Never overwrite an in-use original in place.

## Accounts and permission enforcement

1. **First administrator:** after separate service-setup approval, a maintainer runs a one-time local bootstrap command using credentials from an ignored local environment/secret manager. It checks for zero active administrators, sends an invitation to the owner-confirmed first address through Supabase's admin API, and records the pending membership. No public setup endpoint. The recipient verifies the invitation and sets their own password; only then activate membership. Do not log tokens or request passwords in chat. The first administrator invites the father through the dashboard; both have identical powers. [Supabase invitations](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
2. Disable public registration and anonymous sign-in. Each subsequent invitation requires an active administrator, recent reauthentication, a pending invitation tied to the recipient and an allowlisted HTTPS redirect. A fixed localhost redirect is allowed only in the isolated local development configuration; never use broad/wildcard production redirect permissions. Links are expiring and single-use; resending replaces the application invitation token. Acceptance must recheck expiry/revocation and confirmed identity. Authentication without an active membership grants no editing rights.
3. Revoke membership immediately, invalidate application sessions and revoke Auth refresh sessions. Check active membership/session on every privileged request; do not rely on a stale JWT role. A database transaction locks administrator membership changes and refuses removal/disabling of the last active administrator, including concurrent removals. Pending invitees do not count. Restrict direct table writes so this cannot be bypassed through the API. Infrastructure owners could still alter Supabase directly; restrict provider-console access and document emergency recovery separately.
4. Enforce least-privilege database grants and RLS on every content/revision/admin table and Storage objects. No anonymous read of editorial tables or private buckets; public reads use static releases. Ordinary content requests use the validated user's context; privileged Auth operations use a server-held secret only after explicit permission checks. Membership modification goes through guarded transactional functions, with locked-down function privileges/search paths. Test denied access directly against database, storage and server APIs. [Database RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access](https://supabase.com/docs/guides/storage/security/access-control)
5. Server-mediated Supabase email/password login, password reset and logout; Secure, HttpOnly, SameSite cookies, CSRF protection and strict redirect allowlists. Keep refresh tokens out of browser storage. Recommend application-enforced 30-minute idle / 12-hour absolute sessions, recent sign-in for invitations/revocation, and optional authenticator MFA. Provider-native session timeout controls require Pro; free-plan timeouts must be enforced on the server, not merely by hiding the dashboard. Logout invalidates the application session immediately. [Supabase session behaviour](https://supabase.com/docs/guides/auth/sessions)
6. Rate-limit login/reset/invite attempts by IP and account using durable counters, with generic login/reset responses, backoff and CAPTCHA on suspicious attempts. Allow password managers/paste. Retain security audit events without passwords/tokens; redact logs. [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)

Private media previews use short-lived authorised access and private caching rules. Large uploads can use short-lived, object-specific upload grants; issuing and completing uploads both require permission checks. Already issued signed URLs remain usable until expiry, so keep their lifetime short. Never ship service-role keys, SMTP credentials, monitoring/API tokens, deploy hooks or database credentials in HTML, browser JavaScript, Git or public build artifacts.

## Analytics recommendation

| Service | Free suitability and dashboard work |
| --- | --- |
| **GA4 Standard — proposed default** | Free collection with page/session/referral reports and custom email-click events. Integrate server-side through the Data API: create a Google Cloud project, enable the API, grant a dedicated reporting identity read-only property access, query/cache aggregate reports, then draw accessible dashboard charts. More privacy/consent work. [Google Analytics](https://marketingplatform.google.com/about/analytics/) |
| Cloudflare Web Analytics | Free, privacy-oriented page/visit and performance metrics; six-month history. No custom events, so cannot alone meet email-click reporting. A custom reporting adapter would use available GraphQL datasets and separately collect clicks; verify dataset access before promising dashboard parity. [Overview](https://developers.cloudflare.com/web-analytics/about/), [limitations](https://developers.cloudflare.com/web-analytics/faq/) |
| Umami Cloud Hobby | $0, one website, 100,000 events/month, six-month retention. API access is listed under Pro ($20/month), so do not promise free API-driven dashboard integration. An external vendor report is less integrated; self-hosting removes the hosted-plan restriction but adds server/database maintenance. [Pricing](https://umami.is/pricing) |

GA4 dashboard: **Visits** means sessions, normally ending after 30 minutes of inactivity; **Page views** counts page displays/reloads, not people. Scrolling between homepage anchors does not create extra page views. Show top page/post paths, session referral sources where supplied, and `email_click` counts by button placement. Email clicks indicate an attempt to open an email application, **not an email sent or received**. Copy-email actions, if measured, are separate. [Session definition](https://support.google.com/analytics/answer/12798876)

Provide last 7/28/90 days and custom ranges with equal previous-period comparisons in Africa/Lagos time. Show collection start, last refreshed time and partial periods; a failed query is “Report unavailable”, not zero. A genuinely empty successful report is “No data yet”. Exclude `/admin/`, private previews, test environments and authenticated administrators' public browsing where practical. Exclusion can miss other devices or cleared cookies. Consent refusal, blockers, disabled JavaScript, referrer restrictions, bots and reporting delays limit accuracy. Do not fabricate historical data or promise exact visitor counts.

**Privacy default:** analytics off until an explicit opt-in; no Google request before consent, no advanced-mode cookieless pings. Offer equally clear Accept/Decline and a persistent way to change the choice. No advertising features, Google Signals, personal email addresses, draft titles or URL query strings in events. Explain processors, purposes, retention and international processing in a privacy notice; review applicable Nigerian and visitor-jurisdiction requirements before launch. This is a proposed consent control/notice for review, not permission to redesign or expand homepage sections. Keep essential admin session cookies separate from optional visitor analytics. [Google basic/advanced consent modes](https://developers.google.com/tag-platform/security/concepts/consent-mode)

## Honest website health

| Separate panel | Evidence and schedule |
| --- | --- |
| Availability | Better Stack HTTP/keyword checks of deployed homepage/blog, initially every three minutes; show last check and recent incidents, not a claim about untested functionality. Not meaningful before deployment. |
| Loading performance | Lighthouse lab measurements at release time, mobile and desktop, with URL/device/run time. Label lab results clearly. Field data stays “No data yet” unless a real field-data integration supplies enough observations. |
| Links and checks | Local links/assets/anchors and public-content/privacy checks on every release; weekly external-link checks from an approved hosted runner, independent of the owner's laptop. Allowlist external requests, limit redirects/timeouts and treat blocked/rate-limited checks as inconclusive. Mailto validation cannot prove inbox delivery. |
| Publishing | Release/job stage, provider deployment result, affected revision, last successful release, error and retry action. |

Every panel displays its own source, last-run time and freshness. Use **Not configured**, **No data yet**, **Check failed**, or a timestamped result as appropriate; stale success is marked stale. Never infer overall health from an HTTP 200. Better Stack's API can supply status and `last_checked_at`; its token stays on the server. [Free monitoring](https://betterstack.com/uptime), [monitor API](https://betterstack.com/docs/uptime/api/get-a-single-monitor/)

## Verified limits, costs and required setup

Official public documentation checked **16 October 2026**; quotas and eligibility must be rechecked when setup is approved. USD figures exclude tax, exchange-rate changes and domain registration. These are estimates of service charges, not implementation costs or permission to incur charges.

| Item | Current limit / implication |
| --- | --- |
| Supabase Free | Two active projects; 500 MB database/project, 1 GB file storage, 5 GB egress plus 5 GB cached egress, 50,000 monthly active Auth users. Low-activity projects can pause after seven days; owner resumes in provider console. Editing/login/publishing may stop; static public releases remain available. Pro starts at $25/month and avoids inactivity pausing. [Pricing](https://supabase.com/pricing), [pausing](https://supabase.com/docs/guides/platform/free-project-pausing) |
| Supabase email | Default delivery is restricted to provider-team addresses and two messages/hour, without production delivery guarantees. Configure custom SMTP before real invitations/resets. Custom SMTP starts with an Auth email rate limit of 30/hour; resets also have a default 60-second per-user interval. Check invitation/reset flows and configured limits, not just provider monthly allowance. [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Auth limits](https://supabase.com/docs/guides/auth/rate-limits), [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) |
| Resend SMTP — proposed | Free: 3,000 emails/month, 100/day; paid Pro currently $20/month for 50,000/month. Requires a domain the owner controls and DNS verification; use a dedicated sending subdomain with SPF/DKIM and appropriate DMARC, disable link tracking, test Gmail/spam delivery. The existing Gmail enquiry address remains unchanged and cannot itself be verified as an owned sending domain. Domain price depends on the chosen name/TLD. [Pricing](https://resend.com/pricing), [domain verification](https://resend.com/docs/dashboard/domains/introduction), [SMTP](https://resend.com/docs/send-with-smtp) |
| Cloudflare public hosting/builds | Pages Free: 500 builds/month/account, one concurrent build, 20-minute timeout, 20,000 files/site, 25 MiB/file. Static requests are free/unlimited when they do not invoke Functions. Draft saves/previews must not trigger builds. Every publish/unpublish/retry consumes capacity; expose usage and delay rather than lose changes. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [static/Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) |
| Admin server | Pages Functions share Workers Free quota: 100,000 requests/day, 10 ms CPU/request; no image conversion or full-site rendering there. Use Node build runners for heavy tasks. Profile auth/preview handlers before committing to free hosting; do not silently upgrade if they exceed limits. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Analytics reporting | GA4 Standard Data API: 200,000 core tokens/property/day, 40,000/hour, 14,000/project/property/hour and ten concurrent core requests. Cache reports and back off on errors. Standard event/user-level retention has 2/14-month options; propose 14 months for annual comparisons, noting standard aggregate report retention differs. No paid BigQuery export is needed. [API quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas), [retention](https://support.google.com/analytics/answer/7667196) |
| Availability | Better Stack advertises ten monitors, ten heartbeats and one status page free with three-minute checks. Proposed dashboard uses one server-side integration, not separate paid provider seats for each farm admin. Prove API entitlement and available history in setup acceptance; do not assume paid alert channels/transaction checks are free. [Free plan](https://betterstack.com/uptime), [frequency](https://betterstack.com/docs/uptime/check-frequency/) |
| Backups | Supabase Free does not include downloadable automatic database backups. Photos require a separate backup even on paid plans. Backup downloads, image copies into releases and exports consume bandwidth; incremental photo copying and usage alerts are necessary. [Backup coverage](https://supabase.com/docs/guides/platform/backups) |

**Likely starting service cost:** $0/month within these allowances, plus an owned domain and a reliable backup destination; this accepts free-backend pauses and no guaranteed availability. For dependable editing availability, budget Supabase Pro from $25/month only if approved. There is no honest guarantee that the entire system will remain free indefinitely. Disable paid trials/automatic overages where possible and alert before quota exhaustion.

Bandwidth needs a real budget: exporting a full 500 MB database daily is roughly 15 GB/month before photographs, exceeding the listed free egress allowance. Likewise, repeatedly copying a growing photo library into releases can exhaust it. Measure actual compressed exports, reuse unchanged media/build caches and choose an affordable backup frequency or separately approved upgrade; never silently weaken the recovery target or assume free limits cover every workload.

External setup, only after approval: owner-controlled Supabase, Cloudflare, private GitHub source hosting, SMTP account/domain DNS, backup storage, GA4 property/reporting identity and Better Stack. Publishing uses Pages builds; backup/check jobs use a separately approved hosted scheduler as described below. Document ownership, recovery codes, secret rotation and who handles provider outages; farm administrators never need Git or a terminal to publish. No accounts, scheduled workflows, automatic deployment hooks, billing or public deployment are configured by this proposal.

## Backup, export and recovery

Git/tag protects code and the original design, **not future database records or uploaded photographs**. Revision history is convenient recovery, not an independent backup.

**Simplest recommended launch arrangement:** one daily hosted backup job in a private GitHub repository, saving an encrypted database dump and an incremental copy of immutable original photographs into a private Cloudflare R2 Standard bucket. Neither the job nor storage depends on either administrator's laptop. It is separate from Supabase, so deleting the editing project does not delete its only backup. Keep seven daily, four weekly and three monthly recovery sets; manifests retain shared photo objects until no retained set needs them. A quarterly offline encrypted copy is an extra safeguard, not a dependency of the daily backup.

Store content JSON, schema/migrations, revision/media manifests with checksums, originals, release IDs and relevant Auth/membership data securely. Use encryption before upload and dedicated scoped backup credentials in the runner's secret store; no public bucket, website artifact, repository commit or log may contain exports, tokens or passwords. Keep decryption/recovery material in an owner-controlled password manager with emergency access, separate from the runner and bucket. Operational secrets/configuration need their own secure recovery inventory. Test compatible database connectivity before adopting the runner; do not assume a paid networking add-on is necessary.

**Who operates it:** a named technical maintainer installs/configures the job once after approval, handles failed-run alerts, fixes exports and conducts quarterly restore drills. One of the two farm administrators is the accountable backup owner: receives overdue alerts, reviews the latest successful backup weekly and contacts the maintainer when it is overdue. The owner/father need not run daily terminal commands. Naming the maintainer and backup owner is a Stage 3 decision and a launch requirement; no ongoing maintenance service is assumed to exist.

GitHub schedules are best-effort and can be delayed or dropped. Send a success heartbeat only after checksums and uploads pass; an independent hosted missed-heartbeat alert must notify the backup owner after 36 hours without success. Use a free Better Stack heartbeat, subject to its setup/notification checks. This essential backup alert and its external account belong to Stage 3 even though the broader health dashboard comes in Stage 4. A green workflow exit without a usable backup is not success. Target daily recovery points while jobs succeed, not a guaranteed 24-hour loss limit. Supabase pauses, quota exhaustion or credential failures can interrupt backup access and require maintainer intervention. [GitHub scheduling limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [free heartbeats](https://betterstack.com/uptime)

**Costs/approval:** GitHub Free currently includes 2,000 standard-runner minutes/month for private repositories and 500 MB artifact storage; backups go to the private bucket, not Actions artifacts/caches. R2 Standard includes 10 GB-month storage, one million Class A operations and ten million Class B operations/month, with free Internet egress. These are allowances, not a hard free-only guarantee: R2 requires subscription activation, bills excess usage and needs explicit billing approval before setup. Review billing/payment requirements, expected retained size, spending alerts and runner usage first. Supabase export egress still counts. If the owner declines a metered storage product, select an existing suitable private backup destination or obtain approval for an alternative before launch; do not silently fall back to laptop-only or manual-only backups. [GitHub allowance](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 setup](https://developers.cloudflare.com/r2/get-started/)

Provide an administrator download/export option for structured content and photographs, with short-lived authorised downloads. It is additional convenience, not the scheduled backup. Full provider/Auth disaster restoration remains a documented maintainer operation. During local development use local disposable backup destinations and a second local database; the external runner/bucket/alert integrations remain unverified until separately approved and tested.

Before launch and quarterly thereafter, restore into an isolated environment: schema/RLS, content/revisions, Auth identities/memberships and actual photo bytes; verify checksums and references, reset sessions/secrets as needed, rebuild and compare public output before switching. Never restore an old membership list into production without reviewing revoked users. Target same-working-day recovery during supported hours, measured by the first drill rather than promised as an SLA. Keep the last public static release online throughout. [Supabase database and Storage backup distinction](https://supabase.com/docs/guides/platform/backups)

## Stage gates and decision checklists

### Stage 1 — Blog and structured editing

**Build locally:** content schema/validation, exact approved-content seed, shared renderers, blog list/article templates and fixed-field editor screens using disposable fixtures. Establish revision IDs, draft/published separation and deny-by-default policy design now. Treat persistence as a local prototype until Stage 2 secures it. No external account/domain needed.

**Accept when:** homepage comparison at 375/768/1024/1440px preserves section/heading order, original copy/card counts, centred hero, minimal labels and anchor/email behaviour; blog routes and editor validation work; draft fixtures never appear in public output. Change the existing “one HTML file” test to “one company homepage plus blog routes” while retaining homepage-preservation checks. Review and save a stage checkpoint; keep the recovery tag/archive intact.

**Before this stage, owner checklist:**

- [ ] Approve local Stage 1 work only, preserving the homepage and Gmail enquiry address.
- [ ] Accept the proposed fixed fields and limited blog formatting; recommend anonymous test articles rather than real unpublished material.

### Stage 2 — Secure accounts, photographs and private previews

**Build/test locally:** approve/install local prerequisites, run local Supabase, implement permissions and secure account/bootstrap flows, structured draft persistence, conflict checks, photo library/uploads and authenticated previews. Use **Mailpit for every local invitation/reset test**. No purchased sending domain, external SMTP account or hosted Supabase project is needed at this point.

**Accept when:** two equal accounts can edit; invite/reset/logout work through the test inbox; expired/cancelled/replayed invitations fail; unauthenticated and signed-in non-admin direct database/storage/API requests fail; revocation works with old tokens; concurrent last-admin removals and stale saves are rejected. Test CSRF, unsafe article HTML/URLs, malicious uploads, private cache headers and absence of secrets/draft media in public output. Phone uploads, focus/keyboard use, unsaved-change warnings, slow networks and accessible errors must work. CAPTCHA live-provider behaviour and real SMTP delivery remain explicitly pending.

**Before this stage, owner checklist:**

- [ ] Approve local Supabase/Docker/CLI setup and disposable local identities; confirm the developer can use a compatible machine.
- [ ] Confirm equal administrator permissions and secure invitation-based setup. Real invitation addresses can wait until hosted setup; no passwords in chat.

### Stage 3 — Publishing and content/photo recovery

**Build/test locally first:** immutable release queue/generator, publish/unpublish state transitions, revisions/trash/restore, encrypted exports and DB-plus-photo restore. Use provider test doubles to exercise deployment failures, retries, lost callbacks and concurrent publishes without enabling real hooks. Restore into a separate local database and compare file checksums/references. Earlier-revision recovery and backups must work before important content is entrusted to the system.

**Then, only with separate setup approval:** create owner-controlled hosted backend/source/hosting accounts, configure the free transactional-email service and verified sending domain, establish the hosted backup job/private destination and missed-run alert. Prove hosted permissions, controlled real invite/reset delivery and off-site backup/restore. A separately approved protected test deployment proves HTTPS callbacks, release promotion and retained-URL privacy; it is still a deployment and requires permission. Public launch is a further explicit decision.

**Accept when:** no selected draft phrase/photo appears in public artifacts, sitemap, cacheable endpoints or accessible hosting previews; failed publish leaves the last successful site available; withdrawal removes stale output; only confirmed deployments show Published. Recovery makes a draft, not an automatic publication. Prove a cloud backup restore and missing-heartbeat alert with laptop off. Record real email delivery tests separately from Mailpit results. No production content launch until these gates pass.

**Before local Stage 3, owner checklist:**

- [ ] Accept 30-day trash and 90-day saved revisions, and review recovery behaviour.
- [ ] Approve local publishing simulations and local restore drills; this does not enable deployment.

**Before external setup/launch, owner checklist:**

- [ ] Identify two real administrator emails and the owner of provider accounts/recovery access.
- [ ] Supply an existing controlled domain or approve registration/renewal cost; approve sender subdomain, DNS and free SMTP setup. Keep Gmail public enquiries unchanged.
- [ ] Choose Supabase Free with possible editing pauses or separately approve Pro; approve the specific external accounts and publishing automation.
- [ ] Name a backup owner and technical maintainer; approve the hosted scheduler, private storage destination, billing exposure and missed-run alerts.
- [ ] Separately authorise any protected test deployment; authorise public launch only after review and successful gates. Neither is authorised now.

### Stage 4 — Analytics and website-health reporting

**Build/test locally:** dashboard adapters and honest empty/error/stale states; date comparisons; consent controls; email-click instrumentation; link/performance checks. Test fixtures must be labelled as local test data and never masquerade as real reports. Security, publish failures and essential backup alerts already work before this optional reporting layer.

**External accounts needed:** approve GA4/reporting identity and website-monitoring setup, reusing the Better Stack account approved for Stage 3 backup alerts. **Deployment needed:** validate consented real events, administrator exclusion, HTTPS/site checks and actual uptime; show No data yet until observations arrive. Local Lighthouse results can be useful but cannot establish deployed performance or public availability. Publish/error panels can report real local test jobs without claiming they are production jobs.

**Accept when:** consent decline sends no analytics requests; accept/withdraw work; email clicks are labelled as clicks, not sent enquiries; provider failures never become zero counts or green health. Each separate health panel shows source/time/freshness, including Not configured or Check failed. Verify date ranges and real test events against the provider. Run the existing checks/production build and relevant new security/integration tests at the end of each implementation stage; report unavailable browser/service checks. Update HANDOFF.md at each completed stage with remaining gates and operating responsibilities.

**Before this stage, owner checklist:**

- [ ] Approve analytics choice and the consent control/privacy notice; recommend the proposed GA4 opt-in default.
- [ ] Approve reporting/monitoring accounts and name the recipient of website alerts. Backup alerts must already have an owner from Stage 3.
- [ ] Confirm which deployed environment may collect real data; no deployment or tracking activation is implied by approval of local dashboard work.

## Decisions proposed versus questions remaining

**Recommended defaults for approval:** retain frontend; Supabase with private media; static atomic publishing through Pages; structured fixed homepage fields; equal invite-only administrators; revision conflicts; 30-day trash/90-day revisions; GA4 with opt-in consent and private API reports; Better Stack uptime; encrypted independent backups. No scheduled publishing, public registration, page builder or extra homepage sections in the initial scope.

**Owner choices needed before setup:**

- Final domain and DNS control; approve a sending subdomain and separate authentication sender identity. The public enquiry email is already confirmed.
- Two administrator invitation email addresses, supplied when setup is approved; no passwords. Decide who owns provider accounts and keeps emergency recovery access.
- Accept free Supabase pauses, or separately approve the Pro budget for dependable editing; approve each external account and publishing automation before configuration.
- Accept the proposed analytics consent control/privacy notice, or prefer a privacy-oriented alternative with different integration/cost trade-offs.
- Name the backup owner, hosted destination and technical maintainer; approve scheduler/storage setup and any billing exposure. Daily backups must not depend on a laptop running.

Authentic photographs and a logo remain optional replacements, not reasons to alter the approved layout. Certification evidence is needed only if such claims are requested. **Approval of this proposal does not authorise a paid plan or public publication.**
