# Ohajiugwo Organic Farms Ltd — handoff

## Stage 1 approved — checkpoint and merge pending (16 October 2026)

The owner approved the current Stage 1 website and functionality. Further editor styling is **deferred follow-up work**: reuse the current editor for Stage 2 and preserve the public design; no cosmetic redesign is part of Stage 2.

Preserved all manual source edits: footer symbol and lettering now use the footer's cream `#e3e9d9` (SVG silhouette via CSS mask), the information strip links to the owner's supplied Google Maps coordinates, and the lighter hover colours remain. The original multicolour SVG, cream sticky navbar, green/brown navbar lettering, homepage section balance and blog/article layouts are unchanged. The cream mask treatment supersedes the earlier white/filter implementation described in the historical entries below.

Fresh verification: `npm run build`, `npm run check`, all **51 individual tests across eight files**, and `git diff --check` pass. Four initial test-file failures were traced to formatting-sensitive assertions and superseded approved presentation. Tests now accept CSS whitespace formatting, explicitly protect the Maps URL/target/rel, lighter navigation hover and footer-scoped cream mask, and compare compiled base CSS against a checksum-protected original fixture with only the existing section-focus fix and approved information-strip hover exempted. Other homepage preservation, validation, draft isolation, editor round-trip/conflict/unsaved-change and production-output checks remain. No website source or manual changes were reverted. A source credential-pattern scan found no matches; this is not a guarantee that all possible secrets can be detected. This pass added no new browser/physical-device audit; prior browser results and their limitations remain below.

Reviewed intended additions: Stage 1 source/editor, required public assets, original fonts and OFL notices, lockfile, tests/recovery fixtures, design system and documentation/review evidence. `.gitignore` excludes dependencies, dist, generated editor bundle, secrets, temporary files and backup archives; existing archives remain on disk. The proposed staging paths contain no ignored dependencies, output or secret files. Actual staged-file review could not run: even `git add --dry-run` fails with `.git/index.lock: Read-only file system`. Git itself works for read operations.

Current repository: `stage-1-blog-foundation` and `main` both still point to `d89943d754e667f8fa5f50251c36bbfb17e84073`; `approved-website-v1` is unchanged at that commit. `approved-stage-1-v1` is absent. The working directory contains the approved, **uncommitted** Stage 1 files plus these test/documentation updates; the index is unchanged. No commit, new tag, merge, push or deployment is claimed.

Complete guarded host-terminal commands are in [STAGE-1-CHECKPOINT.md](docs/STAGE-1-CHECKPOINT.md). They commit with `Complete approved Stage 1 website and blog`, create the Stage 1 tag only if absent, and fast-forward `main` where possible, preserving both branches and all existing tags. If fast-forward is unavailable, they stop without attempting conflict resolution. Return the resulting commit/tag/status output for verification. **Do not begin Stage 2, create its branch or write its implementation plan until the checkpoint and merge are confirmed.** Then create a separate Stage 2 branch, read `docs/admin-blog-proposal.md`, check local Supabase/container/email-inbox prerequisites and present a concrete plan before Stage 2 code. Stage 3 retains live publishing; Stage 4 retains analytics/monitoring. Customer enquiries remain at the confirmed Gmail address. No external setup, purchases, production email or deployment is authorised.

## Latest revision — footer-only white logo

The owner authorised an all-white footer logo. The shared component now accepts `variant: 'white'`, selected only by the public footer (including blog/article footers). Scoped CSS makes both lettering lines white and applies `brightness(0) invert(1)` to the rendered symbol, preserving its transparency. The original multicolour SVG file is unchanged; the navbar and local editor retain the original green/brown variant. Dark-green footer, cream sticky navbar, typography, proportions, spacing and all other layouts/content remain unchanged. This supersedes the low-contrast footer limitation recorded below.

