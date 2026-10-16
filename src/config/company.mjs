// Keep unconfirmed facts empty. No invented email address or certification badge.
export const company = {
  name: 'OHAJIUGWO ORGANIC FARMS LTD',
  displayName: 'Ohajiugwo Organic Farms Ltd',
  email: 'ohajiugwochimeziebibi@gmail.com',
  logo: '', // Optional local image path, e.g. /images/company-logo.svg
  siteUrl: '', // Set to the approved public HTTPS origin before publication.
  publicationReady: false,
  locationsConfirmed: true, // Both spellings confirmed by the owner on 15 October 2026.
  headquarters: 'Umuolo Umuarokoro, Okwu Autonomous Community, Umuahia South LGA, Abia State, Nigeria',
  farmland: 'Okpuru-Icheku Mgbokoro, Okwu Autonomous Community',
  structuredAddress: { streetAddress: 'Umuolo Umuarokoro, Okwu Autonomous Community', addressLocality: 'Umuahia South LGA', addressRegion: 'Abia State', addressCountry: 'NG' },
  hectares: 5,
  certifications: [], // Future entries need verified issuer, scope and evidence; never render a badge automatically.
  mission: 'To provide wholesome, affordable organic food while restoring soil vitality and local biodiversity.',
  vision: 'To become a leading regional model for sustainable, climate-smart agriculture and environmentally responsible food supply chains.',
  values: ['Integrity and transparency', 'Environmental stewardship', 'Community health'],
  description: 'Meet Ohajiugwo Organic Farms Ltd, a sustainable agricultural enterprise in Abia State, Nigeria. Explore our produce, farming practices and training services.'
};

export const navigation = [
  ['Home', '#home'], ['About', '#about'], ['Products', '#products'],
  ['Services & Training', '#services'], ['Our Practices', '#practices'],
  ['Let’s talk', '#contact']
];

// Temporary licensed stock: these images do not depict the company or its farmland.
// Replace the object entries with local authentic images when supplied. See docs/ASSETS.md.
export const images = {
  hero: { url: 'https://images.unsplash.com/photo-1522184074623-e772ae8ec940', alt: 'Rows of leafy crops in a sunlit field — temporary stock photograph, not our farm', position: 'center 58%', stock: true },
  greens: { url: 'https://images.unsplash.com/photo-1591981093681-7f410be94750', alt: 'A close view of green lettuce leaves — temporary stock photograph', stock: true },
  fruit: { url: 'https://images.unsplash.com/photo-1618871736709-0843f4cfc85b', alt: 'A pineapple against a warm yellow background — temporary stock photograph', stock: true },
  planting: { url: 'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea', alt: 'Gloved hands planting a young seedling in soil — temporary stock photograph, not our staff', stock: true }
};
