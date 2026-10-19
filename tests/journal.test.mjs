import test from 'node:test';
import assert from 'node:assert/strict';
import { samplePosts } from '../src/content/seed.mjs';
import { blogListing, blogArticle } from '../src/pages/blog.mjs';
import { toDocument, validateDocument, documentText, readingMinutes, safeLink, renderDocument, migrateSampleDocument, fromEditorDocument } from '../src/content/article.mjs';
import { homepageContent } from '../src/content/seed.mjs';
import { publicPosts, validatePosts, saveSampleDraft } from '../src/content/schema.mjs';

test('legacy paragraphs, headings and lists convert without changing their text', () => {
  const body = toDocument(samplePosts[0]);
  validateDocument(body);
  assert.deepEqual(body.content.map(n=>n.type), ['paragraph','heading','paragraph','heading','bulletList','paragraph']);
  for(const block of samplePosts[0].blocks) for(const text of block.items || [block.text]) assert.ok(documentText(body).includes(text));
  assert.deepEqual(toDocument({body:JSON.parse(JSON.stringify(body))}),body);
});

test('safe links survive structured save/render while unsafe links and unsupported nodes fail', () => {
  for(const href of ['https://example.org/soil','http://example.org','/blog/','#soil']) assert.equal(safeLink(href),href);
  for(const href of ['javascript:alert(1)','data:text/html,bad','//evil.example','https://user:pass@example.org',' https://example.org','file:///etc/passwd','https://a.test/\nb']) assert.throws(()=>safeLink(href));
  const body = {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Soil <care>',marks:[{type:'link',attrs:{href:'https://example.org/soil'}}]}]}]};
  assert.match(renderDocument(body), /href="https:\/\/example.org\/soil"/);
  assert.match(renderDocument(body), /Soil &lt;care&gt;/);
  const bad = structuredClone(body); bad.content[0].content[0].marks[0].attrs.href='javascript:alert(1)';
  assert.throws(()=>validateDocument(bad));
  for(const type of ['image','iframe','html','codeBlock']) assert.throws(()=>validateDocument({type:'doc',content:[{type}]}));
});

test('reading time derives from body words with a one-minute minimum',()=>{
  assert.equal(readingMinutes({type:'doc',content:[{type:'paragraph'}]}),1);
  assert.equal(readingMinutes({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:Array(401).fill('a').join(' ')}]}]}),3);
});

test('Tiptap default link and numbering attributes normalise to the portable schema',()=>{
 const raw={type:'doc',content:[{type:'orderedList',attrs:{start:1,type:null},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Guide',marks:[{type:'link',attrs:{href:'https://example.org',target:null,rel:null,class:null,title:null}}]}]}]}]}]};
 const clean=fromEditorDocument(raw);assert.deepEqual(clean.content[0].attrs,{start:1});
 assert.deepEqual(clean.content[0].content[0].content[0].content[0].marks[0].attrs,{href:'https://example.org'});
 assert.match(renderDocument(clean),/<ol><li><p><a href=/);
});

test('journal features one post once and has no public development commentary',()=>{
  const html=blogListing(samplePosts);
  assert.match(html, /<h1[^>]*>Farm Journal<\/h1>/);
  assert.equal((html.match(/data-post-id="sample-soil"/g)||[]).length,1);
  assert.equal((html.match(/data-post-id="sample-season"/g)||[]).length,1);
  assert.match(html,/min read/);
  assert.ok(!/sample|preview|development|Notes from the soil/i.test(html.replace(/<[^>]*>/g,'')));
});

test('articles omit unsupplied authors and sales panels, and suggest only other published posts',()=>{
  const html=blogArticle(samplePosts[0],samplePosts);
  assert.ok(!/article-enquiry|Let’s keep growing|sample-notice|By undefined/.test(html));
  assert.ok(!/class="article-author"/.test(html));
  assert.match(html,/Related articles/);
  const related=html.split('Related articles')[1];
  assert.ok(related.includes('planning-for-seasonal-produce'));
  assert.ok(!related.includes('getting-to-know-your-soil'));
  assert.ok(!related.includes('unpublished-sample'));
  assert.ok(!html.includes('blog-footer-email'));
  assert.match(blogArticle({...samplePosts[0],author:'Supplied Writer'}),/Supplied Writer/);
});

test('legacy sample exports migrate, round-trip and stay review-only across saves',()=>{
  const old={revision:4,homepage:structuredClone(homepageContent),posts:structuredClone(samplePosts)};
  old.posts.forEach(p=>{delete p.reviewOnly;});
  const migrated=migrateSampleDocument(old);
  assert.equal(migrated.revision,4);
  assert.ok(migrated.posts.every(p=>p.reviewOnly===true&&p.body&&!p.blocks));
  validatePosts(migrated.posts);
  assert.deepEqual(migrateSampleDocument(JSON.parse(JSON.stringify(migrated))),migrated);
  assert.equal(saveSampleDraft(migrated,migrated,4).revision,5);
  assert.throws(()=>saveSampleDraft(migrated,migrated,3),/another tab/);
  assert.throws(()=>publicPosts(samplePosts,{production:true}),/review-only/);
});

test('maximum legacy lists remain importable after structured migration',()=>{
 const post={...samplePosts[0],blocks:Array.from({length:40},()=>({type:'list',items:Array(12).fill('a'.repeat(500))}))};
 validatePosts([post]);
 const body=toDocument(post);
 assert.equal(body.content.length,40);
 assert.equal(documentText(body).replace(/ /g,'').length,240000);
});