Actual browser verification on the restarted local server at 1440×900 and 375×812 confirmed the white symbol/lettering, transparent logo layers, unchanged dark footer and original navbar colours, readable LTD text and no horizontal overflow. Screenshots: `docs/review/footer-white-desktop.jpg` and `docs/review/footer-white-phone.jpg`. Keyboard focus remains visible. These are browser viewport checks, not physical-device or screen-reader tests.

Verification: production build, all 50 individual checks across eight test files, and `git diff --check` pass. Regression coverage checks the footer-only variant and its absence from navbar/local editor. Original SVG checksum and `approved-website-v1` remain unchanged. Work remains uncommitted for visual review at `http://localhost:4321/`; no merge, Stage 2 or deployment.

## Previous correction — original surfaces and fully transparent logo

At the owner's explicit request, the footer's original dark-green surface `#173226` and original light surrounding text have been restored by removing the cream-footer overrides. The navbar remains the original warm cream `#f8f6ef`, sticky, with dark-green links and green/light contact button. No surrounding section colours were changed to accommodate the logo. The earlier cream-footer adaptation is superseded.

The shared logo link, symbol wrapper and SVG image explicitly have transparent backgrounds, zero borders and no box shadows; wrapper/image also have no badge rounding. The original SVG bytes, colour/path data and aspect ratio are unchanged. Arrangement, Manrope 600, Source Serif 4 and exact “Organic Farms LTD” wording remain. Original green/brown lettering is unchanged, so its contrast on the restored dark footer is low; this is visible in `docs/review/restored-surfaces-footer-desktop.jpg` and was reported to the owner for review, rather than altering logo or section colours again.

Only scoped logo/navbar presentation and related documentation changed. Layout, menu code, section/article offsets, editor and content remain unchanged. All 49 checks, build and `git diff --check` pass; SVG and original recovery tag are unchanged.

Browser verification confirmed computed cream-navbar/dark-footer colours and transparent/no-border backgrounds on all logo layers at desktop width. Desktop screenshots: `docs/review/restored-surfaces-navbar-desktop.jpg` and `restored-surfaces-footer-desktop.jpg`. The phone listing rendered at 375px with the approved logo/menu layout. Browser automation then repeatedly timed out; the additional phone-menu interaction/scroll check could not be completed in this pass. Existing automated menu tests still pass, and the unchanged interactions were checked in the preceding revision. Physical touch/screen-reader limitations remain. No claim of a completed new mobile interaction audit is made.

Pending visual review at `http://localhost:4321/`. Everything remains uncommitted; no merge, Stage 2 or deployment.

## Previous revision — one shared logo with LTD

All live public header/footer and local-editor wordmarks now render through **`src/components/logo.mjs`**, styled once in **`src/styles/logo.css`**. Exact wording: “Ohajiugwo” (Manrope 600), then “Organic Farms LTD” (Source Serif 4). The original SVG is unchanged and transparent, with no symbol badge/background. Green/brown colours remain fixed; phone and compact supporting text is 13.5px on one line so LTD stays readable. Original font assets and licence notices remain unchanged.

The public header/footer import the component; the dev server injects the same component into the editor's single placeholder. Removed the old public text-only wordmark function, duplicated editor logo HTML and obsolete editor wordmark selectors. Shared escaping lives in `src/utils/html.mjs`, re-exported from shared.mjs for existing callers. Configurable company-name escaping remains tested. Reusable usage for future admin shells is documented in [SHARED-LOGO.md](docs/SHARED-LOGO.md); no admin screens or Stage 2 functionality were implemented.

The footer surface is now cream, with corresponding green/muted text, so the original logo colours remain readable without recolouring or backing the symbol. Footer copy, links and layout structure remain; no new section was added. All other homepage/blog/article/editor layout and content are preserved. Logo fonts were moved out of navbar.css into the common logo stylesheet; the editor loads only that logo stylesheet, not public-navbar rules. Sticky navbar offsets and the large-section-outline fix remain unchanged.

