import test from 'node:test';
import assert from 'node:assert/strict';
import { articleContents } from '../src/content/contents.mjs';
import { toDocument, renderDocument } from '../src/content/article.mjs';
import { blogArticle } from '../src/pages/blog.mjs';
import { samplePosts } from '../src/content/seed.mjs';
import { longArticle } from './fixtures/long-article.mjs';

test('contents requires both four minutes and three meaningful sections',()=>{
 const doc=toDocument(longArticle);
 assert.equal(articleContents(doc).items.length,4);
 assert.equal(articleContents(toDocument(samplePosts[0])).items.length,0);
 const few={...doc,content:doc.content.map((n,i)=>n.type==='heading'&&i>3?{type:'paragraph',content:n.content}:n)};
 assert.equal(articleContents(few).items.length,0);
 const empty={type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Empty section'}]},...doc.content]};
 assert.equal(articleContents(empty).items.length,4,'a heading without body content does not count');
 const tiny={type:'doc',content:doc.content.filter((n,i)=>n.type==='heading'||i%3===1).map(n=>n.type==='paragraph'?{type:'paragraph',content:[{type:'text',text:'Short.'}]}:n)};
 assert.equal(articleContents(tiny).items.length,0);
});

test('heading anchors are deterministic and unique even with repeated headings and slug collisions',()=>{
 const doc=toDocument(longArticle);const contents=articleContents(doc);
 assert.deepEqual(contents,articleContents(structuredClone(doc)));
 assert.equal(new Set(contents.headingIds).size,contents.headingIds.length);
 assert.equal(contents.headingIds[0],'article-section-reading-the-soil');
 assert.equal(contents.headingIds[1],'article-section-reading-the-soil-2');
 assert.equal(contents.headingIds[3],'article-section-reading-the-soil-2-2');
 const html=renderDocument(doc,{headingIds:contents.headingIds});
 for(const item of contents.items)assert.ok(html.includes(`id="${item.id}"`));
});

test('long articles render native keyboard accessible contents; short articles omit all contents wrappers',()=>{
 const html=blogArticle(longArticle);
 assert.match(html,/<details class="article-toc-mobile"><summary>On this page<\/summary>/);
 assert.match(html,/class="article-toc-rail"/);
 for(const item of articleContents(toDocument(longArticle)).items) {
  assert.ok(html.includes(`href="#${item.id}"`));
  assert.ok(html.includes(`id="${item.id}" tabindex="-1"`));
 }
 assert.ok(!blogArticle(samplePosts[0]).includes('article-toc'));
});

test('H3 entries preserve hierarchy and anchors do not change when paragraphs are inserted',()=>{
 const doc=toDocument(longArticle);doc.content[3].attrs.level=3;
 const before=articleContents(doc);assert.equal(before.items[1].level,3);
 doc.content.unshift({type:'paragraph',content:[{type:'text',text:'An additional introduction.'}]});
 assert.deepEqual(articleContents(doc).headingIds,before.headingIds);
 assert.match(renderDocument(doc,{headingIds:before.headingIds}),/<h3 id="article-section-reading-the-soil-2" tabindex="-1">/);
 const empty=structuredClone(doc);empty.content[1].content=[{type:'text',text:'   '}];
 assert.equal(articleContents(empty).items.length,3);
 assert.equal(new Set(articleContents(empty).headingIds).size,4);
});
