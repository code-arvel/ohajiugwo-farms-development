# Ohajiugwo Organic Farms Ltd

Stage 1 review: the approved scrolling homepage is preserved, with a Blog navigation link and local sample article pages. A separate, unauthenticated local sample editor is excluded from the static build. Stage 2 accounts/security and all deployment work remain unapproved. See [HANDOFF.md](HANDOFF.md) for checks, limits and review instructions.

## Run

Node.js 22 or newer is required. Install the locked free editor/build dependencies first with `npm ci`. The writer is bundled locally by the development/check scripts and never included in the public output. See HANDOFF.md for current verification and limitations.

```sh
npm run dev
```

Open `http://localhost:4321`, `/blog/`, or `/__editor/`. **Restart the server after source edits** because Node caches imports. Custom port: `npm run dev -- --port 4322`.

```sh
npm run build
npm run check
npm run preview
```

Build before checking after a fresh checkout. The build generates the homepage, blog listing, two published sample articles and assets. Preview serves only that static output, with no editor route. Use HTTP for directory links; if this environment cannot bind a port, run the server in your own terminal. Photos/fonts require internet access; Georgia and Arial are fallbacks.

## Edit

- `src/pages/home.mjs`: restored original homepage. Keep its content length and visual balance.
- `src/config/company.mjs`: confirmed company email, locations, images and launch settings.
- `src/components/shared.mjs`: header, original footer, email links and images.
- `src/layouts/page.mjs`: metadata/document shell without a preview badge.
- `src/styles/main.css`: approved design and centred hero.
- `src/styles/navbar.css`: authorised cream sticky public navbar and shared anchor offsets.
- `src/components/logo.mjs`, `src/styles/logo.css`: one shared logo for public header/footer, editor and future admin shells; usage in `docs/SHARED-LOGO.md`.
- `public/images/ohajiugwo-symbol.svg`, `public/fonts/`: supplied symbol and local logo fonts with retained licences; provenance in `docs/ASSETS.md`.
- `src/client.js`: mobile menu, native-anchor navigation state and copy-email feedback.
- `src/content/seed.mjs`, `schema.mjs`: approved fixed slots, disposable articles, validation and revision checks.
- `src/pages/blog.mjs`, `src/styles/blog.css`: listing/articles using the existing design tokens.
- `local-editor/`: disposable sample edits in memory/browser storage and JSON export/import; no authentication or publication. Never copy this directory or source fixtures to hosting.

The expanded `src/sections/` modules and `src/styles/pages.css` are preserved but inactive. Do not reintroduce them without instruction. Navigation targets `#home`, `#about`, `#products`, `#services`, `#practices` and `#contact` on the same homepage.

All customer contact uses `ohajiugwochimeziebibi@gmail.com` by email. There are no forms, phone/WhatsApp channels, accounts, carts or payments. Image stock status remains documented in alternatives/configuration and `docs/ASSETS.md`; visible labels were removed at the owner's request.

## Backup and publication

The full project before restoration is saved in `backups/project-before-homepage-restoration-20261016T020318Z.tar.gz`. Exact recovered originals and recovery provenance are also saved. See [HANDOFF.md](HANDOFF.md) and [restoration evidence](docs/HOMEPAGE-RESTORATION.md).

Nothing has been published or configured for hosting. Keep `publicationReady: false`; the Stage 1 build deliberately refuses publication mode while sample content is present. The final HTTPS origin and reviewed real articles are still required. Follow the separately approved later stages before configuring publishing, accounts or hosted services. `approved-website-v1` remains unchanged; Stage 1 work is on `stage-1-blog-foundation`, saved but uncommitted in this restricted environment.
