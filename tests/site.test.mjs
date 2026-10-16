import test from 'node:test';
import assert from 'node:assert/strict';
import { home } from '../src/pages/home.mjs';
import { company, navigation } from '../src/config/company.mjs';
import { emailButton, escapeHtml } from '../src/components/shared.mjs';
import { pages } from '../src/pages/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

test('the single homepage has metadata, one H1 and section navigation', () => {
  assert.equal(pages.length, 1);
  assert.equal(pages[0].path, 'index.html');
  assert.deepEqual(readdirSync('dist').filter(file => file.endsWith('.html')), ['index.html']);
  assert.equal(readFileSync('dist/index.html', 'utf8').trimEnd(), home().trimEnd(), 'Built homepage matches the saved source');
  const titles = new Set();
  const descriptions = new Set();
  for (const { path, render } of pages) {
    const html = render();
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, path);
    const title = html.match(/<title>(.*?)<\/title>/)[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(!titles.has(title), `Duplicate title: ${path}`);
    assert.ok(!descriptions.has(description), `Duplicate description: ${path}`);
    titles.add(title); descriptions.add(description);
    assert.equal([...html.matchAll(/aria-current="location"/g)].length, 1, path);
    assert.ok(html.includes('href="#home" aria-current="location"'), path);
    for (const [, target] of navigation) {
      assert.ok(target.startsWith('#'));
      assert.ok(html.includes(`id="${target.slice(1)}"`), target);
    }
    assert.ok(!/href="[^\"]*\.html/.test(html), 'No separate page links');
    assert.match(html, /<html lang="en-GB">/);
    assert.match(html, /Skip to main content/);
  }
});

test('all page links, fragments, assets and accessibility references resolve', () => {
  const output = new Map(pages.map(({ path, render }) => [path, render()]));
  for (const [path, html] of output) {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, `Duplicate ID: ${path}`);
    for (const reference of html.matchAll(/aria-(?:controls|labelledby|describedby)="([^"]+)"/g)) {
      for (const id of reference[1].split(' ')) assert.ok(ids.includes(id), `${path}: missing ${id}`);
    }
    for (const match of html.matchAll(/(?:href|src)="([^\"]+)"/g)) {
      const link = match[1].replaceAll('&amp;', '&');
      if (/^(https?:|mailto:)/.test(link)) continue;
      const [file, fragment] = link.split('#');
      const target = file ? file.replace(/^\.\//, '') : path;
      if (output.has(target)) {
        if (fragment) assert.ok(output.get(target).includes(`id="${fragment}"`), `${path}: missing ${link}`);
      } else {
        assert.ok(readFileSync(`dist/${target}`).length, `${path}: missing asset ${link}`);
      }
    }
  }
});

