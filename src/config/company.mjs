// Keep unconfirmed facts empty. No invented email address or certification badge.
export const company = {
  name: 'OHAJIUGWO ORGANIC FARMS LTD',
  displayName: 'Ohajiugwo Organic Farms Ltd',
  email: 'ohajiugwochimeziebibi@gmail.com',
  logo: '/images/ohajiugwo-symbol.svg', // Owner-supplied symbol, preserved unchanged.
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
  ['Blog', '/blog/'], ['Let’s talk', '#contact']
];

// Temporary licensed stock: these images do not depict the company or its farmland.
// Replace the object entries with local authentic images when supplied. See docs/ASSETS.md.
const stockImage=(name,alt,position='center')=>({url:`/images/stock/${name}-1200.webp`,alt,position,stock:true,variants:[480,800,1200].map(width=>({url:`/images/stock/${name}-${width}.webp`,width}))});
export const images = {
 hero:stockImage('hero','Rows of leafy crops in a sunlit field — temporary stock photograph, not our farm','center 58%'),
 greens:stockImage('greens','Fresh leafy vegetables growing in a garden bed — temporary stock photograph, not our produce'),
 fruit:stockImage('fruit','A pineapple growing among its leaves — temporary stock photograph from Mexico, not our farm','center 40%'),
 planting:stockImage('planting','Young seedlings growing in soil trays — temporary stock photograph, not our nursery'),
 story:stockImage('story','Gloved hands tending a seedling in soil — temporary stock photograph, not our staff')
};
