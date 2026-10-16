import { company, navigation } from '../config/company.mjs';

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function icon(name, className = '') {
  const paths = {
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    sprout: '<path d="M12 21v-9M12 15C3 16 2 9 3 5c7-1 10 2 9 10ZM12 12C11 5 15 2 21 3c1 6-3 10-9 9Z"/>',
    drop: '<path d="M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/><path d="M9 16a3 3 0 0 0 3 3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    leaf: '<path d="M20 3C8 1 2 8 5 15s16 5 15-12Z"/><path d="M3 21 15 9M9 15v-5m0 5h5"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    book: '<path d="M12 6C9 3 4 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-2-1-7-1-10 2Zm0 0v15"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
  };
  return `<svg class="icon ${className}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
}

export function emailButton(className = 'button', label = 'Email the Farm') {
  return company.email
    ? `<a class="${className}" href="mailto:${escapeHtml(company.email)}">${icon('mail')}${label}${icon('arrow')}</a>`
    : `<a class="${className}" href="#contact" aria-describedby="email-status">${icon('mail')}${label}${icon('arrow')}</a>`;
}

export function photo(image, { className = '', width = 800, height = 600, eager = false, sizes = '(max-width: 700px) 100vw, 50vw' } = {}) {
  const src = (w) => image.url.startsWith('https://images.unsplash.com/') ? `${image.url}?auto=format&fit=crop&w=${w}&q=80` : image.url;
  return `<img class="${className}" src="${escapeHtml(src(width))}" ${image.url.startsWith('http') ? `srcset="${[480, 800, 1200, 1800].map(w => `${escapeHtml(src(w))} ${w}w`).join(', ')}" sizes="${sizes}"` : ''} width="${width}" height="${height}" alt="${escapeHtml(image.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" ${eager ? 'fetchpriority="high"' : ''} ${image.position ? `style="object-position:${escapeHtml(image.position)}"` : ''}>`;
}

export function header() {
  return `<a class="skip-link" href="#main">Skip to main content</a>
  <div class="topline"><span>Rooted in Abia. Growing with purpose.</span><span>Okwu Autonomous Community, Nigeria ${icon('pin')}</span></div>
  <header class="site-header">
    <a class="wordmark" href="#home" aria-label="${company.name} — Home">${company.logo ? `<img src="${escapeHtml(company.logo)}" alt="" width="42" height="42">` : ''}<span class="wordmark-name">OHAJIUGWO<span>ORGANIC FARMS LTD</span></span></a>
    <button class="menu-toggle" aria-controls="main-nav" aria-expanded="false">${icon('menu')}<span>Menu</span></button>
    <nav id="main-nav" aria-label="Main navigation">${navigation.map(([text, url], i) => `<a href="${url}" ${i === 0 ? 'aria-current="page"' : ''}>${text}</a>`).join('')}<a class="nav-contact" href="#contact">Let’s talk ${icon('arrow')}</a></nav>
  </header>`;
}

export function footer() {
  return `<footer class="site-footer"><div class="footer-main"><a class="wordmark" href="#home"><span class="wordmark-name">OHAJIUGWO<span>ORGANIC FARMS LTD</span></span></a><p>Good food. Living soil.<br>A future we grow together.</p><div class="footer-links"><a href="#products">Our products</a><a href="#services">Services & training</a><a href="#contact">Contact the farm</a></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${company.displayName}. All rights reserved.</span><a href="#home">Back to top ↑</a></div></footer>`;
}
