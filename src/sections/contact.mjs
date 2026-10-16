import { sectionIntro, sectionBlock, contactPanel } from '../components/sections.mjs';
import { icon } from '../components/shared.mjs';

export function contact() {
  return sectionBlock('contact', `
    ${sectionIntro('Let’s grow<br>something <em>together.</em>', 'For seasonal produce, supply partnerships and farming knowledge, a conversation with the farm is a good place to start.', 'contact')}
    ${contactPanel({ id: 'enquiries', title: 'Email <em>the farm.</em>' })}
    <section class="section" aria-labelledby="enquiry-guide-heading"><div class="section-heading"><h3 id="enquiry-guide-heading">Help us understand<br><em>what you need.</em></h3><p>A few details in your email can help us discuss the right options with you.</p></div><div class="services-grid">
      <article><span class="service-icon">${icon('leaf')}</span><h4>Produce enquiries</h4><p>Tell us the products you are interested in, the quantity you have in mind and your preferred timing. We’ll discuss seasonal availability.</p></article>
      <article><span class="service-icon">${icon('sprout')}</span><h4>Supply partnerships</h4><p>Introduce your restaurant, shop, hotel, school, clinic or cooperative and outline the kind of supply relationship you would like to explore.</p></article>
      <article><span class="service-icon">${icon('book')}</span><h4>Training & consulting</h4><p>Share your growing goals, the topics you want to learn about and whether you are enquiring as an individual or a group.</p></article>
    </div></section>
  `);
}
