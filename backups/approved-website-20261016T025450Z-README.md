# Approved website recovery point — 16 October 2026

The owner approved the current restored concise homepage and requested an exact recovery point. Git status reports that this workspace is not a usable Git repository, so a dated backup is used instead.

Archive: `approved-website-20261016T025450Z.tar.gz`.

Checksum sidecar: `approved-website-20261016T025450Z.tar.gz.sha256`.

Source manifest: `approved-website-20261016T025450Z-source-sha256.json`.

The archive contains the approved project, including source, generated site, tests, updated HANDOFF.md, recovered original source files and the earlier backup. It excludes only its own archive/checksum paths to avoid including itself. The archive is an immutable recovery point; later changes must use a new backup or commit.

The production build and existing checks passed. The 21 source/script/asset file checksums recorded before checks were verified afterwards; the approved layout and content were unchanged. Browser visual testing remains outstanding because the environment previously blocked a preview server and local-file browser access. Nothing has been published.

## Recover safely

1. From the backups directory, verify the archive with `sha256sum -c approved-website-20261016T025450Z.tar.gz.sha256`.
2. Extract the archive into a separate empty directory. Do not extract over unrelated or newer work.
3. Inspect HANDOFF.md and compare files before replacing any working project.
4. With Node.js 22 or newer, run `npm run build`, `npm run check` and `npm run dev`. No dependency installation is needed.

Keep the approved centred hero, minimal eyebrow labels, original concise sections, email-only contact and absence of visible preview/development labels. Do not redesign, expand or publish without the owner's instruction.
