import { images } from '../config/company.mjs';
import { homepageContent } from '../content/seed.mjs';
import { validateHomepage } from '../content/schema.mjs';
import { page } from '../layouts/page.mjs';
import { icon, photo, emailButton, escapeHtml } from '../components/shared.mjs';

export function home(content = homepageContent) {
  validateHomepage(content);
  const { company, products, services } = content;
  return page(`
  <section id="home" tabindex="-1" class="hero" aria-labelledby="hero-title">
    ${photo(images.hero, { className: 'hero-image', width: 1800, height: 1000, eager: true, sizes: '100vw' })}
    <div class="hero-shade"></div><div class="hero-content"><p class="eyebrow light">ABIA STATE, NIGERIA</p>
    <h1 id="hero-title">Good food.<br>Living soil.<br><em>Stronger communities.</em></h1>
    <p class="hero-description">From our soil to your table, we’re growing a better future through thoughtful, sustainable farming.</p>
    <div class="hero-actions">${emailButton('button button-cream', 'Email the Farm', company.email)}<a class="text-link light-link" href="#products">Explore our produce ${icon('arrow')}</a></div></div>
    <div class="hero-bottom"><span>${icon('sprout')} Nurturing the land. Nourishing our community.</span></div>
  </section>
  <div class="principles-strip"><span>${icon('sprout')} Soil-first farming</span><span>${icon('leaf')} Seasonal, locally rooted produce</span><span>${icon('drop')} Thoughtful use of resources</span><span>${icon('book')} Knowledge worth sharing</span></div>

  <section id="products" tabindex="-1" class="section products" aria-labelledby="products-title"><div class="section-heading"><div><h2 id="products-title">A little of what <em>we grow.</em></h2></div><p>Fresh produce, strong beginnings and the goodness of the seasons. Discover what’s growing at Ohajiugwo.</p></div>
    <div class="product-grid">
      <article class="product-card"><div class="product-image">${photo(images.greens, { width: 800, height: 650, sizes: '(max-width: 650px) 100vw, 33vw' })}</div><div class="product-copy"><h3>${escapeHtml(products[0].title)}</h3><p>${escapeHtml(products[0].description)}</p><a href="#contact" class="text-link">${escapeHtml(products[0].enquiry)} ${icon('arrow')}</a></div></article>
      <article class="product-card"><div class="product-image">${photo(images.fruit, { width: 800, height: 650, sizes: '(max-width: 650px) 100vw, 33vw' })}</div><div class="product-copy"><h3>${escapeHtml(products[1].title)}</h3><p>${escapeHtml(products[1].description)}</p><a href="#contact" class="text-link">${escapeHtml(products[1].enquiry)} ${icon('arrow')}</a></div></article>
      <article class="product-card"><div class="product-image">${photo(images.planting, { width: 800, height: 650, sizes: '(max-width: 650px) 100vw, 33vw' })}</div><div class="product-copy"><h3>${escapeHtml(products[2].title)}</h3><p>${escapeHtml(products[2].description)}</p><a href="#contact" class="text-link">${escapeHtml(products[2].enquiry)} ${icon('arrow')}</a></div></article>
    </div><div class="produce-note"><p><strong>There’s more to discover.</strong> Our range also includes indigenous root crops, meat and fish.</p><span>Availability varies. Please enquire by email.</span></div>
  </section>

  <section id="practices" tabindex="-1" class="practices" aria-labelledby="practices-title"><div class="practices-intro"><h2 id="practices-title">Better farming starts<br>with <em>living soil.</em></h2><p>We see a farm as a living system. Our practices bring together soil care, biodiversity and the careful use of water and energy.</p><a href="#practice-details" class="text-link light-link">Explore our approach ${icon('arrow')}</a><div class="practice-signoff">Rooted in responsibility. <span>Growing for tomorrow.</span></div></div>
    <div class="practice-list" id="practice-details">
      <article>${icon('sprout')}<div><h3>Feed the soil, naturally</h3><p>Organic manuring, green composting, cover crops and crop rotation help replenish the soil and support microbial activity.</p></div><span>01</span></article>
      <article>${icon('leaf')}<div><h3>Make room for biodiversity</h3><p>Biological controls, companion planting and natural deterrents guide our approach to pest management.</p></div><span>02</span></article>
      <article>${icon('drop')}<div><h3>Make every drop count</h3><p>Rainwater harvesting and drip irrigation help us use water more carefully across the farm.</p></div><span>03</span></article>
      <article>${icon('sun')}<div><h3>Put the sun to work</h3><p>Solar-powered farm tools form part of our commitment to conserving energy and resources.</p></div><span>04</span></article>
    </div>
  </section>

  <section id="about" tabindex="-1" class="section story" aria-labelledby="story-title"><div class="story-art"><figure>${photo(images.planting, { width: 900, height: 1000 })}</figure><div class="land-note"><strong>${escapeHtml(company.hectares)} <span>hectares</span></strong><p>One shared commitment<br>to a better way of growing.</p></div></div><div class="story-copy"><h2 id="story-title">Proudly rooted<br>in <em>Abia State.</em></h2><p class="lead">Good farming is about more than what we harvest. It’s about what we give back.</p><p>${escapeHtml(company.displayName)} is a sustainable agricultural enterprise based in Okwu Autonomous Community. From our ${company.hectares === 5 ? 'five' : escapeHtml(company.hectares)}-hectare farmland at ${escapeHtml(company.farmland.split(',')[0])}, we grow crops and raise livestock with a focus on soil vitality and local biodiversity.</p><p>${escapeHtml(company.mission)}</p><div class="values">${company.values.map(value => `<span>${icon('check')} ${escapeHtml(value)}</span>`).join('')}</div><a class="text-link" href="#locations">Where we’re based ${icon('arrow')}</a></div></section>

  <section id="services" tabindex="-1" class="section services" aria-labelledby="services-title"><div class="section-heading"><div><h2 id="services-title">Let’s grow <em>together.</em></h2></div><p>Practical support for emerging farmers, local growers and organisations investing in a more sustainable food system.</p></div><div class="services-grid"><article><span class="service-icon">${icon('book')}</span><h3>${escapeHtml(services[0].title)}</h3><p>${escapeHtml(services[0].description)}</p><a class="text-link" href="#contact">${escapeHtml(services[0].enquiry)} ${icon('arrow')}</a></article><article><span class="service-icon">${icon('sprout')}</span><h3>${escapeHtml(services[1].title)}</h3><p>${escapeHtml(services[1].description)}</p><a class="text-link" href="#contact">${escapeHtml(services[1].enquiry)} ${icon('arrow')}</a></article><article><span class="service-icon">${icon('leaf')}</span><h3>${escapeHtml(services[2].title)}</h3><p>${escapeHtml(services[2].description)}</p><a class="text-link" href="#contact">${escapeHtml(services[2].enquiry)} ${icon('arrow')}</a></article></div><p class="service-note">Training schedules, service scope and supply arrangements are agreed by email.</p></section>

  <section id="contact" tabindex="-1" class="contact-section" aria-labelledby="contact-title"><div class="contact-top"><h2 id="contact-title">From our farm<br>to <em>your next idea.</em></h2><p>Looking for seasonal produce, a supply partnership or practical farming knowledge? We’d love to hear from you.</p>
    ${company.email ? `<a class="email-address" href="mailto:${escapeHtml(company.email)}">${escapeHtml(company.email)}</a><div class="contact-actions">${emailButton('button', 'Email the Farm', company.email)}<button class="copy-email" data-email="${escapeHtml(company.email)}">${icon('copy')} Copy email</button></div><p class="copy-status" role="status" aria-live="polite"></p>` : `<div class="email-pending" id="email-status">${icon('mail')}<div><strong>Company email to be supplied</strong><p>Enquiries will open here once the farm’s email address is confirmed.</p></div></div><button class="button" disabled>${icon('mail')} Email the Farm ${icon('arrow')}</button>`}
    <p class="email-only">All produce, partnership and training enquiries are handled by email.</p></div><div id="locations" class="locations"><div>${icon('pin')}<div><h3>Our headquarters</h3><p>${escapeHtml(company.headquarters)}.</p></div></div><div>${icon('sprout')}<div><h3>Our farmland</h3><p>${escapeHtml(company.farmland)}.<br>${company.hectares === 5 ? 'Five' : escapeHtml(company.hectares)} hectares, cultivated with care.</p></div></div></div></section>
  `, { company });
}
