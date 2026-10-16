import { articleContents } from '../content/contents.mjs';
import { company, images } from '../config/company.mjs';
import { escapeHtml as e, photo, icon } from '../components/shared.mjs';
import { page } from '../layouts/page.mjs';
import { publicPosts } from '../content/schema.mjs';
import { toDocument, readingMinutes, renderDocument } from '../content/article.mjs';

const url = post => `/blog/${post.slug}/`;
const date = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
const metadata = post => `<div class="journal-meta"><time datetime="${e(post.publishedAt)}">${date(post.publishedAt)}</time><span aria-hidden="true">·</span><span>${readingMinutes(toDocument(post))} min read</span></div>`;
const image = (post, options = {}) => {
  const source = images[post.cover];
  // Stock provenance stays in docs/ASSETS.md; alternatives describe the image itself.
  const alt = source.alt.replace(/ — temporary stock photograph.*$/i, '');
  return photo({ ...source, alt }, options);
};
const card = (post, featured = false) => `<article class="${featured ? 'journal-feature' : 'journal-card'}" data-post-id="${e(post.id)}"><a class="journal-image-link" href="${url(post)}" tabindex="-1" aria-hidden="true">${image(post, {width:featured?1000:700,height:featured?680:480,eager:featured,sizes:featured?'(max-width: 700px) 100vw, 55vw':'(max-width: 700px) 100vw, 33vw'})}</a><div class="journal-card-copy">${metadata(post)}<h2><a href="${url(post)}">${e(post.title)}</a></h2><p>${e(post.excerpt)}</p><a class="text-link" href="${url(post)}" aria-label="Read ${e(post.title)}">Read article ${icon('arrow')}</a></div></article>`;

export function blogListing(posts) {
  const [featured, ...remaining] = publicPosts(posts);
  return page(`<section class="journal section" aria-labelledby="journal-title"><header class="journal-intro"><h1 id="journal-title">Farm Journal</h1><p>Practical notes on growing, seasonal food and caring for the land.</p></header>${featured ? `${card(featured,true)}${remaining.length?`<div class="journal-grid ${remaining.length===1?'has-one':''}">${remaining.map(post=>card(post)).join('')}</div>`:''}` : '<p class="journal-empty">No articles published yet. Please visit again soon.</p>'}<a class="text-link journal-back" href="/">Back to the farm ${icon('arrow')}</a></section>`, {blog:true,path:'/blog/',title:`Farm Journal | ${company.displayName}`,description:'Practical notes on growing, seasonal food and caring for the land.'});
}

const contentsLinks = items => `<ul>${items.map(item=>`<li class="toc-level-${item.level}"><a href="#${e(item.id)}">${e(item.label)}</a></li>`).join('')}</ul>`;
const contentsMarkup = items => `<details class="article-toc-mobile"><summary>On this page</summary><nav aria-label="On this page">${contentsLinks(items)}</nav></details><aside class="article-toc-rail"><nav class="article-toc-desktop" aria-label="On this page"><p>On this page</p>${contentsLinks(items)}</nav></aside>`;

export function blogArticle(post, posts = []) {
  if (!publicPosts([post]).length) throw new Error('Draft articles have no public page.');
  const body=toDocument(post);
  const contents=articleContents(body);
  const reading=contents.items.length?`<div class="article-reading">${contentsMarkup(contents.items)}<div class="article-body">${renderDocument(body,{headingIds:contents.headingIds})}</div></div>`:`<div class="article-body">${renderDocument(body)}</div>`;
  const related=publicPosts(posts).filter(other=>other.id!==post.id&&other.slug!==post.slug).slice(0,3);
  return page(`<article class="journal-article"><header class="article-heading"><a class="article-back" href="/blog/">← Farm Journal</a><h1>${e(post.title)}</h1><p class="article-excerpt">${e(post.excerpt)}</p><div class="article-byline">${post.author?.trim()?`<span class="article-author">By ${e(post.author)}</span>`:''}${metadata(post)}</div></header><figure class="article-cover">${image(post,{width:1100,height:520,eager:true,sizes:'(max-width: 700px) calc(100vw - 44px), (max-width: 780px) calc(100vw - 48px), 732px'})}</figure>${reading}</article>${related.length?`<section class="article-related" aria-labelledby="related-title"><h2 id="related-title">Related articles</h2><div class="journal-grid ${related.length===1?'has-one':''}">${related.map(other=>card(other)).join('')}</div></section>`:''}<div class="article-return"><a class="text-link" href="/blog/">← Back to Farm Journal</a></div>`, {blog:true,path:url(post),title:`${post.title} | ${company.displayName}`,description:post.excerpt});
}
