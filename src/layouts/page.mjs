import { company } from '../config/company.mjs';
import { header, footer, escapeHtml } from '../components/shared.mjs';

export function page(content) {
  const title = `${company.displayName} | Rooted in Abia, growing with purpose`;
  const description = company.description;
  const published = company.publicationReady && company.siteUrl && company.email;
  const origin = company.siteUrl ? new URL(company.siteUrl).origin : '';
  const canonical = origin ? `${origin}/` : '';
  return `<!doctype html><html lang="en-GB"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#203e30"><meta name="robots" content="${published ? 'index, follow' : 'noindex, nofollow'}">
    <meta property="og:type" content="website"><meta property="og:locale" content="en_GB">
    <meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
    <meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}">
    <meta property="og:site_name" content="${company.name}"><meta name="twitter:card" content="summary_large_image">
    ${origin ? `<link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(origin)}/images/social-card.png"><meta name="twitter:image" content="${escapeHtml(origin)}/images/social-card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Ohajiugwo Organic Farms Ltd — Good food. Living soil. Stronger communities.">` : ''}
    <link rel="icon" href="./favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="./styles.css">
    <link rel="preconnect" href="https://images.unsplash.com">
    ${published ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: company.name, url: origin, email: company.email, ...(company.locationsConfirmed ? { address: { '@type': 'PostalAddress', ...company.structuredAddress } } : {}) }).replace(/</g, '\\u003c')}</script>` : ''}
    <script src="./client.js" defer></script>
    <noscript><style>@media(max-width:1100px){.site-header{flex-wrap:wrap}.menu-toggle{display:none}#main-nav{display:flex;position:static;box-shadow:none;flex-wrap:wrap;padding:10px 0 0;flex-basis:100%;gap:8px 20px}}</style></noscript>
  </head><body id="top" class="home-page">${header()}<main id="main" tabindex="-1">${content}</main>${footer()}</body></html>`;
}
