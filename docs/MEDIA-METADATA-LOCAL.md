# Private media metadata and retention — local preparation

Migration `202611210013_media_metadata.sql` is prepared locally only. It requires markers `202610170009_media_content_refs` and `202611210012_release_commands`; 012 itself requires pending 011. Never rerun completed migrations or apply this file to hosted infrastructure as part of local verification.

`createMediaMetadataService({auth,provider})` in `server/media/metadata-service.mjs` exposes:

| Method | Authenticated RPC | HTTP integration |
| --- | --- | --- |
| `read(request,id)` | `farm_media_metadata_read(p_id)` | GET `/admin/api/media/:id/metadata` |
| `save(request,id,{baseRevision,editorial})` | `farm_media_metadata_save(p_id,p_base_revision,p_editorial)` | POST same path |
| `usage(request,id)` | `farm_media_usage(p_id)` | GET `/admin/api/media/:id/usage` |
| `listTrash(request)` | `farm_media_trash_list()` | GET `/admin/api/media/trash` |
| `restore(request,id,{baseRevision})` | `farm_media_restore(p_id,p_base_revision)` | POST `/admin/api/media/:id/restore` |

All calls use `provider.userRpc(name,params,accessToken)`, never a service-role credential. SQL rechecks the JWT subject, provider session ID, current membership and unexpired application session via `require_content_admin`. Saves/restores require mutation authentication (CSRF guard) and a positive base revision. A stale base returns `PT409` / HTTP 409. RPCs grant only authenticated execution; private history/plans expose no direct table grants. Existing media removal continues its existing cookie/session-authenticated service-role contract, retains every saved-content guard, and adds release-reference checks.

Metadata responses are `{id,revision,editorial,technical,deletedAt}`; restore adds `restoredAs:'draft'`. Image dimensions, `mimeType` and `byteSize` remain in their existing metadata positions. Editable fields live under `metadata.editorial`, with bounds: displayName 160, altText 500, description 2000, credit 300, licence 300, source 2048, provenance 2000, folder 120 characters; tags up to 20 entries of 50 characters; focalPoint `{x,y}` in `[0,1]`. Source is an optional HTTP(S) reference with no URL credentials. No source URL is fetched, imported, previewed or followed by the server. Editorial text is rendered using DOM text/value properties. Saving details does not update immutable content or release snapshots.

`admin/media/metadata.mjs` exports `await mount({root,media:{id},request,onSaved})`, returning a cleanup function. Load `admin/media/metadata.css`. The injected request function returns parsed JSON, throws an error carrying HTTP `status`, and attaches the existing CSRF token/content type on POST. It receives serialized JSON in `options.body`. The form loads persisted metadata and full saved-revision/release usage, submits the loaded revision, keeps entries on conflict, and supports restoring a deleted photo. The parent media screen owns selection/navigation and trash discovery; metadata can be read for deleted photos while private preview remains unavailable until restored.

After 013, removing an unused ready photo sets `deleted_at`, advances its revision and retains ready immutable bytes. It does not enqueue deletion or quarantine them. The trash RPC lists the newest 200 recoverable photos from the last 30 days; older entries within that window remain individually addressable by ID. A deleted photo is restorable for 30 days, with CAS and the same 200-active-photo capacity limit used by uploads; restore creates the next private metadata draft revision and does not publish, change content, or create a release. Media used by any saved revision or retained release cannot be removed. The earlier 008 unused-photo removal eagerly queued cleanup; already quarantined historical removals cannot be restored by claiming bytes still exist. Upload failure/expired-upload cleanup keeps its separate existing behavior.

`createRetentionService({auth,provider}).prepare(request)` calls `farm_media_retention_prepare()` with mutation authentication. SQL persists an advisory plan in private `media_retention_plans`: expired noncurrent content revision IDs older than 90 days, soft-deleted media IDs older than 30 days with no saved usage/release reference, and original-byte storage estimate. Preview/staging/provider overhead is explicitly excluded from that estimate. Plans state `preparedOnly:true, deleteEnabled:false`; there is no deletion executor, storage-delete adapter, execution RPC, cron activation or hosted destructive path. Consequently records/bytes can remain longer than the minimum retention windows and storage can keep growing.

The pure `planRetention` helper accepts an explicit timestamp and inventory (`contents`, `revisions`, `media` with version IDs, `usages`, `releaseRefs`). It retains current heads, recent revisions, revisions whose parent is missing from inventory, every referenced media version, and recent trash. Even a usage attached to an expired revision holds media until a later inventory proves the usage has actually gone. This helper does not read the database; supply a complete, consistent inventory. Any future purge executor must take fresh locks and revalidate references/retention immediately before deletion, handle immutable Storage bytes and database references together, and receive separate owner review and hosted verification. An old plan is never deletion authorization.

Focused local verification:

```
node --test tests/admin/media-metadata.test.mjs tests/admin/media-metadata-ui.test.mjs
node --test --test-concurrency=1 tests/admin/media-metadata-sql.test.mjs
```

The SQL test builds a fresh embedded database from local migrations and runs `supabase/tests/media-metadata.sql` in a rolled-back fixture. It is not evidence of hosted JWT/Storage/provider behavior, production retention, off-site backup or a recovery drill. No hosted migration, network provider, account, email, publication or deletion has been performed by this component work.

## Retention execution follow-on

Prepared migration 014 and `server/media/retention-worker.mjs` add a separate default-disabled execution path. A fresh bounded advisory plan must be followed by newer independent verified off-site backup/restore evidence for the configured source. Execution preserves current revisions, rechecks media references under locks and enqueues existing durable Storage cleanup rather than acknowledging deletion. Article trash recovery also expires after 30 days while retaining PT409/session/private-draft safeguards. Neither retention nor any new migration has been enabled on the hosted project. See `RELEASES-LOCAL.md` for the dependency order and rollback-only scripts.
