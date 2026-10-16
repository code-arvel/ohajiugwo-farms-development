import { images } from '../config/company.mjs';
import { sectionIntro, sectionBlock, productCard, enquiryBanner } from '../components/sections.mjs';
import { icon } from '../components/shared.mjs';

export function products() {
  return sectionBlock('products', `
    ${sectionIntro('From the land.<br>For <em>your table.</em>', 'Seasonal crops, tropical fruits, meat, fish and seedlings. Explore our range, then email the farm to ask what is available.', 'products')}
    <section class="section catalogue" aria-labelledby="produce-heading"><div class="section-heading"><h3 id="produce-heading">Grown with <em>care.</em></h3><p>Our crop production uses compost, crop rotation and natural pest-management approaches, without synthetic pesticides or chemical fertilisers.</p></div>
      <div class="product-grid">
        ${productCard({ image: images.greens, title: 'Seasonal vegetables & leafy greens', description: 'Vegetables and leafy greens for everyday cooking and seasonal menus. Ask about the crops currently available.' })}
        ${productCard({ image: images.fruit, title: 'Tropical fruits', description: 'A seasonal fruit range reflecting what is growing. Email us to discuss current fruit varieties and your requirements.' })}
        ${productCard({ image: images.planting, title: 'Crop & plant seedlings', description: 'Seedlings for growers preparing for their next planting. Ask about varieties, quantities and suitability for your plans.' })}
      </div>
    </section>
    <section class="section range-section" aria-labelledby="range-heading"><div class="section-heading"><h3 id="range-heading">More from <em>the farm.</em></h3><p>Our wider range includes indigenous root crops, meat and fish. Availability and supply arrangements are discussed by email.</p></div>
      <div class="services-grid"><article><span class="service-icon">${icon('sprout')}</span><h4>Indigenous root crops</h4><p>Root crops rooted in local food traditions. Contact us to confirm current varieties, harvest timing and available quantities.</p></article>
      <article><span class="service-icon">${icon('leaf')}</span><h4>Meat</h4><p>Farm-produced meat is part of our range. Please ask about the types available and the preparation and supply arrangements.</p></article>
      <article><span class="service-icon">${icon('drop')}</span><h4>Fish</h4><p>Fish is also included in our product range. Email us to confirm species, availability and your supply requirements.</p></article></div>
    </section>
    <section class="section editorial-note" aria-labelledby="packaging-heading"><div><h3 id="packaging-heading">Thoughtfully prepared.<br><em>Clearly discussed.</em></h3></div><div class="prose"><p>Our profile includes the preparation and packaging of vegetables and fruits. Please enquire about the packaging and supply options available for your needs.</p><p>Seasonal availability varies. We confirm the product, quantity, timing and any preparation or supply arrangements directly by email before an order is agreed.</p><p>An on-site eco-packaging and cold-storage facility is a future plan, described on our <a class="inline-link" href="#future-heading">About section</a>.</p></div></section>
    ${enquiryBanner('Something for your table.<br>Or <em>your business.</em>', 'Families, restaurants, grocery stores, hotels, schools, wellness clinics and cooperatives are welcome to enquire about produce and supply partnerships.', 'products-enquiry-title')}
  `);
}