Verification: `npm run build`, all **49 individual checks across eight files**, and `git diff --check` pass. Tests cover common header/footer/editor rendering, exact LTD text, escaping, original SVG checksum and no duplicate live markup. Preservation exemptions are limited to the already authorised navbar plus the first footer logo anchor and the common logo stylesheet; other homepage HTML and base-style checks remain. Local editor/review routes and draft content remain excluded from production output.

Actual browser checks used the owner's restarted server. Both logos on the homepage, listing and two sample articles were checked at 320, 375 and 1440px: matching wording, loaded original symbol, single-line supporting text and no horizontal overflow. Desktop/320px editor sidebar logo checked; the compact line fits and remains 13.5px. Mobile menu/Escape and footer keyboard link focus were checked. Screenshots: `docs/review/shared-logo-footer-desktop.jpg`, `shared-logo-footer-phone.jpg`, `shared-logo-navbar-phone.jpg`, `shared-logo-editor-desktop.jpg`, `shared-logo-editor-phone.jpg`. Physical-device/screen-reader limitations remain as previously recorded. The horizontal reference image still was not present in the visible conversation; layout follows the supplied written arrangement and colours.

Work remains **uncommitted** on `stage-1-blog-foundation`, awaiting visual review. `approved-website-v1` remains `d89943d754e667f8fa5f50251c36bbfb17e84073`. No merge, Stage 2, external service or deployment.

## Previous revision — cream sticky navbar restored

Per the owner's latest instruction, the public navbar now uses the original warm cream `#f8f6ef`, dark-green links and a green contact button with cream text. The symbol's wrapper has transparent background, no border/radius and no padding; the SVG itself is unchanged, with its original colours, proportions and transparency. The approved symbol-left/two-line lettering arrangement and locally hosted Manrope 600/Source Serif 4 remain. Main wordmark is forest green `#203e30`; supporting text is brown `#705036`, taken from the supplied symbol palette. Keyboard focus uses the original visible amber `#aa672e` ring on cream.

Only navbar presentation in `src/styles/navbar.css` and the related documentation/screenshots changed for this revision. Heights remain 104px desktop/88px mobile; sticky behaviour, menu mechanics, native anchor offsets, article contents positioning and the section-outline fix are preserved. Other homepage/blog/article/editor layouts and fonts are unchanged. This supersedes the forest-navbar colour and cream-backing decisions in the previous entry.

Actual browser checks covered homepage, listing and both sample articles at 320, 375 and 1440px: consistent cream styling, no horizontal overflow and unchanged heights. Verified transparent/no-border symbol backing and original image aspect ratio, keyboard link/menu focus, Escape return, mobile link closing, and cross-page About navigation. Section targets clear the sticky bar at about 128px desktop and 112px mobile. Long-article heading and sidebar clear the 104px bar at about 128px; body remains 732px wide. Real touchscreen/screen-reader checks remain unavailable as noted below.

All 47 existing checks, production build and `git diff --check` pass. SVG checksum and `approved-website-v1` remain unchanged. Review at `http://localhost:4321/`; screenshots `docs/review/navbar-cream-desktop.jpg` and `navbar-cream-phone.jpg`. Work stays on `stage-1-blog-foundation`, pending visual review. No commit, merge, Stage 2 or deployment.

## Previous revision — forest navbar and supplied symbol

The owner explicitly authorised replacing the previously approved public navbar/wordmark. The revised navbar is ready for visual review, **not committed**. Stay on `stage-1-blog-foundation`; do not commit before review, start Stage 2, push or deploy. `approved-website-v1` remains `d89943d754e667f8fa5f50251c36bbfb17e84073`.

### Branding and scope

