# Production setup and remaining verification

Full local construction is in progress, not a declaration of launch readiness. Owner selected the existing free Pages domain: `https://ohajiugwo-farms-development.pages.dev`. Keep the distinct development Preview alias unchanged. No custom domain purchase, R2 activation or GA4 collection is authorised by code preparation.

## Separate evidence gates

- Local: focused unit/SQL/browser/build tests of the final integrated source; inspect public artifacts for fixtures/private data/secrets.
- Hosted schema: pending011 first, then reviewed prepared012 (immutable releases),013 (editorial photo metadata/recoverable trash),014 (default-disabled backup-gated retention). Do not rerun001–010. Review whole migrations and entire rollback scripts before owner execution. None is applied by the agent.
- Hosted authentication: resolve three Auth cleanup review jobs; verify actual additional-admin/reset delivery, old-JWT/direct DB/Storage denial and independent session/process races. Keep account/email operations separately approved.
- Private previews/uploads: new saved-revision preview, metadata CAS, trash/restore, format/limit/recovery/race checks against real provider/runtime; current local fixtures are separate evidence.
- Publishing: real runner/private worker credentials, production runtime config/redirect allowlist, selected release review, first-deployment approval, real provider-success + canonical release marker and old-public-deployment retirement after withdrawal. Build success is not Published.
- Backup: choose an independent private off-site destination and accountable owner/maintainer; verify actual pg_dump/snapshot/original-photo transfer, key recovery, destination locks, readback, isolated restore, heartbeat/missed-run alerts and scheduler. Do not activate metered R2 without reviewed billing approval.
- Reporting: create/approve GA4 property/reporting identity and monitoring source if desired; approve privacy notice/retention, disable enhanced measurement, verify consent/admin exclusion and real events. Until then all live collection is off and reports remain Not configured.
- Visual/accessibility: review current imagery/admin, manual 200% browser zoom, screen reader and physical mobile keyboard/touch. Prior design reviews do not transfer automatically.

## Production configuration preparation

Use owner-private environment/provider secrets only. Preserve `.env.admin` and its session key; do not paste credentials into chat. Production canonical origin must be exact HTTPS origin above. Authentication callbacks and allowlists must match the final origin, without wildcard preview links. Do not copy development-only feature gates to production without review. Keep public signup/anonymous signin disabled.

New features use exact development setup flags (`ADMIN_ENABLE_RELEASES`, `ADMIN_ENABLE_MEDIA_METADATA` = `confirmed-development-only`) and default off. These flags do not deploy or apply schema. Retention additionally defaults disabled in the database and requires independently verified offsite backup/restore evidence newer than its plan. Source/receipt proof must match the configured Supabase reference. Do not invent receipts to bypass this gate.

Production mode is now implemented behind separate exact gates: `ADMIN_ENVIRONMENT=hosted-production`, exact matching `ADMIN_ORIGIN`/`PUBLIC_SITE_ORIGIN`, and `ADMIN_ENABLE_PRODUCTION_ROUTES=confirmed-production`. Optional production features use `confirmed-production`, never the development flag value. Nothing is enabled by default. `scripts/run-release-worker.mjs` requires explicit first-production approval and matching complete private readiness evidence for a clean exact Git revision. `scripts/run-backup-worker.mjs` requires independently approved/verified private storage and source configuration. Neither script has been run against a provider. Do not call code preparation an enabled deployment/backup service.
