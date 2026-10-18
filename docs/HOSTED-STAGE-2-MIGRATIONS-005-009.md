# Owner-run Stage 2 SQL: migrations 005–009

This guide supersedes older setup instructions that stop at 004. Migrations 005–009 have been source-reviewed. The owner reports all five migrations 005–009 and their entire rollback-only verifications passed on hosted Supabase. Do not rerun migrations 001–009 or completed SQL checks without a specific reason. Hosted HTTP, Storage, provider, concurrency and deployment checks remain separate.

## Source review and data boundaries

The reviewed migrations are additive and run in one transaction each. None contains `DROP`, `TRUNCATE`, database reset or existing-row deletion. Migration 006 adds `purpose` to existing invitation rows with default `admin_invite`; its provider/account commands are defined, not invoked by the migration. Migration 007 adds a partial unique index for active post slugs and new authenticated-session RPCs; a fail-fast guard refuses duplicate active post slugs without editing rows. Migration 008 creates new empty private upload/cleanup tables and service-only RPCs. Migration 009 adds a revision trigger so future revisions can reference only ready, undeleted private media and used media cannot be removed. Each migration writes its own version marker.

Required dependency order:

| Migration | Requires | Whole rollback-only verification |
| --- | --- | --- |
| `202610170005_durable_cleanup.sql` | Existing completed 001–004 | `supabase/tests/durable-cleanup.sql` |
| `202610170006_account_lifecycle.sql` | 005 | `supabase/tests/account-lifecycle.sql` |
| `202610170007_content_commands.sql` | 004 and 006 | `supabase/tests/content-commands.sql` |
| `202610170008_private_media.sql` | 005, 006 and 007 | `supabase/tests/private-media.sql` |
| `202610170009_media_content_refs.sql` | 008 | `supabase/tests/media-content-refs.sql` |

Migrations create no Auth identities, memberships, invitations, content, media objects or administrator; they send no email and call no Storage API. Rollback verifications insert only SQL fixtures inside transactions and finish with `ROLLBACK;`. Sequence allocations may leave harmless gaps. Local PGlite execution of all five scripts and service tests passed; that is not hosted PostgreSQL, provider, HTTP, Storage or concurrency proof.

## Completed preflight before migration 005

In the `ohajiugwo-development` SQL Editor, owner/postgres role, first verify no marker among 005–009 exists and check active slug collisions:

```sql
SELECT version
FROM farm_private.schema_migrations
WHERE version IN (
  '202610170005_durable_cleanup',
  '202610170006_account_lifecycle',
  '202610170007_content_commands',
  '202610170008_private_media',
  '202610170009_media_content_refs'
)
ORDER BY version;
```

The owner reports this returned no rows before 005 was applied. **Do not rerun this marker query:** it will now correctly return the 005 marker.

```sql
SELECT payload->>'slug' AS slug, count(*) AS active_rows
FROM public.farm_content
WHERE kind='post' AND deleted_at IS NULL
GROUP BY payload->>'slug'
HAVING count(*) > 1;
```

The owner reports this returned no rows before 005 and reran it after 006, immediately before 007; the latest result was no rows. If any duplicate appears on a future rerun before 007, stop and report the duplicate slug/counts so the owner can decide how to preserve and resolve the existing records. Do not delete or rewrite content as part of migration preparation.

## Run one migration and its verification at a time

The owner reports **005–009** and their entire verification scripts passed. This hosted SQL sequence is complete. **Do not rerun these migrations or their completed checks without a specific reason.**

There are no further migrations after 009. Replace any stale SQL Editor text with the complete current local file before running it. Never apply a later migration after an earlier step errors.

If a rollback-only test errors and leaves its transaction open, run `ROLLBACK;` as a separate query to clear that failed transaction. A verification failure does **not** undo a separately committed migration: do not rerun it. Stop and share safe error text. Never reset/drop the database, manually insert an administrator, enable sign-up, or paste keys/passwords into chat.

## Evidence after 009

Whole SQL PASS results establish only the reviewed SQL behavior in hosted PostgreSQL. A separate, later hosted probe verified selected RPC permissions and anonymous direct-object denial, with its temporary object removed; see HANDOFF. Authenticated non-member denial, application preview, provider Auth, real Images service binding, multi-session races and end-to-end browser use remain separate. Disposable fixtures may be used, while live bootstrap, a real administrator, email, SMTP change, first deployment and purchases still need their separate approval.
