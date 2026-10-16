import { company } from '../config/company.mjs';

// Fixed slots mirror the approved homepage. The editor works on a COPY, never this source.
export const homepageContent = {
  company: {
    name: company.name, displayName: company.displayName, get email() { return company.email; },
    headquarters: company.headquarters, farmland: company.farmland, hectares: company.hectares,
    mission: 'Our mission is to make wholesome, affordable organic food more accessible while caring for the land that sustains us.',
    vision: company.vision, values: ['Integrity', 'Sustainability', 'Community health']
  },
  products: [
    { title: 'Vegetables & leafy greens', description: 'Seasonal crops grown with compost, crop rotation and care for the soil.', enquiry: 'Enquire about produce' },
    { title: 'Tropical fruits', description: 'Fruits that celebrate the variety and character of our growing seasons.', enquiry: 'Ask what’s in season' },
    { title: 'Seedlings for new beginnings', description: 'Crop and plant seedlings for growers taking their next step.', enquiry: 'Enquire about seedlings' }
  ],
  services: [
    { title: 'Workshops & training', description: 'Learn about composting, crop rotation, organic pest management and the transition to sustainable farming.', enquiry: 'Ask about training' },
    { title: 'Agricultural consulting', description: 'Explore farming approaches and soil health management suited to your growing ambitions.', enquiry: 'Discuss your farm' },
    { title: 'Supply partnerships', description: 'Start a conversation about produce for restaurants, grocery stores, hotels, schools, wellness clinics and cooperatives.', enquiry: 'Explore a partnership' }
  ]
};

// Disposable editorial examples, not reports of work carried out by the company.
export const samplePosts = [
  {
    id: 'sample-soil', revision: 1, reviewOnly: true, status: 'published', slug: 'getting-to-know-your-soil',
    title: 'Getting to know your soil', excerpt: 'A few thoughtful observations can help you understand the ground beneath your crops.',
    publishedAt: '2026-10-01', cover: 'planting',
    blocks: [
      { type: 'paragraph', text: 'Before making changes to a growing space, take time to observe it. Soil texture, drainage and the plants already growing there can offer useful starting points.' },
      { type: 'heading', text: 'Start with observation' },
      { type: 'paragraph', text: 'Look at how the ground responds after rain. Does water soak in, run away or collect in one place? Record what you notice over time rather than drawing conclusions from a single day.' },
      { type: 'heading', text: 'Keep a simple growing record' },
      { type: 'list', items: ['Note where and when crops were planted.', 'Record compost additions and changes in soil structure.', 'Seek local advice or a soil test before making major changes.'] },
      { type: 'paragraph', text: 'These general observations are a starting point for learning. The right approach depends on the soil, growing conditions and crops involved.' }
    ]
  },
  {
    id: 'sample-season', revision: 1, reviewOnly: true, status: 'published', slug: 'planning-for-seasonal-produce',
    title: 'Planning for seasonal produce', excerpt: 'A flexible plan helps households and kitchens make the most of changing seasons.',
    publishedAt: '2026-09-25', cover: 'greens',
    blocks: [
      { type: 'paragraph', text: 'Seasonal availability changes. Leaving room for alternatives can make it easier to plan meals around the produce available at the time.' },
      { type: 'heading', text: 'Ask before you plan' },
      { type: 'paragraph', text: 'When making a produce enquiry, share the crops you are interested in, the approximate quantity and the date you have in mind. Availability and supply arrangements should always be confirmed directly.' },
      { type: 'heading', text: 'Leave room for variety' },
      { type: 'paragraph', text: 'A meal plan with a few adaptable recipes can accommodate different leafy vegetables or root crops without requiring a complete rethink.' }
    ]
  },
  {
    id: 'sample-draft', revision: 1, reviewOnly: true, status: 'draft', slug: 'unpublished-sample',
    title: 'PRIVATE_DRAFT_SENTINEL', excerpt: 'An unpublished example for local draft-exclusion checks.',
    publishedAt: '', cover: 'fruit', blocks: [{ type: 'paragraph', text: 'This sample must never appear in the public build.' }]
  }
];
