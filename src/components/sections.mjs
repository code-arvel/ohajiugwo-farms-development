import { company } from '../config/company.mjs';
import { icon, photo, emailButton, escapeHtml } from './shared.mjs';

export function sectionIntro(title, description, id) {
  return `<div class="section-intro"><h2 id="${id}-title">${title}</h2><p>${description}</p></div>`;
}

export function sectionBlock(id, content) {
  return `<section id="${id}" class="scroll-section" tabindex="-1" aria-labelledby="${id}-title">${content}</section>`;
}

export function stockFigure(image, { className = '', width = 900, height = 800, sizes, eager = false } = {}) {
  return `<figure class="editorial-image ${className}">${photo(image, { width, height, ...(sizes ? { sizes } : {}), eager })}${image.stock ? '<figcaption>Temporary stock photograph · Not our farm, people or produce</figcaption>' : ''}</figure>`;
}

export function locationDetails({ id = 'locations', headingLevel = 4 } = {}) {
  return `<div id="${id}" class="locations"><div>${icon('pin')}<div><h${headingLevel}>Our headquarters</h${headingLevel}><p>${escapeHtml(company.headquarters)}.</p></div></div><div>${icon('sprout')}<div><h${headingLevel}>Our farmland</h${headingLevel}><p>${escapeHtml(company.farmland)}.<br>${company.hectares} hectares, cultivated with care.</p></div></div></div>`;
}

export function contactPanel({ id = 'enquiries', title = 'From our farm<br>to <em>your next idea.</em>' } = {}) {
  return `<section id="${id}" class="contact-section" aria-labelledby="email-heading"><div class="contact-top"><h3 id="email-heading">${title}</h3><p>Looking for seasonal produce, a supply partnership or practical farming knowledge? We’d love to hear from you.</p>
    ${company.email ? `<a class="email-address" href="mailto:${escapeHtml(company.email)}">${escapeHtml(company.email)}</a><div class="contact-actions">${emailButton('button')}<button class="copy-email" data-email="${escapeHtml(company.email)}">${icon('copy')} Copy email</button></div><p class="copy-status" role="status" aria-live="polite"></p>` : `<div class="email-pending" id="email-status">${icon('mail')}<div><strong>Company email to be supplied</strong><p>Enquiries will open here once the farm’s email address is confirmed.</p></div></div><button class="button" disabled>${icon('mail')} Email the Farm ${icon('arrow')}</button>`}
    <p class="email-only">All produce, partnership and training enquiries are handled by email.</p></div>${locationDetails()}</section>`;
}

export function enquiryBanner(title = 'Good things begin<br>with <em>a conversation.</em>', text = 'Tell us what you’re looking for, and let’s explore how the farm can help.', id = 'enquiry-title') {
  return `<section class="enquiry-banner" aria-labelledby="${id}"><h3 id="${id}">${title}</h3><p>${text}</p>${emailButton()}</section>`;
}

export function productCard({ image, title, description, link = '#contact', linkText = 'Enquire about availability' }) {
  return `<article class="product-card"><div class="product-image">${photo(image, { width: 800, height: 650, sizes: '(max-width: 550px) 100vw, 33vw' })}${image.stock ? '<span class="image-label">Temporary stock</span>' : ''}</div><div class="product-copy"><h4>${title}</h4><p>${description}</p><a href="${link}" class="text-link">${linkText} ${icon('arrow')}</a></div></article>`;
}
