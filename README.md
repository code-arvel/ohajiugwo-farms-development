# Ohajiugwo Organic Farms Ltd

The original concise homepage has been restored from saved source, before the five additional pages were built. It remains one scrolling page: hero, products, farming practices, short company story, services and Contact. The approved centred hero, minimal labels, palette, typography, spacing and real email are retained. No preview badges or visible image/development labels appear.

## Run

Node.js 22 or newer is required. No packages need to be installed.

```sh
npm run dev
```

Open `http://localhost:4321`. Reload after source edits. Custom port: `npm run dev -- --port 4322`.

```sh
npm run build
npm run check
npm run preview
```

Build before checking after a fresh checkout. The build generates `dist/index.html` and assets. Preview serves that output. If local servers are blocked, manually open `dist/index.html` in your own browser. Photos/fonts require internet access; Georgia and Arial are fallbacks.

## Edit

- `src/pages/home.mjs`: restored original homepage. Keep its content length and visual balance.
- `src/config/company.mjs`: confirmed company email, locations, images and launch settings.
- `src/components/shared.mjs`: header, original footer, email links and images.
- `src/layouts/page.mjs`: metadata/document shell without a preview badge.
- `src/styles/main.css`: approved design and centred hero.
- `src/client.js`: mobile menu, native-anchor navigation state and copy-email feedback.

The expanded `src/sections/` modules and `src/styles/pages.css` are preserved but inactive. Do not reintroduce them without instruction. Navigation targets `#home`, `#about`, `#products`, `#services`, `#practices` and `#contact` on the same homepage.

All customer contact uses `ohajiugwochimeziebibi@gmail.com` by email. There are no forms, phone/WhatsApp channels, accounts, carts or payments. Image stock status remains documented in alternatives/configuration and `docs/ASSETS.md`; visible labels were removed at the owner's request.

## Backup and publication

The full project before restoration is saved in `backups/project-before-homepage-restoration-20261016T020318Z.tar.gz`. Exact recovered originals and recovery provenance are also saved. See [HANDOFF.md](HANDOFF.md) and [restoration evidence](docs/HOMEPAGE-RESTORATION.md).

Nothing has been published. Keep `publicationReady: false` until explicitly authorised. The final HTTPS origin is still required for canonical/sharing URLs. When authorised, deploy the contents of `dist/` to a static HTTPS host using build command `npm run build` and output directory `dist`. No backend or database is required.
