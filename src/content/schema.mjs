// Shared, browser-compatible validation. No database or authentication is provided in Stage 1.
import { validateDocument, documentText } from './article.mjs';
const fail = message => { throw new Error(message); };
const object = (value, keys, label, optional = []) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}: expected a record.`);
  if (Object.keys(value).some(key => !keys.includes(key) && !optional.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) fail(`${label}: fields do not match the fixed structure.`);
};
const text = (value, max, label, allowEmpty = false) => {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) fail(`${label}: enter ${allowEmpty ? 'up to' : '1–'} ${max} characters.`);
};
const revision = value => { if (!Number.isSafeInteger(value) || value < 1) fail('Revision must be a positive integer.'); };

export function validateHomepage(data) {
  object(data, ['company', 'products', 'services'], 'Homepage');
  const c = data.company;
  object(c, ['name', 'displayName', 'email', 'headquarters', 'farmland', 'hectares', 'mission', 'vision', 'values'], 'Company');
  for (const key of ['name', 'displayName']) text(c[key], 80, key);
  for (const key of ['headquarters', 'farmland', 'mission', 'vision']) text(c[key], 260, key);
  text(c.email, 254, 'Email', true);
  if (c.email && !/^[^\s@<>"'&]+@[^\s@<>"'&]+\.[^\s@<>"'&]+$/.test(c.email)) fail('Email: enter a valid enquiry address or leave empty to disable email actions.');
  if (!Number.isFinite(c.hectares) || c.hectares <= 0 || c.hectares > 100000) fail('Farmland area: enter a positive number.');
  if (!Array.isArray(c.values) || c.values.length !== 3) fail('Keep the three existing values.');
  c.values.forEach(value => text(value, 80, 'Value'));
  for (const collection of ['products', 'services']) {
    if (!Array.isArray(data[collection]) || data[collection].length !== 3) fail(`Keep the three approved ${collection} slots.`);
    data[collection].forEach((item, i) => {
      object(item, ['title', 'description', 'enquiry'], `${collection} ${i + 1}`);
      text(item.title, 80, 'Title'); text(item.description, 200, 'Description'); text(item.enquiry, 50, 'Enquiry label');
    });
  }
  return data;
}

export function validatePosts(posts) {
  if (!Array.isArray(posts) || posts.length > 100) fail('Use a list of up to 100 local sample posts.');
  const ids = new Set(); const slugs = new Set();
  for (const post of posts) {
    object(post, ['id', 'revision', 'status', 'slug', 'title', 'excerpt', 'publishedAt', 'cover'], 'Article', ['blocks','body','author','reviewOnly']);
    if (Object.hasOwn(post,'body') === Object.hasOwn(post,'blocks')) fail('Use exactly one structured article body.');
    if (post.author !== undefined) text(post.author, 80, 'Author', true);
    if (post.reviewOnly !== undefined && typeof post.reviewOnly !== 'boolean') fail('Invalid content provenance.');
    text(post.id, 80, 'Article ID'); revision(post.revision);
    if (ids.has(post.id)) fail('Article IDs must be unique.'); ids.add(post.id);
    if (!['draft', 'published'].includes(post.status)) fail('Choose an explicit draft or published sample state.');
    if (typeof post.slug !== 'string' || post.slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) || post.slug === 'index' || slugs.has(post.slug)) fail('Article URL: use a unique lowercase slug with hyphens.');
    slugs.add(post.slug);
    text(post.title, 100, 'Article title'); text(post.excerpt, 240, 'Article excerpt');
    if (!['planting', 'greens', 'fruit', 'hero'].includes(post.cover)) fail('Choose an existing sample photograph.');
    if (typeof post.publishedAt !== 'string' || (post.publishedAt !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt) || !Number.isFinite(Date.parse(post.publishedAt)) || new Date(post.publishedAt).toISOString().slice(0, 10) !== post.publishedAt))) fail('Publication date: use a real YYYY-MM-DD date.');
    if (post.status === 'published' && !post.publishedAt) fail('Published samples need a publication date.');
    if (post.body) {
      validateDocument(post.body);
      if(post.status==='published'&&!documentText(post.body)) fail('Published articles need body text.');
      continue;
    }
    if (!Array.isArray(post.blocks) || post.blocks.length < 1 || post.blocks.length > 40) fail('An article needs 1–40 content blocks.');
    for (const block of post.blocks) {
      if (block?.type === 'list') {
        object(block, ['type', 'items'], 'List');
        if (!Array.isArray(block.items) || !block.items.length || block.items.length > 12) fail('Use 1–12 list items.');
        block.items.forEach(item => text(item, 500, 'List item'));
      } else {
        object(block, ['type', 'text'], 'Content block');
        if (!['paragraph', 'heading'].includes(block.type)) fail('Only paragraphs, headings and lists are supported.');
        text(block.text, block.type === 'heading' ? 120 : 2000, 'Block text');
      }
    }
  }
  return posts;
}

export function publicPosts(posts, { production = false } = {}) {
  validatePosts(posts);
  if(production && posts.some(post=>post.status==='published'&&post.reviewOnly!==false)) fail('Production cannot include review-only or unclassified content.');
  return posts.filter(post => post.status === 'published').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function validateSampleDocument(data) {
  object(data, ['revision', 'homepage', 'posts'], 'Local document');
  revision(data.revision); validateHomepage(data.homepage); validatePosts(data.posts);
  return data;
}

export function saveSampleDraft(current, edited, baseRevision) {
  validateSampleDocument(current); validateSampleDocument(edited);
  if (current.revision !== baseRevision) fail('This sample changed in another tab. Export your edits, then reload the saved sample.');
  return structuredClone({ ...edited, revision: current.revision + 1 });
}
