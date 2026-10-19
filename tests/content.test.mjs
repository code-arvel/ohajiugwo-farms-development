import test from 'node:test';
import assert from 'node:assert/strict';
import { homepageContent, samplePosts } from '../src/content/seed.mjs';
import { validateHomepage, validatePosts, publicPosts, saveSampleDraft } from '../src/content/schema.mjs';
import { blogListing, blogArticle } from '../src/pages/blog.mjs';
import { home } from '../src/pages/home.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';
import { build, resolveBuildOutput } from '../scripts/build.mjs';
import { mkdtemp, writeFile, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const clone = value => structuredClone(value);

test('fixed homepage fields validate and reject expansion, unsafe email and excessive copy', () => {
  assert.doesNotThrow(() => validateHomepage(homepageContent));
  for (const change of [d => d.products.push(d.products[0]), d => d.company.email = 'javascript:bad', d => d.services[0].description = 'x'.repeat(201), d => d.products[0].layout = 'new-section', d => d.company.hectares = -1]) {
    const data = clone(homepageContent); change(data);
    assert.throws(() => validateHomepage(data));
  }
});

test('public selection fails closed and never exports draft content', () => {
  const posts = publicPosts(samplePosts);
  assert.equal(posts.length, 2);
  assert.ok(posts.every(post => post.status === 'published'));
  const listing = blogListing(samplePosts);
  assert.ok(!listing.includes('PRIVATE_DRAFT_SENTINEL'));
  assert.throws(() => blogArticle(samplePosts.find(post => post.status === 'draft')));
  const broken = clone(samplePosts); broken[0].status = 'Publish';
  assert.throws(() => publicPosts(broken));
});

test('article validation rejects unsafe or duplicate routes, unsupported blocks and invalid dates', () => {
  for (const change of [p => p[0].slug = '../admin', p => p[1].slug = p[0].slug, p => p[0].blocks[0].type = 'html', p => p[0].publishedAt = 'tomorrow', p => p[0].revision = 0, p => p[0].title = '']) {
    const posts = clone(samplePosts); change(posts);
    assert.throws(() => validatePosts(posts));
  }
});

test('rendered articles escape text, use correct shared links and omit the blog footer email', () => {
  const posts = clone(samplePosts); posts[0].blocks[0].text = '<script>alert("x")</script>';
  const html = blogArticle(posts[0]);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert'));
  assert.match(html, /href="\/#products"/);
  assert.match(html, /href="\/blog\/" aria-current="page"/);
  assert.match(html, /href="\/styles.css"/);
  assert.ok(!html.includes('blog-footer-email'));
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.notEqual(html.match(/<title>(.*?)<\/title>/)[1], blogListing([]).match(/<title>(.*?)<\/title>/)[1]);
  assert.match(blogListing([]), /No articles published yet/);
});

test('sample draft saves validate the entire document and reject stale revisions', () => {
  const current = { revision: 1, homepage: clone(homepageContent), posts: clone(samplePosts) };
  const next = clone(current); next.posts[0].title = 'A revised local sample';
  const saved = saveSampleDraft(current, next, 1);
  assert.equal(saved.revision, 2);
  assert.equal(current.posts[0].title, samplePosts[0].title);
  assert.throws(() => saveSampleDraft(saved, next, 1), /changed in another tab/);
  next.homepage.products.pop();
  assert.throws(() => saveSampleDraft(current, next, 1));
});

test('structured company edits consistently update the existing slots without new sections', () => {
  const data = clone(homepageContent);
  Object.assign(data.company, { name: 'LOCAL SAMPLE FARMS LTD', displayName: 'Local Sample Farms Ltd', email: 'sample@example.invalid', hectares: 7, headquarters: 'Local sample headquarters', farmland: 'Local sample farmland', values: ['Sample integrity', 'Sample stewardship', 'Sample community'] });
  const html = home(data);
  assert.match(html, /Local Sample Farms Ltd is a sustainable agricultural enterprise/);
  assert.match(html, /7-hectare farmland at Local sample farmland/);
  assert.ok(!html.includes('land-note'));
  assert.match(html, /7 hectares, cultivated with care/);
  for (const value of data.company.values) assert.ok(html.includes(value));
  assert.ok(!html.includes('ohajiugwochimeziebibi@gmail.com'));
  assert.match(html, /mailto:sample@example.invalid/);
  assert.match(html, /LOCAL SAMPLE FARMS LTD — Home/);
  assert.match(html, /Local Sample Farms Ltd\. All rights reserved/);
});

test('build cleanup only accepts its generated output and allocated temporary build directories', () => {
  assert.equal(resolveBuildOutput('dist'), path.resolve('dist'));
  for (const unsafe of ['.', '..', 'src', 'public', 'docs', 'local-editor', '.git', '/', tmpdir(), 'dist/../src']) assert.throws(() => resolveBuildOutput(unsafe), /generated output/);
  assert.equal(resolveBuildOutput(path.join(tmpdir(), 'ohajiugwo-build-example')), path.join(tmpdir(), 'ohajiugwo-build-example'));
});

test('approved homepage markup and styling remain preserved with the approved story overlay removal', async () => {
  const baseline = readFileSync('tests/fixtures/approved-homepage.mjs', 'utf8');
  const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const shared = asModule(readFileSync('tests/fixtures/approved-shared.mjs', 'utf8').replace("'../config/company.mjs'", `'${new URL('../src/config/company.mjs', import.meta.url).href}'`));
  const layout = asModule(readFileSync('tests/fixtures/approved-page.mjs', 'utf8').replace("'../config/company.mjs'", `'${new URL('../src/config/company.mjs', import.meta.url).href}'`).replace("'../components/shared.mjs'", `'${shared}'`));
  const importable = baseline.replace(/from '(\.\.\/[^']+)'/g, (_, relative) => `from '${relative === '../layouts/page.mjs' ? layout : relative === '../components/shared.mjs' ? shared : new URL(relative, new URL('../src/pages/home.mjs', import.meta.url)).href}'`);
  const approved = await import(`data:text/javascript;base64,${Buffer.from(importable).toString('base64')}`);
  // The original shared header reads today's nav, so this allows precisely the new Blog link.
  // Approved navbar/logo updates, focus styling, information strip and story overlay removal.
  const withoutNavbar=html=>html.replace(/<header class="site-header">[\s\S]*?<\/header>/,'<header class="site-header"></header>').replace('<link rel="stylesheet" href="/logo.css">','').replace('<link rel="stylesheet" href="/navbar.css">','').replace(/(<div class="footer-main">)<a\b[\s\S]*?<\/a>/,'$1<!-- shared logo -->').replace('.site-header{flex-wrap:wrap;position:static}', '.site-header{flex-wrap:wrap}').replace(/<div class="land-note">[\s\S]*?<\/div>/, '').replaceAll('&amp;', '&').replace(/<div class="topline">[\s\S]*?<\/div>/, '<!-- information strip, checked separately -->');
  assert.equal(withoutNavbar(home()),withoutNavbar(approved.home()));
  const baselineCss=readFileSync('tests/fixtures/approved-main.css','utf8');
  assert.equal(createHash('sha256').update(baselineCss).digest('hex'), '8b23b08626ebeb5eab750dbd518c250b9a4ce099f78ee29f80f3e4a8daf43375');
  const css=readFileSync('src/styles/main.css','utf8');
  const focusPatch=/\.home-page section\[id\]\[tabindex="-1"\]:focus\s*\{\s*outline:\s*none;?\s*\}/;
  const stripHover=/\.topline a:hover\s*\{\s*color:\s*#dce6c9;?\s*\}/;
  assert.match(css,focusPatch);
  assert.match(css,stripHover);
  // Compile both CSS versions to ignore formatting only; all other rules remain compared.
  const canonical=value=>transformSync(value,{loader:'css',minify:true}).code.replace(/(--[\w-]+:)([^;}]+)/g,(_,key,val)=>key+val.replace(/\s+/g,'').replaceAll('"', "'"));
  assert.equal(canonical(css.replace(focusPatch,'').replace(stripHover,'')),canonical(baselineCss));
  assert.ok(home().includes('href="/blog/"'));
});