- Owner-supplied `/home/marvel/Downloads/Oha.svg` copied unchanged to `public/images/ohajiugwo-symbol.svg`. Original SVG colours, paths and 234:211 proportions are preserved; SHA-256 `dc0620a14d4467f0116c09eb3532d12b8a0094c2da6f7acfeb4cadd2ca5c3219`. Cream backing and clear space are external CSS, not SVG edits.
- Navbar lettering is “Ohajiugwo” in locally served Manrope 600, with “Organic Farms” beneath in locally served Source Serif 4 and spaced lettering. Original Google Fonts TTFs, WOFF2 compression copies and both SIL OFL notices are in `public/fonts/`; [asset provenance](docs/ASSETS.md). The owner ran the optional downloader after the execution environment could not resolve font-download hosts. No packages or paid services were added.
- The horizontal reference image mentioned in the request was not attached in the visible conversation. The implementation follows the written spelling, case, font and arrangement requirements; exact reference matching awaits owner review.
- Navbar-only classes and `src/styles/navbar.css` isolate this change from page/editor typography and content. The existing footer remains as approved. Base `main.css` and article `blog.css` were compared against pre-navbar snapshots and are unchanged. Homepage hero, section content/order, other layouts and article reading width remain preserved.

### Behaviour and accessibility

The forest navbar has cream links and a cream contact button with green text. Only the main navbar sticks at top as a direct child of the document body; the information strip scrolls away. Normal desktop height is 104px and mobile height is 88px. Shared CSS variable `--public-nav-height` drives public fragment clearance and sticky article contents positioning. Sections and article heading anchors land about 24px below the sticky bar. The long-article contents rail sticks below it and remains constrained above the footer. The earlier large section-outline fix is retained.

The phone menu uses forest/cream colours, 44px or larger controls, visible light keyboard-focus rings, Escape focus return, link/outside closing and a scroll area bounded for short screens. Cream-on-forest contrast is 10.83:1; secondary logo lettering is 9.44:1. Without JavaScript on narrow screens, the pre-existing always-visible/wrapped navigation now uses a static header, so its variable height cannot obscure fragment targets. Normal interactive navigation stays sticky. Independent review found this no-JS edge case; a regression assertion failed before and passed after that fallback correction.

### Verification and review

- Production build, all **47 individual checks across seven test files**, and `git diff --check` pass. Preservation checks exempt only authorised navbar markup, its stylesheet link and the narrow no-JS header rule; other homepage HTML and the earlier base-style hash check remain. Image tests allow empty alt only for the decorative supplied symbol inside the fully named home link; stock-image and other accessibility checks remain.
- Actual browser checks covered homepage, listing and both articles at 320, 375, 768, 1024, 1101 and 1440px, with no horizontal overflow and consistent navbar heights. Logo dimensions preserve aspect ratio (58×52.3px desktop, 50×45.1px mobile). Both local WOFF2 files appeared in observed page resources, computed logo font families were correct and no font errors appeared in browser logs. Body remains DM Sans and headings remain Lora.
- Verified strip scrolling away, navbar sticking at page/footer positions, keyboard links/menu focus, Escape, mobile link closing and short-screen menu scrolling at 375×350px. About targets clear the bar at roughly 128px desktop / 112px mobile; no large section ring. Long-article anchors and contents clear the desktop bar (contents top128px vs bar bottom104px); body remains 732px wide and rail clears footer. Mobile article anchor focus/clearance also checked.
- Limits: no physical touch device, screen-reader audit or real JavaScript-disabled browser session was available. The no-JS correction is verified by source/regression checks. Browser checks used the owner-restarted server; restart after future template/server edits. The final no-JS-only template correction does not alter the normal JavaScript-enabled visual preview.

Review `http://localhost:4321/`, `/blog/`, either sample article, and development-only `/__review/contents/` with `npm run dev`. Screenshots: `docs/review/navbar-desktop.jpg`, `navbar-phone.jpg` and `navbar-article-contents.jpg`. The editor/review fixture/drafts remain excluded from production output. Source, licences, font assets, documentation and tests are saved for review; no new Git checkpoint was created.

## Latest fix — homepage fragment focus ring

The owner requested removal of the large outline around homepage sections after navigating from the blog. Browser inspection reproduced it at `/#about`: the focused `section[tabindex="-1"]` had a browser-default `auto` outline, no border, and no authored `:target` outline. The browser reported `:focus-visible` even after a cross-page mouse click, so relying on `:focus:not(:focus-visible)` would not solve that case.

