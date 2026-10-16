# Ohajiugwo Organic Farms Ltd — handoff

## Current state — 16 October 2026

**The owner approved this exact website on 16 October 2026.** Preserve the current layout and content. Do not redesign, expand, reintroduce inactive sections, or publish without a new instruction.

Approved recovery archive: `backups/approved-website-20261016T025450Z.tar.gz`. This archive includes the approved source, generated site, tests, the handoff at approval, original recovery source copies and previous project backup. Its SHA-256 sidecar and recovery instructions are alongside it. It remains unchanged.

**Git access correction:** Git is installed (`/usr/bin/git`, version 2.53.0), and `user.name`/`user.email` are configured. The earlier “Git unavailable” description referred to repository access and was imprecise. This execution environment exposes the project's `.git` as an empty read-only directory (mode 555), with no visible `HEAD`; `git rev-parse` and `git status` therefore report no repository. The permission profile separately restricts `.git` to read access. This does not establish whether a repository already exists in the laptop's unrestricted filesystem, and it prevents safe project initialisation, staging, committing or tagging here.

The owner has authorised a local commit named `Save approved farm website` and tag `approved-website-v1` if that tag is absent. These operations remain **pending in the owner's terminal**. No project repository, commit or tag has been created by this environment. Instructions are in [LOCAL-GIT-CHECKPOINT.md](docs/LOCAL-GIT-CHECKPOINT.md). Do not push or publish.

`.gitignore` now excludes generated output, dependencies, backup archives, secret/local configuration and temporary files. Source, assets, design-system files and documentation remain eligible for tracking. The two recovered `.mjs` files under `backups/` must remain tracked because restoration checks read the original homepage fixture. Backup archives/checksums stay on disk; they are not deleted or staged.

Files intended for the commit were reviewed in an isolated temporary Git index, without writing the protected project `.git`. See [GIT-STAGING-REVIEW.md](docs/GIT-STAGING-REVIEW.md) for the 34-file inventory and exclusions. This is a staging preview, not a project commit or confirmation of the laptop repository's status. Website source/assets and the approved archive remain unchanged; only ignore rules and Git handoff documentation were updated.

The original concise homepage has been restored from a saved implementation created **15 October 2026 at 14:18 Lagos time**, before the five additional pages were built. It was recovered from saved session records, not recreated from memory. Git history could not be used because the exposed `.git` directory is empty.

The owner requested that the original section selection, copy length, layout and visual balance be restored. Expanded copy introduced by the later pages/merge is no longer rendered. No new sections or redesign were added.

Explicitly retained changes:

- Centred hero headline, description and buttons.
- Minimal eyebrows: only the short Abia State hero label.
- Confirmed email `ohajiugwochimeziebibi@gmail.com` and email-only enquiries.
- One scrolling homepage with section links.
- No visible preview badges, temporary-image labels, captions or development notes.

Nothing has been published. `publicationReady` remains false and the final public origin is unset. Website approval is not permission to publish.

## Backup and recovery evidence

Before website edits, the current project was archived as:

`backups/project-before-homepage-restoration-20261016T020318Z.tar.gz`

The archive includes the project before restoration, excluding only the backups directory. Its homepage checksum was compared with the pre-edit source and matched. Archive SHA-256:

`3786dbfac4bbe915e13d47c8be172d1e3a4dd134874c7811375861f3325adab5`

Exact recovered source is retained in:

- `backups/original-homepage-20261015T131833Z.mjs`
- `backups/original-shared-components-20261015T131833Z.mjs`

The source-session path, tool-call identifier and recovered-source checksum are recorded in [HOMEPAGE-RESTORATION.md](docs/HOMEPAGE-RESTORATION.md). The owner was told which version was found and what would be restored/removed before live files were edited.

Expanded section modules and their styles remain saved in `src/sections/` and `src/styles/pages.css` as inactive work. They are not imported, linked or included in the live homepage. Do not reintroduce them without the owner's instruction. No unrelated source work was discarded.

## Original homepage structure

The saved implementation's order and heading sequence are restored:

1. `#home`: photographic hero and four-item principles strip.
2. `#products`: three product previews and a short note covering roots, meat and fish.
3. `#practices`: four compact sustainable-practice summaries.
4. `#about`: short company story, five-hectare note and three values.
5. `#services`: three previews for training, consulting and supply partnerships.
6. `#contact`: email/copy control and separate headquarters/farmland locations.

The original footer layout is restored. Expanded introductions, full mission/vision cards, detailed product/service/method blocks, future-plan section and repeated enquiry banners are removed from the live page. Future plans remain only in the inactive expansion work and backup.

## Facts and constraints

The company profile is the source of facts. Use British English. Headquarters and farmland spellings were both confirmed by the owner:

