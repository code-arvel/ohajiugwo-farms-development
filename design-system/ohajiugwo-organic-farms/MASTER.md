# Ohajiugwo Organic Farms — project design system

16 October 2026. Restored original homepage, recovered from the saved 15 October implementation. These decisions supersede the expanded multiple-page and merged-page structures.

## Purpose and scope

A welcoming, credible, email-only informational website for a sustainable farm in Abia State, Nigeria. Audiences include households, restaurants, grocery stores, hotels, schools, wellness clinics, cooperatives, emerging farmers and institutional partners. Visitors should understand the farm, its products and practices, and know how to enquire by email.

The owner requested restoration of the original concise homepage before five additional pages were built. The recovered original source defines its section selection, copy length, layout and balance. Retain the approved centred hero, minimal eyebrows, palette, typography, spacing and confirmed email. Remove visible preview/image labels and development notes. Do not expand or redesign this restored version. Only `index.html` is generated; navigation scrolls to its sections. No publication without explicit instruction.

## Skill basis

Read `/home/marvel/.agents/skills/ui-ux-pro-max/SKILL.md` and ran `organic agriculture warm editorial --design-system`, then the Astro static responsive-images/navigation stack search. The agriculture category and Organic Biophilic recommendation fit the brief: natural greens, warm accents, Lora headings, spacious sections and feature-led storytelling.

Adaptations: darker greens and warm cream follow the owner's palette; DM Sans replaces Raleway for clearer small text. Restrained 3–5px rounding and flat surfaces support a confident agricultural identity. No generated social proof, awards, badges or certifications. No motion library.

## Architecture

The repository was empty. Astro was initially recommended for static output and reusable components. Package registry access is unavailable, so this implementation uses Node ES-module templates with a dependency-free static build. Layout, components, content and central configuration stay separate. Output is ordinary HTML, CSS, JS and assets in `dist/`.

## Visual tokens

| Role | Value | Code token |
| --- | --- | --- |
| Forest / primary text | `#203e30` | `--forest` |
| Deep green / footer | `#173226` | `--deep` |
| Warm cream / page | `#f8f6ef` | `--cream` |
| Paper / service cards | `#eeede4` | `--paper` |
| Sage / supporting surfaces | `#dfe5d7` | `--sage` |
| Muted body text | `#596459` | `--muted` |
| Earth / restrained accent | `#9a7049` | `--earth` |
| Keyboard focus outline | `#aa672e` | focus rules |
| Divider | `#d6dacd` | `--line` |

Headings: Lora with Georgia fallback, regular weight and selected italic phrases. Body: DM Sans with Arial fallback. Hero scales from 44px to 82px; section headings from 36px to 55px. Body line heights: 1.65–1.95. Following owner feedback, use a single short geographic eyebrow in the hero. Omit decorative section and product-card eyebrows; headings provide the hierarchy.

Horizontal gutters: `clamp(22px, 5.6vw, 100px)`. Section padding: `clamp(64px, 7.5vw, 120px)`. Three-column produce/services on desktop; one column on narrow phones. Main content limited to 1600px. Main controls at least 44px tall. Hero scrim supports readable text. No decorative gradients or heavy shadows.

## Homepage composition

1. Forest location strip and cream header. Full typographic name uses two intentional lines; OHAJIUGWO stays intact.
2. Full-width field hero: “Good food. Living soil. Stronger communities.” Centre the headline, supporting text and actions at desktop and mobile sizes, with a balanced dark image scrim. Keep the short Abia State location eyebrow; no visible stock caption.
3. Four principles: soil care, seasonal produce, resource use and knowledge sharing.
4. Product previews: vegetables/leafy greens, tropical fruit and seedlings. Supporting note includes roots, meat and fish; availability by enquiry.
5. Forest practices section: compost/cover crops/rotation; biological pest management/companion planting; water conservation; solar tools.
6. Company story with planting image, five-hectare note, mission and values.
7. Training, consulting and supply enquiry previews, distinct from practices used on the farm.
8. Sage enquiry section and separate headquarters/farmland addresses.
9. Original forest footer, with no preview notice or development badges.

## Content and configuration

Company facts come from the supplied profile, edited into British English. Headquarters and farmland remain distinct. The owner confirmed both spellings on 15 October 2026. Expanded future-plan content is not included in the restored concise homepage. It remains preserved in inactive source and backups; if ever reused, plans must never be presented as completed achievements.

No health guarantees, “chemical-free”, “residue-free”, absolute safety claims, invented registration information or unverified certification. Farm practices are described as supplied. The real email is confirmed as `ohajiugwochimeziebibi@gmail.com`. A logo, authentic farm photos and certification evidence have not been supplied; the owner authorised placeholders and omission of certification claims.

`src/config/company.mjs` holds shared company details and image references. Empty email means no working email/copy action. Adding the real address enables them consistently. The certification array reserves space for evidence-backed details but never renders a badge automatically.

## Assets and motion

Prioritise owner photos. Existing Unsplash photos retain their stock status in image alternatives/configuration and sources in `docs/ASSETS.md`. Visible image labels/captions were removed at the owner's explicit request. Images use responsive widths and automatic format selection, eager hero/lazy remaining images, and dimensions that reserve space. Missing-image feedback uses neutral wording.

Motion: only 180–450ms colour and contained-image transitions. Reduced-motion preference removes smooth scrolling, transitions and image scaling. No autoplay or scroll hijacking.

## Accessibility and verification

Semantic landmarks, one H1, sequential headings, native links/buttons, descriptive alternatives, skip link, visible focus, mobile menu expanded state and Escape focus return. Mobile nav collapses below 1101px. No-JavaScript fallback exposes navigation. No forms or data collection.

Review 375, 768, 1024 and 1440px, landscape, zoom, keyboard access, wrapping, image loading, email/copy behaviour, reduced motion and production output. `docs/QA.md` records actual results and environment limits; source inspection is not browser verification.

## Restored scope boundaries

The original saved homepage is the scope reference. Its live order is Home, Products, Practices, short About story, Services and Contact. Navigation may link to those sections without changing their order. Use the original compact navigation labels, including Our Practices and Let’s talk.

Do not reintroduce expanded section introductions, mission/vision cards, detailed product/service/method blocks, future plans or repeated enquiry banners. The expanded modules/styles are preserved but inactive. No expanded stylesheet is loaded.

The hero is the single H1; original section headings remain H2 and cards/practice/location headings H3. Keep the original footer layout. No visible preview badge, stock caption or development note may appear.

The homepage retains one title, description, canonical URL and social metadata. Native section anchors are #home, #products, #practices, #about, #services and #contact, with #practice-details and #locations as nested links. Smooth scrolling respects reduced motion and the mobile menu closes after selection.

Recovery evidence and original source copies are linked from HANDOFF.md and docs/HOMEPAGE-RESTORATION.md. The project was backed up before restoration.
