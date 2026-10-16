# Shared Ohajiugwo logo

All rendered application logos use `logo()` from `src/components/logo.mjs` and the same `src/styles/logo.css`. The public header/footer call it directly; the development server replaces the local editor's `<!-- SHARED_LOGO -->` marker using that same function. The editor has no separate logo markup or browser-side logo implementation.

```js
import { logo } from '../components/logo.mjs';
logo({ href: '/#home', className: 'footer-brand', variant: 'white' });
logo({ href: '/', compact: true, className: 'editor-brand' });
```

Future admin layouts must use this component (compact where space is limited), include `/logo.css`, and preserve the owner-approved surrounding surface. No future admin screens or authentication were implemented in this change. Keep application wordmarks out of page builders/content fields.

The exact brand lettering is **Ohajiugwo** above **Organic Farms LTD**, in local Manrope 600 and Source Serif 4 respectively. Main text stays forest green; supporting text stays brown. The original `public/images/ohajiugwo-symbol.svg` is unchanged, has no backing or badge, and is displayed at its 234:211 ratio. Typography and spacing are controlled centrally in `logo.css`; use its compact variant rather than copying rules. The compact supporting line is 13.5px and does not wrap, keeping LTD readable on phones.

The footer keeps its original dark-green surface and selects `variant: 'white'`. The component adds `farm-logo--white`; footer-scoped CSS uses the original SVG as a transparent silhouette mask in `#e3e9d9`, matching both lettering lines and the footer text. This owner-approved manual cream treatment supersedes the earlier white CSS filter; the underlying image is hidden only inside the footer variant. The original multicolour SVG file stays unchanged. Only the footer uses this variant; the navbar/editor retain green-and-brown lettering and the original symbol colours. No background, badge, border or surrounding section-colour changes are needed. Other footer content and links retain their existing layout.

Fonts and notices remain under `public/fonts/`; sources are documented in `docs/ASSETS.md`. Default body and heading fonts remain unchanged. Original recovery fixtures under `tests/fixtures/approved-*` deliberately retain the historical wordmark for preservation comparisons, not live use.