- Headquarters: Umuolo Umuarokoro, Okwu Autonomous Community, Umuahia South LGA, Abia State, Nigeria.
- Farmland: Okpuru-Icheku Mgbokoro, Okwu Autonomous Community; five hectares.

All customer enquiries are by email. No form, phone/WhatsApp contact, shopping cart, payments or accounts. Do not ask for the email again unless the owner changes it.

Do not invent testimonials, awards, prices, biographies, production figures, registration numbers or certifications, or add unsupported health/food-safety guarantees. Certification claims remain omitted. If future plans are ever reused, keep them explicitly separate from current operations.

Photography is still stock, not actual company photography. At the owner's request, no visible stock captions/badges remain. Image alternatives, central configuration and [ASSETS.md](docs/ASSETS.md) retain that provenance. No official logo has been supplied; the original typographic company name remains.

## Design and files

Keep the approved forest/cream/sage palette, Lora headings, DM Sans body text, generous spacing and responsive layout. The base stylesheet retains the approved centred hero and reduced-motion behaviour. No section-expansion stylesheet is loaded.

| File | Purpose |
| --- | --- |
| `src/pages/home.mjs` | Restored original homepage template with only the approved adjustments |
| `src/pages/index.mjs` | Single homepage build entry |
| `src/config/company.mjs` | Confirmed email, company/location details, anchor navigation and images |
| `src/components/shared.mjs` | Header, recovered original footer, email buttons, icons and images |
| `src/layouts/page.mjs` | Single document, metadata and gated structured data; no preview badge |
| `src/styles/main.css` | Original approved design, centred hero, responsive menu and motion rules |
| `src/client.js` | Menu closing/Escape, hash-based active navigation, email copying and image errors |
| `scripts/build.mjs` | Generates only the homepage and removes retired page/stylesheet outputs |
| `tests/site.test.mjs` | Seventeen checks, including comparison with the recovered heading sequence |
| `src/sections/`, `src/styles/pages.css` | Preserved but inactive expanded work |
| `dist/` | Generated review build |

## Run and check

Requires Node.js 22 or newer; no dependency installation is needed.

```sh
npm run dev
```

Open `http://localhost:4321` and reload after source edits. Custom port: `npm run dev -- --port 4322`.

```sh
npm run build
npm run check
npm run preview
```

Build before checking after a fresh checkout because tests inspect generated output. `preview` serves the production build without rebuilding. If server creation is blocked, open `dist/index.html` manually in your own browser. Remote stock photos and Google Fonts require internet access; fallback fonts are available.

## Verification and review

The production build, existing `npm run check` command and direct execution of all 17 automated checks pass on 16 October 2026. Tests cover the recovered original heading sequence/section order, concise length and three product cards; absence of expanded blocks, visible image labels and preview notes; a single HTML output; all anchors/ARIA references; confirmed email links; simulated mobile-menu/hash/Escape and copy-email behaviour; metadata and indexing controls. A manifest of the 21 source/script/asset files was recorded before checks and compared afterwards to confirm that the approved implementation was not changed.

Browser layout, actual scrolling, image loading, clipboard and opening the email application remain subject to manual review. Previous attempts to start a local server in this environment returned `EPERM`; automated browser local-file access was also blocked by policy. Source/interaction simulations are not visual browser verification.

The restored homepage is now approved. Remaining launch requirements are:

1. Complete actual mobile/desktop browser checks, including navigation, keyboard focus, image/font loading, reduced motion, email/copy behaviour and text wrapping. Existing source/interaction tests do not replace these checks.
2. Supply the final HTTPS domain/origin and verify canonical/social-sharing metadata against it.
3. Confirm that the current stock photography should be retained for launch, or supply authentic photographs. An official logo is optional; do not replace the approved typographic treatment without instruction. No visible temporary-image labels should be reintroduced.
4. Certification claims remain omitted; evidence is required only if the owner later requests such claims.
5. Obtain an explicit instruction to publish before changing launch/indexing configuration or deploying anything.

No new content, extra sections, redesign or copy expansion is authorised. The confirmed email and both locations are already settled.

## Recover the approved version

Use `backups/approved-website-20261016T025450Z.tar.gz` and its `.sha256` sidecar. Verify the archive checksum, then extract into a separate empty directory before comparing or replacing any working project. The archive includes the small recovered-original source files required by the tests. Run `npm run build` and `npm run check` after extraction. See the adjacent `approved-website-20261016T025450Z-README.md` and source checksum manifest for details.

No project Git commit, tag, push or public deployment was made in this restricted environment. The approved website and dated recovery archive remain saved locally. To confirm the requested Git checkpoint, run the documented commands from an unrestricted laptop terminal, review staged files, then record the resulting commit/tag and clean working-directory status.
