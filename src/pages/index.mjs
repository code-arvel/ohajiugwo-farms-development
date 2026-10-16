import { home } from './home.mjs';
import { blogListing, blogArticle } from './blog.mjs';
import { samplePosts } from '../content/seed.mjs';
import { publicPosts } from '../content/schema.mjs';

// One company homepage. Only published sample posts receive public article routes.
export const pages = [
  { path: 'index.html', render: home },
  { path: 'blog/index.html', render: () => blogListing(samplePosts) },
  ...publicPosts(samplePosts).map(post => ({ path: `blog/${post.slug}/index.html`, render: () => blogArticle(post, samplePosts) }))
];