Added only `.home-page section[id][tabindex="-1"]:focus{outline:none}` to the end of `src/styles/main.css`. This suppresses the browser ring around the six non-interactive homepage destination containers, including keyboard-activated fragments. Their IDs, `tabindex`, native fragment scrolling/history and focus remain intact; the next Tab still reaches the next interactive item in that section. No global outline reset, blur handler, scrolling script, interactive focus-rule change or layout/content change was introduced. Skip-to-main, controls and article heading focus styles remain intact.

The homepage preservation test now permits exactly this additive CSS patch, hashes the remainder against the original approved stylesheet and still compares the complete default homepage HTML. This supersedes earlier notes saying the entire stylesheet is byte-for-byte unchanged. Build logging now says “base CSS” rather than incorrectly claiming “unchanged base CSS”.

Browser checks: all six header section destinations were activated with the mouse from the homepage, listing and both articles at 1440px and 375px (48 checks); every target retained focus with no section outline and no horizontal overflow. Keyboard About navigation from all four origins at both widths preserved the 3px amber navigation-link focus ring and continued by Tab to “Where we’re based” with its visible ring. Email the Farm and Copy email controls also retained their visible keyboard outlines. Mobile menu opening/closing worked. Native anchors still position About approximately 130px below the viewport top. Screenshots: `docs/review/homepage-section-focus-fixed.jpg` and `docs/review/homepage-keyboard-focus-retained.jpg`.

**Touch limitation:** available browser tooling supports viewport resizing, mouse and keyboard, but has no touch-input emulation. Phone-width navigation was checked with clicks; actual touchscreen taps and physical-device behaviour remain a manual check. No claim of real touch testing is made.

Final production build, all 45 existing checks and `git diff --check` pass. The regression check failed before the CSS change and passed afterwards. Homepage layout/content and recovery tag are preserved. No new dependencies, Stage 2 work, Git checkpoint, push or deployment. The prior Git write limitation and host checkpoint instructions below remain applicable.

## Approved Stage 1 — final verification and checkpoint

The owner explicitly approved the Farm Journal, individual article layout, local editor and responsive “On this page” navigation on 16 October 2026. Preserve this design. Stage 2 remains unapproved. No push, deployment or external-service setup is authorised.

Final `npm run build`, `npm run check` (45 individual checks in six files) and `git diff --check` pass. The complete rendered homepage comparison passes with only the approved Blog navigation addition; base CSS remains unchanged. `dist/` contains the homepage, listing, two published educational sample article pages and shared assets only. Editor modules, draft sentinel and local long-article fixture/route are absent. Production request-handler tests reject editor/review/draft routes.

Checkpoint requested: commit **“Complete approved Stage 1 blog and editor”**, then tag **`approved-stage-1-v1`** if absent, preserving `approved-website-v1` at `d89943d754e667f8fa5f50251c36bbfb17e84073`. The new checkpoint **does not exist yet**: staging failed because `.git/index.lock` cannot be created on the read-only filesystem. No commit or tag write was attempted after that failure. Exact host-terminal commands are in [STAGE-1-CHECKPOINT.md](docs/STAGE-1-CHECKPOINT.md). The working directory remains modified/untracked; the actual repository index was empty before and after the failed attempt. File review uses an isolated temporary index only, not a claimed repository checkpoint. Reviewed 55 changed/new files: source, local editor source, tests/fixtures, package lockfile, planning/handoff documents and review screenshots. No dependency directories, generated bundles/output, backup archives, secret files or temporary public pages were selected. No private-key or obvious live-token patterns were found by the limited content scan; this is not a comprehensive secret audit.

## Implementation record — automatic article contents

Stage 1 only; design now approved. Longer articles automatically receive an “On this page” list when calculated reading time is at least four minutes and there are at least three meaningful H2/H3 sections. A meaningful section has a non-blank heading followed by non-empty paragraph/list text before the next heading. Empty or consecutive headings do not inflate the threshold. Short article HTML remains exactly unchanged; homepage, listing and editor are untouched.

