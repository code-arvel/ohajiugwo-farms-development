import { images } from '../config/company.mjs';
import { sectionIntro, sectionBlock, stockFigure, enquiryBanner } from '../components/sections.mjs';
import { icon } from '../components/shared.mjs';

const practice = (title, text) => `<article><h4>${title}</h4><p>${text}</p></article>`;

export function sustainable() {
  return sectionBlock('sustainable-farming', `
    ${sectionIntro('Living soil.<br>A more <em>thoughtful harvest.</em>', 'On our farm, sustainable agriculture means caring for the soil, supporting biodiversity and using water and energy carefully.', 'sustainable-farming')}
    <section class="section editorial-split" aria-labelledby="soil-heading">${stockFigure(images.greens, { eager: false })}<div class="prose"><h3 id="soil-heading">Start beneath<br><em>the surface.</em></h3><p class="lead">Soil is the foundation of our approach to regenerative farming.</p><p>We combine organic manuring, green composting, cover cropping and rotation to support soil structure and natural microbial activity. Our crop production avoids synthetic pesticides and chemical fertilisers.</p></div></section>
    <section class="section practice-group" aria-labelledby="soil-methods-heading"><h3 id="soil-methods-heading">Give back <em>to the soil.</em></h3><div class="method-grid">
      ${practice('Composting & organic manuring', 'Returning organic material to the soil helps replenish it. Green composting and organic manuring form part of our approach to supporting soil life.')}
      ${practice('Cover cropping', 'Growing cover crops helps keep the soil covered between or alongside production cycles and supports the natural activity beneath the surface.')}
      ${practice('Crop rotation', 'Changing the crops grown in an area across seasons helps us manage soil demands and avoid repeatedly drawing on the same growing conditions.')}
    </div></section>
    <section class="biodiversity-section" aria-labelledby="biodiversity-heading"><div class="section-heading"><h3 id="biodiversity-heading">Work with the life<br><em>around us.</em></h3><p>Our integrated pest management approach draws on biological controls, companion planting and natural deterrents.</p></div><div class="method-grid two-columns">
      ${practice('Biological pest management', 'Biological controls and natural deterrents are used to manage pests as part of an integrated approach, rather than relying on synthetic pesticides.')}
      ${practice('Companion planting', 'Growing complementary plants together forms part of how we manage the growing environment and encourage a more varied farm ecosystem.')}
    </div></section>
    <section class="section practice-group" aria-labelledby="resources-heading"><div class="section-heading"><h3 id="resources-heading">Care for every drop.<br><em>Value every resource.</em></h3><p>Water and energy conservation sit alongside soil care in our day-to-day farming practices.</p></div><div class="method-grid">
      ${practice('Rainwater harvesting', 'Collecting rainwater helps us make use of rainfall and manage water resources more thoughtfully.')}
      ${practice('Drip irrigation', 'Drip irrigation delivers water closer to the crop, supporting a more targeted approach to watering.')}
      ${practice('Solar-powered tools', 'Solar-powered farm tools make use of renewable energy as part of our wider approach to conserving resources.')}
    </div></section>
    <section class="section editorial-note" aria-labelledby="learn-more-heading"><h3 id="learn-more-heading">A practice to share.<br><em>A future to grow.</em></h3><div class="prose"><p>We share knowledge through workshops and consulting for emerging farmers. Our training covers composting, rotation, organic pest control and transition strategies.</p><p>Plans to expand cultivation, develop eco-packaging and cold storage, and grow educational partnerships are described separately on our About section.</p><div class="related-links"><a class="text-link" href="#services">Explore training ${icon('arrow')}</a><a class="text-link" href="#future-heading">Read our future plans ${icon('arrow')}</a></div></div></section>
    ${enquiryBanner('Curious about<br><em>how we grow?</em>', 'Ask about our farming methods, training or sustainable food partnerships. We welcome your questions by email.', 'sustainable-farming-enquiry-title')}
  `);
}