test('all real mail links use the supplied email and each page offers email enquiries', () => {
  assert.equal(company.email, 'ohajiugwochimeziebibi@gmail.com');
  for (const { path, render } of pages) {
    const html = render();
    const links = [...html.matchAll(/href="(mailto:[^"]+)"/g)];
    assert.ok(links.length > 0, path);
    for (const link of links) assert.equal(link[1], `mailto:${company.email}`, path);
    assert.ok(!html.includes('Company email to be supplied'), path);
    assert.ok(!/<form\b|href="tel:|wa\.me|api\.whatsapp|type="password"/i.test(html), path);
  }
});

test('clearing the email never creates a fake address on any page', () => {
  const previous = company.email;
  try {
    company.email = '';
    for (const { path, render } of pages) {
      const html = render();
      assert.ok(!html.includes('mailto:'), path);
      assert.ok(!html.includes('data-email='), path);
      assert.ok(html.includes('href="#contact"'), path);
    }
  } finally { company.email = previous; }
});

test('metadata uses the homepage URL when an approved origin is configured', () => {
  const previous = company.siteUrl;
  try {
    company.siteUrl = 'https://farm.example';
    for (const { path, render } of pages) {
      const url = `https://farm.example/${path === 'index.html' ? '' : path}`;
      const html = render();
      assert.ok(html.includes(`rel="canonical" href="${url}"`));
      assert.ok(html.includes(`property="og:url" content="${url}"`));
      assert.match(html, /noindex, nofollow/);
    }
  } finally { company.siteUrl = previous; }
});

test('the homepage has minimal eyebrows and no visible development or image labels', () => {
  for (const { path, render } of pages) {
    const html = render();
    for (const image of html.matchAll(/<img\b[^>]+>/g)) {
      assert.match(image[0], /alt="[^"]*temporary stock photograph[^\"]*"/i);
      assert.match(image[0], /width="\d+"/);
      assert.match(image[0], /height="\d+"/);
    }
    assert.equal([...html.matchAll(/class="eyebrow/g)].length, path === 'index.html' ? 1 : 0, path);
    assert.ok(!/class="(?:preview-note|image-label|stock-caption)|<figcaption\b/.test(html));
    assert.ok(!html.includes('Website preview'));
    assert.ok(!html.includes('Homepage preview'));
  }
});

test('the original saved homepage content and section balance are restored', () => {
  const html = home();
  const saved = readFileSync('backups/original-homepage-20261015T131833Z.mjs', 'utf8');
  const headings = source => [...source.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map(match => [match[1], match[2]]);
  assert.deepEqual(headings(html), headings(saved), 'Heading sequence matches the recovered implementation');
  assert.deepEqual([...html.matchAll(/<section id="([^"]+)"/g)].map(match => match[1]), ['home', 'products', 'practices', 'about', 'services', 'contact']);
  assert.equal([...html.matchAll(/class="product-card"/g)].length, 3);
  assert.ok(!/scroll-section|section-intro|future-section|purpose-grid|method-grid|learning-section|enquiry-banner/.test(html));
  assert.ok(!html.includes('cold-storage'));
  assert.ok(Buffer.byteLength(html) < 28000, 'Retain the concise original homepage length');
});

function clientHarness({ clipboardFails = false } = {}) {
  const listeners = new Map();
  const makeElement = (id) => ({
    attributes: new Map([['aria-expanded', 'false']]), classes: new Set(), dataset: { email: company.email }, textContent: '',
    addEventListener(type, fn) { listeners.set(`${id}:${type}`, fn); },
    setAttribute(key, value) { this.attributes.set(key, value); },
    getAttribute(key) { return this.attributes.get(key); },
    removeAttribute(key) { this.attributes.delete(key); },
    contains(target) { return target === this; },
    focus() { this.focused = true; }
  });
  const toggle = makeElement('toggle'); const nav = makeElement('nav'); const copy = makeElement('copy'); const status = makeElement('status');
  const links = navigation.map(([, target]) => { const link = makeElement(target); link.setAttribute('href', target); return link; });
  nav.classList = { remove: (c) => nav.classes.delete(c), toggle: (c, add) => add ? nav.classes.add(c) : nav.classes.delete(c) };
  let copied;
  const document = {
    querySelector: s => ({ '.menu-toggle': toggle, '#main-nav': nav, '.copy-email': copy, '.copy-status': status })[s],
    querySelectorAll: selector => selector.startsWith('#main-nav') ? links : [],
    getElementById: id => id === 'locations' ? { closest: () => ({ id: 'contact' }) } : null,
    addEventListener: (type, fn) => listeners.set(`document:${type}`, fn)
  };
  const window = { location: { hash: '' }, addEventListener: (type, fn) => listeners.set(`window:${type}`, fn), matchMedia: () => ({ addEventListener: (type, fn) => listeners.set('breakpoint', fn) }) };
  vm.runInNewContext(readFileSync('src/client.js', 'utf8'), { document, window, navigator: { clipboard: { writeText: async text => { if (clipboardFails) throw new Error('Clipboard blocked'); copied = text; } } } });
  return { listeners, toggle, nav, status, links, window, copied: () => copied };
}

test('mobile menu opens, Escape returns focus, and section links close it', () => {
  const { listeners, toggle, nav } = clientHarness();
  listeners.get('toggle:click')();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(nav.classes.has('is-open'));
  listeners.get('document:keydown')({ key: 'Escape' });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.ok(toggle.focused);
  listeners.get('toggle:click')();
  listeners.get('nav:click')({ target: { closest: () => ({}) } });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

test('section navigation follows hashes and nested anchors without replacing native scrolling', () => {
  const { listeners, links, window } = clientHarness();
  for (const hash of ['#products', '#services', '#practices', '#contact', '#locations', '#home']) {
    window.location.hash = hash;
    listeners.get('window:hashchange')();
    const active = links.filter(link => link.getAttribute('aria-current') === 'location');
    assert.equal(active.length, 1);
    assert.equal(active[0].getAttribute('href'), hash === '#locations' ? '#contact' : hash);
  }
  const script = readFileSync('src/client.js', 'utf8');
  assert.ok(!script.includes('preventDefault'), 'Native fragment scrolling and history stay available');
  const styles = readFileSync('src/styles/main.css', 'utf8');
  assert.match(styles, /scroll-behavior:smooth/);
  assert.match(styles, /prefers-reduced-motion:reduce.*scroll-behavior:auto/);
});

test('copy email uses the configured address and announces successful copy', async () => {
  const harness = clientHarness();
  await harness.listeners.get('copy:click')();
  assert.equal(harness.copied(), company.email);
  assert.equal(harness.status.textContent, 'Email address copied.');
});

test('a blocked clipboard offers manual copying rather than false success', async () => {
  const harness = clientHarness({ clipboardFails: true });
  await harness.listeners.get('copy:click')();
  assert.match(harness.status.textContent, /Select and copy/);
});

test('homepage navigation and section links resolve to unique IDs', () => {
  const html = home();
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const link of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(link[1]), `Missing ${link[1]}`);
  let previousLevel = 0;
  for (const heading of html.matchAll(/<h([1-6])\b/g)) {
    const level = Number(heading[1]);
    assert.ok(level <= previousLevel + 1, `Skipped heading level: H${previousLevel} to H${level}`);
    previousLevel = level;
  }
});
test('empty email cannot create a working mail link or copy action', () => {
  const previous = company.email;
  try {
    company.email = '';
    const html = home();
    assert.ok(!html.includes('mailto:'));
    assert.ok(!html.includes('data-email='));
    assert.match(html, /Company email to be supplied/);
  } finally { company.email = previous; }
});
test('confirmed email enables consistent mail links and copy data', () => {
  const previous = company.email;
  try {
    company.email = 'test@example.invalid';
    const html = home();
    assert.match(html, /href="mailto:test@example.invalid"/);
    assert.match(html, /data-email="test@example.invalid"/);
    assert.ok(!html.includes('Company email to be supplied'));
    assert.match(emailButton(), /mailto:test@example.invalid/);
  } finally { company.email = previous; }
});
test('development preview stays unindexed with no unsupported business data', () => {
  const html = home();
  assert.match(html, /noindex, nofollow/);
  assert.ok(!html.includes('application/ld+json'));
  assert.ok(!/<form\b|type="tel"|href="tel:|wa\.me|shopping.cart/i.test(html));
});
test('content has one H1, descriptive images and separated company locations', () => {
  const html = home();
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  for (const image of html.matchAll(/<img\b[^>]*>/g)) assert.match(image[0], /alt="[^"]+"/);
  assert.ok(html.includes(company.headquarters));
  assert.ok(html.includes(company.farmland));
  assert.match(html, /Skip to main content/);
  assert.match(html, /aria-expanded="false"/);
});
test('company content is escaped before HTML output', () => {
  assert.equal(escapeHtml('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
});
