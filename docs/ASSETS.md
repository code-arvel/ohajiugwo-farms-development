# Temporary assets

All photography in the restored homepage is stock imagery. None depicts Ohajiugwo Organic Farms Ltd, its staff, products or farmland. Provenance is recorded here and stock status remains in image alternatives and configuration. The owner explicitly requested removal of all visible temporary-image labels, captions and preview notes on 16 October 2026. The copy locates the business in Abia State; the stock locations do not represent the company. The original four assets remain in use, with below-hero images lazy-loaded.

| Use | Photographer / source | Source page or exact asset |
| --- | --- | --- |
| Hero, crop field | Tim Mossholder, Unsplash; photographed in Santa Maria, United States | https://unsplash.com/photos/bed-of-green-leafed-plants-nZvjBMO5p_0 |
| Leafy produce | Annie Spratt, Unsplash | https://unsplash.com/photos/green-leaves-in-macro-lens-eLPZcat5LJ0 |
| Tropical fruit | Laårk Boshoff, Unsplash | https://unsplash.com/photos/pineapple-fruit-on-yellow-surface-z0wghn-7VuQ |
| Seedlings and story | Jonathan Kemper, Unsplash | https://unsplash.com/photos/gloved-hands-planting-seedling-in-soil-CbZh3kaPxrE |

Licence: https://unsplash.com/license. The Unsplash licence allows free use, including commercial use, with its stated restrictions. The source photo pages/search records identify all four as free Unsplash images. Attribution is recorded here for provenance.

The browser requests responsive image widths (480, 800, 1200, 1800) with automatic format selection and quality 80. Below-the-fold images load lazily; the hero loads eagerly. Fixed aspect ratios reserve layout space. External images require internet access and were not downloaded because network access is unavailable in the execution environment. Image rendering still needs browser review. Stock photos must be reviewed and approved before launch, even if retained.

Fonts: Lora (headings) and DM Sans (body), served by Google Fonts with `display=swap`. https://fonts.google.com/specimen/Lora and https://fonts.google.com/specimen/DM+Sans . Fallbacks: Georgia and Arial. For production independence, self-host the font files with their accompanying licences or retain the fallbacks.

Icons: small original SVG line drawings in `src/components/shared.mjs`. No icon package. The favicon is a typographic O, not an official company logo. The social-sharing card is an original typographic composition in `public/images/social-card.svg` with a raster PNG counterpart.

## Public navbar symbol and logo fonts — 16 October 2026

- `public/images/ohajiugwo-symbol.svg`: owner-supplied `/home/marvel/Downloads/Oha.svg`; copied byte-for-byte, SHA-256 `dc0620a14d4467f0116c09eb3532d12b8a0094c2da6f7acfeb4cadd2ca5c3219`. Original viewBox 234×211, colours and path data retained. The temporary CSS cream backing was removed at the owner’s request; the SVG now displays directly with transparent surroundings. No screenshot/tracing/recolouring.
- Manrope variable: official Google Fonts repository, https://github.com/google/fonts/tree/main/ofl/manrope . Original `Manrope[wght].ttf` saved as `public/fonts/manrope-variable.ttf`; copyright and SIL OFL 1.1 in `public/fonts/Manrope-OFL.txt`.
- Source Serif 4 variable: official Google Fonts repository, https://github.com/google/fonts/tree/main/ofl/sourceserif4 . Original `SourceSerif4[opsz,wght].ttf` saved as `public/fonts/source-serif-4-variable.ttf`; copyright and SIL OFL 1.1 in `public/fonts/Source-Serif-4-OFL.txt`.
- `*.woff2` copies were generated with the already installed FontTools, using `TTFont`, `font.flavor='woff2'` and `font.save(...)`. Compression only; glyphs, variation axes and font naming retained. The CSS prefers WOFF2, with original TTF fallback. No runtime FontTools or new npm dependency is needed. `scripts/fetch-logo-fonts.py` can retrieve the original TTF/licence files from the official repository; it is an optional maintainer tool, not part of the build.
- Fonts apply only to the shared `.farm-logo` lettering through dedicated CSS family aliases in `src/styles/logo.css`. Existing Lora/DM Sans page typography and editor styling are unchanged.
- The referenced horizontal sample image was not attached to the request visible to the agent. Layout follows the explicitly supplied symbol-left, title-case lettering, fonts, hierarchy and proportions, awaiting owner visual review.
