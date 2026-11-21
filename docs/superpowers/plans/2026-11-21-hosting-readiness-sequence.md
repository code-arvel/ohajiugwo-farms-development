# Hosting Readiness Sequence Implementation Plan

> For agentic workers: use executing-plans for dependent root work and dispatching-parallel-agents for isolated backup/reporting/media domains. No hosted operations.

Goal: complete remaining local application/operations construction against approved admin-blog-proposal and current full-sequence specification.
Architecture: existing ES-module frontend/Workers services plus PostgreSQL transactional commands and isolated Node build/backup runners. Dependencies/interfaces in docs/superpowers/specs/2026-11-21-hosting-readiness-sequence.md are binding.

## Tasks

- [x] Photography (local): verify source/licence/context, download/optimise local assets, update reference config and renderer image handling; review desktop/mobile and preserve website copy/layout.
- [x] Release ledger 012 (local): write failing isolated SQL tests, implement immutable base-CAS snapshots/selected revisions/withdrawals/media refs, recent-auth commands, serial service-only lease/progress/reconcile/ack; rollback verification and owner instructions.
- [ ] Static release builder/runner: failing tests for selected snapshots/no fixtures/withdrawals/media checksum/path safety/deployment ambiguity; implement deterministic fresh output and injectable provider adapter, no live publish enabled.
- [x] Media 013 (local): richer private metadata/CAS/usage and protected saved-revision previews using existing renderers. No hosted writes. Independent media agent owns only named media additions; root integrates contracts.
- [ ] Backup/recovery: independent agent delivers encrypted set/manifest/incremental retention/isolated restore/provider adapters and scripts with local tests, disabled operational templates and owner setup runbook.
- [ ] Reporting/consent: independent agent delivers authenticated reports/health/GA4/monitor adapters and opt-in browser collection module + tests; root wires global routes/build assets and production-only config.
- [ ] Integrate protected UI, private previews, operational statuses and artifact exclusions. Prepare final production release configuration/runbook without enabling it.
- [ ] Sequential full unit/SQL/public/build/browser checks, independent review and fixes, HANDOFF/tracker/evidence update. Preserve hosted checkpoint at pending011, no duplicate successful migrations.

## Review focus

Older release cannot overwrite newer; a timeout cannot become Published. Backups cannot heartbeat before verified upload/readback. Retention cannot orphan media/recovery sets. Consent cannot send pre-opt-in/after withdrawal/admin/test data. Authentication/provider outages cannot become empty/healthy reports. No live secrets, fixture data, unpublished media or private previews in public output.

Owner has requested the full implementation and delegated routine choices; proceed locally without checkpoint permission prompts. External provider/storage/account/production approvals are kept concrete and deferred.

## 21 November execution checkpoint

Local modules and integration are implemented and verified as recorded in `docs/review/2026-11-21-readiness-evidence.md`: 242 administrator / 53 operations-reporting-publishing / 53 public-editor tests; local browser/runtime/release/backup/restore checks. Independent review's five Important issues were fixed; regressions cover their boundaries. Do not mark the remaining mixed implementation/operational tasks complete: historical public URL retirement, installed recurring runners/health evidence, actual provider/Auth restore and all live gates are still open. Workflow examples/config/readiness files are inactive preparation, not installed infrastructure. Rulings and their costs are retained in the evidence record. No hosted migration or production action occurred.