`src/content/contents.mjs` derives deterministic heading IDs from heading text, with collision-safe suffixes for repeated headings. IDs remain unchanged when paragraphs move or are added; renaming/reordering repeated headings may change their corresponding fragment URLs. The allowlisted body serializer emits escaped IDs and keyboard focus targets only for qualifying articles. No unrestricted HTML or new dependency was added.

At 1320px and wider, a 200px contents rail uses the margin beside the unchanged, centred 780px article container. Its navigation sticks 24px from the viewport top and is constrained by the reading body, so it clears the header/footer. Tall contents can scroll internally. Narrower layouts use a native, initially closed details/summary above the body. Links/summary have at least 44px touch targets, visible focus, native fragment history and heading focus targets. Existing smooth-scroll/reduced-motion rules remain unchanged; heading scroll margin adds clearance.

Verification: all **44 individual checks across six test files**, production build and `git diff --check` pass. New tests cover both gating conditions, empty/short sections, H2/H3 hierarchy, repeated headings, slug collisions, paragraph-edit anchor stability and matching links/targets. One-off baseline comparisons confirmed byte-for-byte unchanged homepage, listing and current short article HTML. Read-only independent review found no important issues.

Actual browser checks used the local educational fixture in `tests/fixtures/long-article.mjs` (never imported by production routes). At 375, 768, 1280, 1320 and 1440px, contents switch correctly and cause no horizontal overflow; wide columns remain centred at their original width. Checked sticky position, footer clearance, long heading wrapping, repeated-heading destinations, keyboard disclosure/links, focus transfer and anchor offset. Existing short articles remain without contents. The reduced-motion rule was checked in source; OS preference emulation, physical devices and screen-reader coverage were not performed. No new animation or scrolling script was introduced.

The temporary `public/__contents-review.html` was removed and the final build contains no fixture page. Review screenshots: `docs/review/article-contents-desktop.jpg` and `docs/review/article-contents-phone.jpg`. The owner subsequently requested a persistent local review link. Use `http://localhost:4321/__review/contents/` after restarting `npm run dev`. The development server renders the fixture on demand, without creating any file under `public/` or `dist/`. Production preview returns 404, and the route is loopback/same-origin only, no-store and noindex. No public navigation link was added. At wide desktop widths the contents occupy the margin; below 1320px expand “On this page” above the body. This is disposable educational review content, not a report of company activities.

Build and all **45 checks** pass, including a new server-isolation test for the review route, production 404, same-origin restriction and no generated fixture file. `git diff --check` passes. Older temporary public-fixture instructions are superseded by this development-only route. After the owner restarted the server, the actual review route was opened successfully at 1440px (sticky desktop contents) and 375px (expanded mobile contents, no horizontal overflow). Both review tabs were left open. Screenshots: `docs/review/local-contents-preview-desktop.jpg` and `docs/review/local-contents-preview-phone.jpg`.

`approved-website-v1` remains `d89943d754e667f8fa5f50251c36bbfb17e84073`. Work remains uncommitted on `stage-1-blog-foundation`; no Stage 2, services or deployment. Earlier prototype limitations below still apply.

## Latest revision — centred article column

Owner-approved bounded article adjustment completed; awaiting visual review. Only the article template in `src/pages/blog.mjs`, article-specific rules in `src/styles/blog.css`, this handoff and review screenshots changed for this request. Homepage, listing, editor, sample article content and recovery tag are preserved.

The article uses a centred 780px outer column with 24px desktop padding (732px reading/image width); the back link, title, introduction, metadata, cover and body share its left edge. Text stays left-aligned. Header top padding is 12px. Covers use `object-fit: cover`, retain configured subject positioning, and are approximately 276px high on desktop; phones use 22px side padding, responsive 29–33px titles and a shorter proportional cover. Related content/return links follow the same outer width.