test('static build contains only published article routes and no local editor or draft fixtures', () => {
  assert.ok(existsSync('dist/blog/index.html'));
  for (const post of publicPosts(samplePosts)) assert.ok(existsSync(`dist/blog/${post.slug}/index.html`));
  assert.ok(!existsSync('dist/__editor'));
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
  for (const file of walk('dist').filter(file => /\.(html|js|json)$/.test(file))) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/PRIVATE_DRAFT_SENTINEL|saveSampleDraft|Local sample editor\b/.test(text), file);
  }
});

test('a clean build removes withdrawn routes and never copies prototype assets', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'ohajiugwo-build-'));
  try {
    await mkdir(`${outDir}/blog/withdrawn`, { recursive: true });
    await writeFile(`${outDir}/blog/withdrawn/index.html`, 'Old public content');
    await build({ outDir });
    assert.ok(!existsSync(`${outDir}/blog/withdrawn/index.html`));
    assert.ok(!existsSync(`${outDir}/__editor`));
    assert.match(await readFile(`${outDir}/blog/index.html`, 'utf8'), /Farm Journal/);
  } finally { await rm(outDir, { recursive: true, force: true }); }
});

test('editable company names cannot escape social metadata',()=>{
 const data=clone(homepageContent);data.company.name='"><script>alert(1)</script><meta x="';
 validateHomepage(data);
 assert.ok(!home(data).includes('<script>alert(1)</script>'));
});
