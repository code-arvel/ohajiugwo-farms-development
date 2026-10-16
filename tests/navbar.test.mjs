import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {header} from '../src/components/shared.mjs';
import {home} from '../src/pages/home.mjs';
import {blogListing,blogArticle} from '../src/pages/blog.mjs';
import {samplePosts} from '../src/content/seed.mjs';

test('public navbar uses supplied symbol and exact logo lettering on every page',()=>{
 for(const html of [home(),blogListing(samplePosts),blogArticle(samplePosts[0])]) {
  assert.match(html,/class="brand-name">Ohajiugwo<\/span>/);
  assert.match(html,/class="brand-description">Organic Farms LTD<\/span>/);
  assert.match(html,/src="\/images\/ohajiugwo-symbol.svg"/);
  assert.match(html,/href="\/navbar.css"/);
  assert.match(html,/<\/header><main/,'Sticky navbar must not be trapped in a short header wrapper.');
  assert.ok(html.includes('.site-header{flex-wrap:wrap;position:static}'),'Expanded no-JS mobile fallback must not cover anchors.');
 }
 assert.match(header(true),/href="\/#about"/);
 const svg=readFileSync('public/images/ohajiugwo-symbol.svg','utf8');
 assert.equal(createHash('sha256').update(svg).digest('hex'),'dc0620a14d4467f0116c09eb3532d12b8a0094c2da6f7acfeb4cadd2ca5c3219');
 assert.match(svg,/viewBox="0 0 234 211"/);assert.match(svg,/stop-color="#e5ad3c"/);
});

test('navbar typography and scrolling styles are separate from page typography',()=>{
 const css=readFileSync('src/styles/navbar.css','utf8')+readFileSync('src/styles/logo.css','utf8');
 assert.match(css,/font-weight:\s*600/);
 assert.match(css,/position:sticky;top:0/);
 assert.match(css,/--public-nav-height/);
 assert.match(css,/\.site-header a:focus-visible/);
 assert.match(css,/\.farm-logo \.brand-name/);
 assert.ok(!/--heading:|--body:/.test(css));
 for(const file of ['manrope-variable.ttf','source-serif-4-variable.ttf','manrope-variable.woff2','source-serif-4-variable.woff2','Manrope-OFL.txt','Source-Serif-4-OFL.txt'])assert.ok(existsSync('public/fonts/'+file),file);
});

 test('approved location link and lighter navigation hover remain intact',()=>{
  const html=header();
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=5\.463145145355659%2C7\.5058460155980935"/);
  assert.match(html, /target="_blank"\s+rel="noopener noreferrer"/);
  assert.match(html, /Rooted in Abia\. Growing with purpose\./);
  assert.match(html, /Okwu Autonomous Community, Nigeria/);
  const css=readFileSync('src/styles/navbar.css','utf8');
  assert.match(css,/\.site-header #main-nav>a:hover\s*\{color:\s*#6b713d;?\}/);
 });
