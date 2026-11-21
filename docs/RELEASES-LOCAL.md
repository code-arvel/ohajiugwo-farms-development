# Publishing and saved previews — local implementation

21 November 2026. Local implementation only; no production release or hosted migration was performed. The free production address selected by the owner is `https://ohajiugwo-farms-development.pages.dev`. The existing development Preview is separate.

The authenticated Publishing screen reads saved revisions, reviews an explicit selection and withdrawals, then queues an immutable release with captured per-article photo metadata, a unique request ID and current-live-base comparison. Preparing a release requires active membership, CSRF and password confirmation within five minutes. Unselected drafts stay private. A first release must select the homepage. Inherited articles and rollback retain their captured photo details; inconsistent shared-photo snapshots require explicit reselection. Date-less articles are rejected by the builder. A conflict requires review; an uncertain response requires reading history before any repeat submission. The queue and serial worker prevent competing publication, and ambiguous provider outcomes freeze for reconciliation. A timeout or successful build alone cannot become Published.

The Node builder creates fresh output using the existing homepage/Blog renderers, exact selected revisions, canonical links, sitemap, robots and privacy page. It verifies selected original-photo paths/checksums and captured editorial alternative text, bounds files/bytes and checks local links/fragments. Private drafts, preview links and backup files are never copied into public output. The separate private Pages runtime bundle preserves server-side authentication; browser assets use a fixed allowlist. Analytics stays absent unless explicitly configured and privacy-approved for the production origin.

`/admin/preview/:content-id/:saved-revision` renders a protected saved revision, never unsaved browser edits. Pages are private/no-store/noindex and clear on page exit; photo references remain authenticated. `/admin/export` provides recently authenticated POST downloads of active structured content/retained revisions and individual active processed-original WebP photographs. These are convenience downloads, not a complete independent backup or provider disaster restore. Downloads contain private content: keep them off public repositories, artifacts and shared storage. There are no reusable public download URLs; authorization is rechecked for each request.

## Local commands

```sh
npm run check:admin:unit
npm run check:operations
npm run release:fixture
node tests/admin/browser/readiness-qa.mjs
```

The fixture rehearsal uses dummy records and mocked deployment transport. Its output is never deployed. Browser QA uses an isolated temporary headless profile and loopback fixture, not the owner's Brave profile or a real account. It is separate from manual keyboard/screen-reader/zoom and hosted evidence. Screenshots: `docs/review/readiness-*.png`.

## Prepared migrations, not instructions to execute now

Pending 011 remains the next hosted checkpoint. Do not rerun 001–010. After 011 is reviewed, owner-applied and verified, review each entire new migration and its full rollback script in dependency order:

| Migration | Changes | Full verification |
| --- | --- | --- |
| 012 | Private immutable release snapshots/media references, serial lease queue, user-session/recent-password commands and service-only worker/reconciliation commands; existing content and policies preserved | `supabase/tests/releases.sql` |
| 013 | Bounded editorial metadata with CAS, usage inventory and recoverable 30-day private-photo trash; retains technical fields and existing references | `supabase/tests/media-metadata.sql` |
| 014 | Default-disabled backup-gated bounded retention, media cleanup journal linkage, 30-day article recovery expiry; keeps current revisions and referenced media; never deletes Storage directly | `supabase/tests/retention-execution.sql` |

Each migration requires its predecessor and refuses repeat application. 014 adds nullable cleanup linkage without changing previous jobs. It replaces article trash-list/untrash functions to enforce the recovery window, preserving session checks, PT409 conflicts and restored private/review-only revisions. Expiry does not itself purge rows. Retention execution remains off until separately verified off-site backup and restore proof exist.

Before any owner SQL execution, review again, record private backups/operational readiness, and inspect migration markers. Run `ROLLBACK;` separately to clear an earlier failed transaction, apply only the next missing reviewed migration once, then run its entire freshly saved verification file. A migration's “Success. No rows returned” is application evidence, not a verification PASS. The release rollback script is intended immediately after initial 012 setup and refuses a nonempty release queue; later regression verification belongs in an isolated environment. Its fixture uses an existing homepage read-only if present to preserve the singleton constraint. All fixture identities, posts, settings, receipts and release-state changes roll back. Do not run only the final PASS statement.

## Production runner remains disabled

`scripts/run-release-worker.mjs` requires explicit approval, private exact-revision readiness evidence, a clean Git tree, project confirmation and scoped provider configuration. No live invocation was performed. Existing `.env.admin` and its session key are unchanged. Do not enable development bootstrap or copy development feature values into production. Production routes use separate exact production gates.

The Cloudflare adapter verifies provider deployment success and the matching canonical `release.json` marker. A withdrawal cannot be confirmed without independently verified retirement of older public deployments containing it. The worker refuses a withdrawal before any build/deployment side effect unless the injected provider declares verified retirement capability; the real adapter currently does not. Automatic historic-deployment retirement and the recurring release-runner installation are still operational integration gaps, not verified features. Do not enable unattended production release processing until those are resolved and tested. Reconciliation of review jobs must use independent actual provider evidence, never blind resubmission or a manually forced success.

Remaining live gates: pending hosted migrations; Auth cleanup diagnosis/recovery and account/reset/session/access/concurrency tests; new media/preview/restore tests; independent off-site backup storage/owner/scheduler/heartbeat and actual isolated restore; final privacy/monitor configuration as applicable; manual accessibility/design review; owner approval of the reviewed first production release, merge/push/deployment. See `PRODUCTION-READINESS.md` and `STAGE-2-CHECKLIST.md`.
