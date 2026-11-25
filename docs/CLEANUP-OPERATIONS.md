# Development cleanup operations

**25 November latest hosted checkpoint:** 001–016 owner-applied and full rollback SQL verified; never rerun without cause. Agent separately verified three NEW015/016 command service-access/anonymous-denial HTTP boundaries using NULL-only refusal inputs, with no records/emails/settings changed. Reconciliation/email runtime gates remain off; successful deployed-worker cleanup, recovery template readiness and approved real additional-admin invite/reset/revoke/security/concurrency/accessibility are pending. Current HANDOFF/checklist supersede older setup-pending statements below.

**25 November checkpoint (supersedes older pending notes):** 001–011 are owner-applied/SQL verified; do not rerun. Four-session manual cleanup is complete with independent saved-state counts 4/4/4/0/0/0. Owner fresh Preview login and refresh work; pre-recovery session survival is unconfirmed. Permanent expired-token worker handling remains unfinished. 012–014 still await owner setup/verification. Follow the current table in [Stage 2 checklist](STAGE-2-CHECKLIST.md).

## Verified evidence — 14 November

Natural cron events at 08:10 and 08:15 UTC were observed in the live tail. The first media batch claimed/completed one job with no retry/review/unconfirmed result; the second had no work. Owner SQL independently confirmed the new automatic-test job done, one attempt, two paths and zero Storage metadata rows; no manual batch processed it. Automatic photo cleanup passes for this scenario. The first authentication batch placed three jobs in `review`, so Auth cleanup/reconciliation is **not** complete. Review records must be inspected safely rather than reset or silently acknowledged. The tail was stopped; cron remains enabled.

Owner authorized setup on 14 November 2026. Worker: `ohajiugwo-cleanup-development`, existing owner-controlled Cloudflare Free account. This is separate from the Pages website and internal Images processor.

## Deployed configuration

- Source: `hosting/cleanup-worker.mjs`; configuration: `wrangler-cleanup.toml`.
- Cron: `*/5 * * * *` (UTC), every five minutes.
- `workers_dev=false`, `preview_urls=false`, no HTTP/fetch route or custom domain.
- Both exact cleanup gates are enabled as encrypted Worker secrets. Seven required config/key values were provisioned privately from the existing validated admin configuration; `.env.admin` and its session key remain unchanged. Values must never be printed, committed or copied into chat.
- Authentication cleanup processes expired/revoked/stale staged sessions and outstanding provider effects through the existing durable SQL queue, locks, leases and acknowledgements. It does not automatically refresh/replay uncertain Auth operations or grant membership.
- Media cleanup reconciles expired reserved/processing uploads and deletes only validated paths supplied by the durable cleanup ledger. Saved/referenced media is not selected by normal removal. Batch defaults are five auth jobs and five media jobs per invocation; error/retry/review states remain durable.
- The media phase currently follows successful completion of the auth phase. A top-level auth queue failure prevents that invocation's media phase and emits a generic failure; investigate rather than asserting photo cleanup ran.
- Output is only summary counts (`claimed`, `completed`, `retried`, `review`, `unconfirmed`) or a generic failure. A successful empty batch proves execution, not deletion of a particular photo.

Cloudflare's schedule API and subdomain settings were read back after provisioning: cron present, public subdomain/preview disabled, and nine `secret_text` binding names present. Configuration existence is separate from observed scheduled execution.

## Verify the actual schedule

1. Start read-only observation with `npx wrangler tail ohajiugwo-cleanup-development --config wrangler-cleanup.toml --format json`. Record an actual cron event, its outcome and the count-only auth/media summaries. Do not count manual `scheduled` invocation or local tests as natural cron evidence.
2. Owner uploads a distinguishable non-sensitive test image in the signed-in photo library and removes it without ever selecting it in saved content. Do not remove the existing referenced image.
3. Do **not** run the maintainer cleanup command. Wait for a natural cron event and correlate it with the ledger.
4. Owner runs this read-only query in the existing Supabase SQL Editor (owner/postgres):

```sql
SELECT c.created_at, c.state, c.attempts,
       cardinality(c.paths) AS files_to_delete,
       (SELECT count(*) FROM storage.objects AS o
        WHERE o.bucket_id='farm-photographs' AND o.name=ANY(c.paths))
       AS files_still_in_storage
FROM farm_private.media_cleanup AS c
ORDER BY c.created_at DESC
LIMIT 5;
```

5. For the new job expect `done`, attempts at least 1, two paths and zero matching Storage metadata rows. Independently check authenticated object absence when paths are available through authorized private tooling; do not reveal paths/tokens or grant direct browser Storage access. Record owner SQL evidence separately from provider and Worker logs.
6. Stop the local log tail after observation. The deployed cron stays enabled unless deliberately disabled.

New trigger changes can take up to 15 minutes to propagate before the next matching cron time. Avoid creating repeated schedules or deployments just because the first observation window is empty. [Cloudflare cron propagation](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

## Review and recovery

The owner diagnostic found three revoked source sessions whose provider-session rows still exist, with retained matching credentials and zero completed tokens. New migration 011 and the redacted maintainer read-only inspector are prepared locally; hosted SQL/provider execution remains pending. See [owner-run inspection steps](CLEANUP-REVIEW-011-OWNER-STEPS.md). Do not infer an expired-token cause or successful revocation from the queue state alone.

- `review`/`unconfirmed` is not a successful cleanup. Inspect safe row state/count metadata first; do not select encrypted credentials into a shared output, reset attempt counters or blindly replay token verification/refresh.
- A 401/403 during provider sign-out requires reconciliation; do not falsely acknowledge it as complete merely because a token might already be invalid.
- Preserve the exact session key. Rotating it without a reviewed re-encryption/recovery plan makes pending encrypted cleanup unreadable.
- To suspend work immediately, set the cleanup gate to a non-enabled value privately through Wrangler's secret prompt, then remove `[triggers]` from the cleanup config and deploy only this Worker. Do not disable the Pages site, delete the project or change Supabase access controls. Verify the schedule list and remember trigger removal propagation can be delayed.
- Scheduled cleanup does not send invitations/reset emails, create users, publish content, run migrations or buy services. Those actions keep their separate authorization requirements.

Remaining gates: real transient/lost-ack recovery, abandoned-upload cases, independent-worker races and provider/session revocation tests. Passing the successful-photo cron case does not close them.
