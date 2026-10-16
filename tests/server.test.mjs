import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestHandler } from '../scripts/serve.mjs';

async function request(url, { production = false, method = 'GET', headers = {} } = {}) {
  const response = { status: 0, headers: {}, body: '', writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this; }, end(body = '') { this.body = String(body); } };
  await createRequestHandler({ production })({ url, method, headers: { host: 'localhost:4321', ...headers } }, response);
  return response;
}

test('directory blog routes and public assets are served read-only with correct types', async () => {
  for (const url of ['/blog/', '/blog/getting-to-know-your-soil/']) {
    const response = await request(url, { production: true });
    assert.equal(response.status, 200); assert.match(response.headers['Content-Type'], /text\/html/);
    assert.ok(!response.body.includes('PRIVATE_DRAFT_SENTINEL'));
  }
  assert.equal((await request('/blog/unpublished-sample/', { production: true })).status, 404);
  assert.equal((await request('/blog/', { method: 'POST' })).status, 405);
  assert.equal((await request('/src/content/seed.mjs', { production: true })).status, 404);
});

test('prototype is available only as same-origin local dev assets, never through preview', async () => {
  const local = await request('/__editor/');
  assert.equal(local.status, 200);
  assert.match(local.body, /No authentication/);
  assert.equal(local.headers['Cache-Control'], 'private, no-store');
  for (const route of ['/__editor/', '/__editor/editor.js', '/__editor/seed.mjs', '/__editor/schema.mjs', '/__editor/company.mjs', '/__editor/article.mjs']) {
    assert.equal((await request(route)).status, 200, route);
    assert.equal((await request(route, { production: true })).status, 404, route);
  }
  assert.equal((await request('/__editor/', { headers: { host: 'evil.example' } })).status, 403);
  assert.equal((await request('/__editor/', { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/__editor/', { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await request('/__editor/editor.js', { method: 'POST' })).status, 405);
  assert.equal((await request('/__editor/../../src/content/seed.mjs')).status, 404);
  const seed = await request('/__editor/seed.mjs');
  assert.match(seed.body, /from '\.\/company.mjs'/);
  assert.ok(!local.body.includes('type="password"'));
});

test('long article review is rendered only in development and never emitted as a public file', async () => {
 const local=await request('/__review/contents/');
 assert.equal(local.status,200);
 assert.match(local.body,/Understanding soil and planning a growing record/);
 assert.match(local.body,/article-toc-desktop/);
 assert.equal(local.headers['X-Robots-Tag'],'noindex, nofollow');
 assert.equal(local.headers['Cache-Control'],'private, no-store');
 assert.equal((await request('/__review/contents/',{production:true})).status,404);
 assert.equal((await request('/__review/unknown/')).status,404);
 assert.equal((await request('/__review/contents/',{headers:{origin:'https://evil.example'}})).status,403);
 const {existsSync}=await import('node:fs');
 assert.ok(!existsSync('dist/__review/contents/index.html'));
 assert.ok(!existsSync('public/__contents-review.html'));
});