Both sample articles were checked in the actual browser at 375px and 1440px: matching left edges, no horizontal overflow, loaded photographs and subject-preserving crops. A temporary 88-character title fixture wrapped without overflow at both widths; it was removed before the final build. The restarted server confirmed the new responsive image sizes. Screenshots: `docs/review/article-column-*.jpg`. These checks used browser viewport emulation, not physical devices.

All 40 existing automated checks and the production build pass; `git diff --check` passes. The homepage golden comparison and unchanged base stylesheet pass. `approved-website-v1` remains `d89943d754e667f8fa5f50251c36bbfb17e84073`. Review at `/blog/getting-to-know-your-soil/` and `/blog/planning-for-seasonal-produce/` using `npm run dev` (restart after template changes). No Stage 2, new services or deployment. Earlier Stage 1 limits below still apply.

## Implementation record — Stage 1 redesign

The approved Source-inspired Farm Journal and local writing editor redesign is complete. Stage 1 only; the owner has now approved its design. No Stage 2, accounts, services, hosting, payments or deployment were configured. Design decisions: [redesign record](docs/stage-1-redesign.md), [saved design system](design-system/ohajiugwo-organic-farms/MASTER.md), and [staged proposal](docs/admin-blog-proposal.md).

Work is saved, uncommitted, on `stage-1-blog-foundation`. This environment can read Git but cannot write protected Git metadata. `approved-website-v1` remains **d89943d754e667f8fa5f50251c36bbfb17e84073**. The approved recovery archive remains unchanged: `backups/approved-website-20261016T025450Z.tar.gz`, SHA-256 **be82c88c5b536112008ee82624940a2738aef50bb9a8903a71a9033f03192d09**. Historical Git-access statements below describe earlier environment limitations; the branch and tag are now readable and verified.

### Completed work

- The approved scrolling homepage retains its exact default rendered output, except the already approved Blog navigation link. Its centred hero, content, section selection/order, spacing and footer are preserved. A golden comparison uses templates extracted from the recovery tag; base `src/styles/main.css` is unchanged.
- `/blog/`: compact Farm Journal introduction, one featured image/text article and a smaller second card, without duplication. Responsive layouts use the existing cream/green typography and branding.
- Both article routes have compact headers, calculated reading times, optional supplied authors, balanced covers, comfortable body width, related published articles and return links. Customer email remains in the shared blog footer; the large article sales section is removed. Public pages contain no sample disclaimers, preview badges or development notes.
- Educational sample articles are not claims of farm activity. Provenance stays in `src/content/seed.mjs` and project documentation. All local imports/saves are forced review-only. Production-mode selection rejects review-only or unclassified legacy records; the global publication gate remains closed. Draft fixtures and editor files are excluded from static output.
- `/__editor/`: post list/New post, dedicated writing screen, title/excerpt, cohesive Tiptap body, compact paragraph/H2/H3/list/safe-link/undo/redo toolbar, separate settings and secondary Tools menu. Company and products/services editing remain fixed structured fields. Desktop sidebar becomes a phone drawer. A compact notice states no authentication/cannot publish.
- Free MIT Tiptap **3.32.0** and esbuild **0.28.2**, installed by the owner, are recorded in `package-lock.json`. Only required editor extensions are included, bundled locally; no paid features, Ghost installation or CDN runtime. Generated bundle is ignored and excluded from public `dist/`.
- Structured JSON validation, legacy block migration, explicit local Save/status, import/export, reset/reload confirmation, unsaved navigation protection, Web Locks and revision conflict rejection remain. Browser saving changes neither source nor public website. Unsupported lock coordination refuses unsafe saving. Local prototype isolation is not secure administrator authentication.

Customer contact stays **ohajiugwochimeziebibi@gmail.com**, email only. No new photographs, certification claims, authors or farm activities were invented. Existing stock sources remain in configuration and `docs/ASSETS.md`.

### Run and review

Node.js 22+ is required. On a fresh checkout:

```sh
npm ci
npm run dev
```

Open `http://localhost:4321/`, `http://localhost:4321/blog/`, and `http://localhost:4321/__editor/`. Article links lead to `/blog/getting-to-know-your-soil/` and `/blog/planning-for-seasonal-produce/`. Restart the server after template/content/server edits because Node caches imports. The owner started the server for browser checks; this execution environment cannot bind its own port.

```sh
npm run check
npm run build
npm run preview -- --port 4322
```

`dev` and `check` bundle the editor first. The static build remains separate and excludes the editor. Production preview must return 404 for `/__editor/`. These commands do not deploy. Review screenshots with `redesign` in their filenames are in `docs/review/`; older screenshots document the earlier prototype.

Use disposable data only. Saving, importing and resetting operate in this browser. Export before resetting any work you wish to keep. Test data was reset to the original samples after interaction checks; an older open tab may correctly report a stale revision and need reload. JSON exports are local prototype files, not production content backups.

### Verification — revised implementation

`npm run check`, `npm run build` and `git diff --check` pass. The test runner reports five passing test files, containing **40 individual checks**: site17, content11, journal8, storage2 and server2. These cover full homepage preservation, unchanged base CSS, published-only output, review-only publication rejection, no featured duplication, related selection, reading time, optional authors, safe links/text escaping, editable metadata escaping, legacy/rich JSON round-trips (including maximum legacy list sizes), stale writes, failed-storage handling, clean builds, and editor/draft isolation. Recovery tag and archive checksum were rechecked.

Actual browser checks used the restarted local server. Listing, both article pages and the writing screen were measured at **375, 768, 1024 and 1440px**, with no horizontal overflow. Article/listing photographs loaded. Screenshots reviewed phone and desktop layouts. Mobile website menu opening/Escape, editor drawer navigation, retained company/products screens, article navigation and footer mailto destination were checked.

Editor interaction checks passed: legacy content loading, H3/paragraph conversion, existing H2/bullets, new bullet/numbered lists, safe link insertion, unsafe link rejection, pasted unsupported styling/unsafe-link removal, Save and reload persistence, New post, undo/redo, stale-tab save rejection, legacy JSON import, reset confirmation, and unsaved reload cancellation/confirmation. Navigation away from dirty content was blocked by the browser; the automation did not expose the native prompt itself. Test data was reset after review.

Export displayed success and initiated the download action. **The latest downloaded file could not be independently retrieved by browser automation**; rich JSON serialisation/import round-tripping is covered by automated tests, and an existing legacy export was imported through the real file chooser. Manually download and re-import a newly formatted post during owner review. Other limits: no real phone/onscreen-keyboard or screen-reader testing, exhaustive keyboard audit, cross-browser coverage, or visitor email-app launch; no email was sent. This prototype cannot test future authentication, shared database edits or publishing.

Read-only independent review found legacy size-cap compatibility and editable social-metadata escaping issues; both were fixed and covered by regression tests. Browser testing also caught the installed Tiptap link-title default and Save-state update event; conversion and editor state were corrected and saving was rechecked successfully.

### Remaining launch requirements

Stage 1 design is approved; await a separate explicit Stage 2 instruction. Stage 2 covers secure accounts/invitations/password resets, photographs and private previews, using a local email-testing inbox for local flows. No external account or sending-domain purchase is needed for that local work. Before production authentication emails, separately approve a transactional-email provider and any required owned/verified sending domain; keep Gmail for customers.

Stage 3 covers publishing, revisions/trash and unattended off-site database/photo backups; Stage 4 covers analytics and honest health reporting. No persistent backend, real administrators, uploads, secure previews, publishing or hosted backups exist yet. Real articles, authentic photos, final origin/domain, verified delivery/security/recovery checks and explicit launch permission remain required. Keep `publicationReady: false`. Do not deploy review fixtures or the local editor.

The historical recovery notes below are retained for provenance and superseded by the current state above.

## Historical record — approved homepage, 16 October 2026

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
