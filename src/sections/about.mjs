import { company, images } from '../config/company.mjs';
import { sectionIntro, sectionBlock, stockFigure, locationDetails, enquiryBanner } from '../components/sections.mjs';
import { escapeHtml, icon } from '../components/shared.mjs';

export function about() {
  return sectionBlock('about', `
    ${sectionIntro('Rooted in Abia.<br>Growing <em>with purpose.</em>', 'Meet a farm working towards a future where wholesome food, living soil and thriving communities grow together.', 'about')}
    <section class="section editorial-split" aria-labelledby="story-heading">
      ${stockFigure(images.planting, { eager: false })}
      <div class="prose"><h3 id="story-heading">Our land.<br><em>Our responsibility.</em></h3>
        <p class="lead">Ohajiugwo Organic Farms Ltd is a sustainable agricultural enterprise in Okwu Autonomous Community, Abia State, Nigeria.</p>
        <p>We produce crops and livestock through regenerative farming approaches that put soil vitality, biodiversity and careful resource use at the heart of our work.</p>
        <p>Our ${company.hectares}-hectare farmland is located at ${escapeHtml(company.farmland)}. Our headquarters are at ${escapeHtml(company.headquarters)}.</p>
        <p>The company is registered with Nigeria’s Corporate Affairs Commission (CAC).</p>
        <a class="text-link" href="#sustainable-farming">How we farm ${icon('arrow')}</a>
      </div>
    </section>
    <section class="section purpose-section" aria-labelledby="purpose-heading"><h3 id="purpose-heading">Food with purpose.<br>A vision <em>for tomorrow.</em></h3>
      <div class="purpose-grid"><article><h4>Our mission</h4><p>${escapeHtml(company.mission)}</p><p>We work towards food that is safe and wholesome through thoughtful farming practices and a commitment to clear information about how it is produced.</p></article>
      <article><h4>Our vision</h4><p>${escapeHtml(company.vision)}</p></article></div>
    </section>
    <section class="section values-section" aria-labelledby="values-heading"><div class="section-heading"><h3 id="values-heading">The values <em>we cultivate.</em></h3><p>Our choices in the field and our relationships with the people we serve begin here.</p></div>
      <div class="services-grid"><article><span class="service-icon">${icon('check')}</span><h4>Integrity & transparency</h4><p>Communicating honestly about farming methods and labelling, so people can understand what we grow and how we grow it.</p></article>
      <article><span class="service-icon">${icon('leaf')}</span><h4>Sustainability</h4><p>Protecting water resources, reducing our environmental footprint and working to minimise synthetic waste.</p></article>
      <article><span class="service-icon">${icon('sprout')}</span><h4>Community health</h4><p>Promoting nutritional awareness and closer connections between the farm and the families and organisations it serves.</p></article></div>
    </section>
    <section class="location-section" aria-labelledby="location-heading"><h3 id="location-heading">Two locations.<br><em>One shared purpose.</em></h3>${locationDetails({ id: 'about-locations' })}</section>
    <section class="future-section" aria-labelledby="future-heading"><div><h3 id="future-heading">What we hope<br>to <em>grow next.</em></h3><p>These are future plans. They are not completed facilities, active partnerships or existing certifications.</p></div><ol class="future-list">
      <li><h4>More land, thoughtfully cultivated</h4><p>Expand cultivated acreage, with certified organic cultivation as a future objective subject to the relevant requirements.</p></li>
      <li><h4>Less lost after harvest</h4><p>Develop an on-site eco-packaging and cold-storage facility to help reduce post-harvest losses.</p></li>
      <li><h4>More opportunities to learn</h4><p>Expand educational agri-tourism and farmer training partnerships.</p></li>
      <li><h4>Wider access to affordable food</h4><p>Seek partnerships with state and federal government and international agencies to support more affordable food.</p></li>
    </ol></section>
    ${enquiryBanner(undefined, undefined, 'about-enquiry-title')}
  `);
}
