# Free hosting preparation — first deployment approved, not yet performed

Owner reported signed into the existing Cloudflare account; **Workers & Pages showed “No projects found”** and Billing showed **Workers Free — Active**. The owner approved the first preview deployment of the private admin artifact. Project `ohajiugwo-farms-development` now exists with no Git integration; preview branch `stage2-preview` is deployed. Admin routes remain closed. No secrets, bindings, custom domain, schedule or paid service has been configured. Do not create a duplicate account or connect a repository.

## Completed read-only account check

At the account level (not a website/domain), open **Manage account → Billing**, then **Subscriptions**, following the [Cloudflare billing guide](https://developers.cloudflare.com/billing/understand/how-billing-works/). Dashboard variants may show Billing directly in the account sidebar. Inspect Workers/Pages-related subscriptions and any Free/Paid label. A website's Free zone plan alone does not confirm Workers billing. If billing is unavailable to your account role, report that rather than starting an upgrade. Report only “Workers Free”, an existing paid subscription's name/status, or “no Workers subscription/plan label shown”. Do not paste billing details, payment information or credentials. Leave Add/Upgrade/Purchase buttons untouched.

The billing inspection is complete; do not repeat it without cause. The account initially had no projects to reuse; the approved project has since been created by Wrangler. Dashboard quick-start creation remains deferred. Do not follow a quick-start that publishes a Hello World Worker or connects Git.

## Prepared locally

`npm run hosting:build` creates ignored `hosting-output/` with a module `_worker.js`, explicit `_routes.json`, metadata, disallow-all robots and allowlisted logo/fonts. It uses the actual shared `functions/[[path]].js` application composition, not a separate mock production server. The artifact deliberately contains no public homepage/Blog/sample pages, editor prototype, fixture server, `.env.admin` or source maps. This is a **development administration preparation artifact**, not a public website release.

The portable entry composes the acceptance/callback/session/browser/API services, equal-admin screen, persistent editor and gated private-media workflows. Administration stays private 503 by default. The exact development gate `ADMIN_ENABLE_DEVELOPMENT_ROUTES=confirmed-development-only` plus validated server-only config would be required to enable development routes; **it has not been set locally with hosted credentials or in Cloudflare**. The equal-admin route requires `ADMIN_ENABLE_ACCOUNT_LIFECYCLE=confirmed-development-only`, which remains unset. Provider invitation issue and recovery remain independently gated; “ready for delivery” does not send mail. Bootstrap prepare/issue has no HTTP route; the executable remains disabled. The auth cleanup Worker schedule requires `ADMIN_ENABLE_CLEANUP_WORKER=confirmed-development-only`; the private media queue separately requires `ADMIN_ENABLE_MEDIA_CLEANUP_WORKER=confirmed-development-only`. Both gates are unset and the cron trigger remains commented out. No real provider call is made by local build/runtime tests.

Cloudflare's Pages Functions documentation says Pages supports a subset of bindings and lists Service bindings, but does not list the Images binding. The Images binding documentation describes configuring `env.IMAGES` on a Worker. Based on those supported-binding lists, the private media processor is prepared as a separate internal-only Worker (`wrangler-image-processor.toml`) with the Images binding, and Pages uses a private service binding named `MEDIA_PROCESSOR`; neither Worker deployment nor binding configuration has happened. This avoids moving private photo bytes through a public URL. Cloudflare says the Images Free plan allows up to 5,000 unique transformations per month, after which new unique transformations fail with an error; this flow uses two derivative parameter sets per uploaded photo, so the implied free ceiling is about 2,500 distinct uploads/month before other account usage. No paid Images plan is needed for that free quota; exceeding the quota fails closed rather than automatically changing this project to a paid plan. See [Pages binding support](https://developers.cloudflare.com/pages/functions/bindings/), [Workers Images binding](https://developers.cloudflare.com/images/optimization/binding/) and [Images pricing](https://developers.cloudflare.com/images/pricing/). This quota/cap and service-binding behavior have not been tested on the owner's account.

Browser CSS/JS and fonts are explicitly bundled; configuration/credentials are not build inputs. Node tests invoke the compiled worker directly, including login HTML, private assets and closed endpoints. The local browser test uses the actual entry with injected provider/RPC fixtures. These Node/browser tests do not establish deployed HTTPS cookie behavior, real Supabase Auth or email delivery. Local Pages runtime/static dispatch is verified separately below.

Cloudflare's [advanced mode documentation](https://developers.cloudflare.com/pages/functions/advanced-mode/) describes module `_worker.js`; [routing documentation](https://developers.cloudflare.com/pages/functions/routing/) describes `_routes.json`. Local Wrangler 4.151.1 / workerd emulation and Pages private/static dispatch pass with dummy/no bindings. The CLI remains an npm-cache tool, not a repository runtime dependency. The approved Pages project now exists and has only a preview deployment; no Git integration, custom domain or purchase occurred.

Use [STAGE-2-CHECKLIST.md](STAGE-2-CHECKLIST.md) as the sole current remaining-work checklist. Do not infer readiness to deploy from this successful build.

## Prepared server-binding matrix (names only; not configured)

These would be entered privately as runtime bindings only after selecting the owner-controlled development project/origin. Do not replace the preserved local key, print values or put them in the build. No binding has been written to Cloudflare.

| Binding | Preparation / source |
| --- | --- |
| `ADMIN_ENVIRONMENT` | `hosted-development`; only supported environment |
| `ADMIN_ORIGIN` | Exact future development HTTPS origin, no wildcard/path; not known before project selection |
| `SUPABASE_PROJECT_REF`, `SUPABASE_URL` | Existing ohajiugwo-development only; URL must match ref |
| `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Private runtime configuration; secret key in provider secret storage |
| `ADMIN_SESSION_KEY` | Preserve existing key from owner-only local configuration; provider secret storage; never bake into worker |
| `ADMIN_ENABLE_DEVELOPMENT_ROUTES` | **Leave unset**. Exact enablement value is documented above for later controlled verification, not approval to enable now |
| `ADMIN_ENABLE_ACCOUNT_LIFECYCLE` | **Leave unset**. Separate gate for the local inventory/revoke/cancel route; invitation issuance/acceptance/reset are still unfinished |
| `ADMIN_ENABLE_PROVIDER_INVITATION_ISSUE` | **Leave unset**. Separate gate for provider invitation identity/link issuance; no email transport is called |
| `ADMIN_ENABLE_PROVIDER_RECOVERY_ISSUE` | **Leave unset**. Separate gate for recovery link generation; no email transport is called |
| `ADMIN_ENABLE_PRIVATE_MEDIA` | **Leave unset**; 008/009 SQL is owner-reported PASS, but no first deployment or `MEDIA_PROCESSOR` binding is configured |
| `MEDIA_PROCESSOR` | Pages Service binding to `ohajiugwo-image-processor-development`; not configured |
| `ADMIN_ENABLE_CLEANUP_WORKER` | **Leave unset**. Separate scheduled auth cleanup gate; SQL 005/006 is owner-reported PASS, but cron remains disabled |
| `ADMIN_ENABLE_MEDIA_CLEANUP_WORKER` | **Leave unset**. Separate scheduled private-media cleanup gate; SQL 008/009 is owner-reported PASS, but cron remains disabled |

For the internal processor Worker only, `IMAGES` is a Cloudflare Images binding declared in `wrangler-image-processor.toml`. `workers_dev=false` and no custom route are prepared so the image Worker is reachable only through the Pages Service binding. Neither the service nor the Images binding has been attached or deployed. Cloudflare documents the Workers Free limits as 100,000 requests/day, 10 ms CPU time and 128 MB memory; the image codec work is delegated to the Images binding, but request parsing/copying and real binding behavior remain to be verified under that limit. See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

Keep Git integration and automatic builds absent. Do not create a quick-start Worker, upload files or run deploy commands to reserve a name. A preview deployment is still a first deployment and needs approval. Free-plan confirmation does not close runtime/HTTPS, cleanup, lifecycle or persistent editor/media gaps in the Stage 2 checklist.

## Safe hosted command/Storage probes (completed; limited scope)

`npm run admin:test-stage2-access` checks selected NEW005/006/008 service-role validations, anonymous denials and the NEW007 content RPC denial to service role/anonymous, using only guaranteed-invalid or missing-actor inputs that fail before writes. `npm run admin:test-stage2-storage-access` creates a uniquely named temporary object, verifies service access and anonymous direct-object denial, then removes and verifies removal. `npm run admin:test-stage2-nonmember-access` was owner-approved and passed: it created a random confirmed synthetic Auth identity without invoking email endpoints, checked content RPC and direct private-object denial using its user JWT, then verified identity/object removal. No email was sent. These probes do not test active members, application preview, Images binding or concurrency. The Storage API requires an authenticated user Authorization header to download from a private bucket; see [Supabase private bucket downloads](https://supabase.com/docs/guides/storage/serving/downloads). Hosted evidence and the limits of each check are tracked separately in HANDOFF/checklist.

## Local runtime verification (completed; not hosted)

`npm run hosting:check-runtime` explicitly downloads/uses pinned Wrangler 4.151.1 and runs Pages dev/workerd locally in a disposable temporary directory. It allowlists the child environment, uses isolated XDG/current Auth paths and an empty npm user config, disables metrics, never loads `.env.admin`, and sets no remote bindings. HOME is preserved: Wrangler can still consult legacy `~/.wrangler` global configuration, so this is not a filesystem sandbox or a guarantee that all inherited configuration is inaccessible. No real API credentials were injected and no account/login/deployment operation occurred. Two runtime instances run sequentially: no bindings/default private 503, then dummy development bindings. Both are stopped and temporary files removed. No Cloudflare account is needed; do not substitute real credentials or `--remote`.

Passed: actual compiled worker startup, private no-store routes, dummy login/callback, anonymous confirmation redirect, Web Crypto login-CSRF HttpOnly cookie, missing-CSRF denial before provider access, exact private assets, static logo/robots, and 404 for prototype/env/worker/routing source paths. The first run exposed a Pages static reserved-file 502 for `/_worker.js`; explicit private-handler routes for that file and `/_routes.json` now produce controlled 404s. A failing route regression reproduced the missing rule before the fix.

This is local HTTP emulation only. Browser authentication in the runtime, real secrets, deployed HTTPS/Secure cookies, provider/DB/concurrency/recovery and release readiness remain unverified.

## Approved first free Pages deployment (pending owner Wrangler authorization)

Cloudflare documents [`wrangler pages project create`](https://developers.cloudflare.com/workers/wrangler/commands/pages/#pages-project-create) separately from deployment. Once the owner has authenticated their CLI privately to the intended existing Free account, an empty development project can be created without uploading the artifact:

```bash
npx --yes wrangler@4.151.1 pages project create ohajiugwo-farms-development --production-branch main
```

Owner approved and the first preview deployment is complete. Project `ohajiugwo-farms-development` was created through Wrangler with production branch `main` and preview branch `stage2-preview`; Wrangler confirms zero production deployments and Git remains unconnected. Preview: [stage2-preview.ohajiugwo-farms-development.pages.dev](https://stage2-preview.ohajiugwo-farms-development.pages.dev/). Hosted HTTPS verified TLS, private/no-store/noindex 503 for administrator routes, 404 at `/`, and disallow-all `robots.txt`. The image processor Worker/service binding, runtime secrets, development-route gate, cleanup schedules and custom domain remain unset. No real account or email was used.
