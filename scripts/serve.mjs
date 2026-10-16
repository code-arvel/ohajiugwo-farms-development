import { logo } from '../src/components/logo.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { build } from './build.mjs';
import { pathToFileURL } from 'node:url';

const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.avif':'image/avif', '.woff2':'font/woff2' };
const editorFiles = new Map([
  ['/__editor/', 'local-editor/index.html'], ['/__editor/editor.js', 'local-editor/generated/editor.js'],
  ['/__editor/editor.css', 'local-editor/editor.css'], ['/__editor/seed.mjs', 'src/content/seed.mjs'],
  ['/__editor/schema.mjs', 'src/content/schema.mjs'], ['/__editor/company.mjs', 'src/config/company.mjs'], ['/__editor/article.mjs', 'src/content/article.mjs']
]);
let building;
const rebuild = () => building ||= build().finally(() => { building = undefined; });

export function createRequestHandler({ production = false, root = path.resolve('dist') } = {}) {
  return async (req, res) => {
    try {
      const host = new URL(`http://${req.headers.host || ''}`);
      if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) { res.writeHead(403).end('Local preview only.'); return; }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end('Read-only local preview.'); return; }
      const pathname = decodeURIComponent(new URL(req.url, host).pathname);
      if (pathname.startsWith('/__review/')) {
        if (production || pathname !== '/__review/contents/') { res.writeHead(404).end('Not found'); return; }
        if ((req.headers.origin && req.headers.origin !== host.origin) || req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403).end('Local same-origin access only.'); return; }
        // Render on demand, never write the disposable fixture into public/ or dist/.
        const [{ blogArticle }, { longArticle }] = await Promise.all([import('../src/pages/blog.mjs'), import('../tests/fixtures/long-article.mjs')]);
        const body = blogArticle(longArticle);
        res.writeHead(200, { 'Content-Type': types['.html'], 'Cache-Control':'private, no-store', 'X-Robots-Tag':'noindex, nofollow', 'X-Content-Type-Options':'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : body); return;
      }
      if (pathname.startsWith('/__editor')) {
        if (production || !editorFiles.has(pathname)) { res.writeHead(404).end('Not found'); return; }
        if ((req.headers.origin && req.headers.origin !== host.origin) || req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403).end('Local same-origin access only.'); return; }
        let body = await readFile(editorFiles.get(pathname), 'utf8');
        if (pathname === '/__editor/') body = body.replace('<!-- SHARED_LOGO -->', logo({href:'/',compact:true,className:'editor-brand'}));
        if (pathname === '/__editor/seed.mjs') body = body.replace('../config/company.mjs', './company.mjs');
        res.writeHead(200, { 'Content-Type': types[path.extname(editorFiles.get(pathname))], 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; base-uri 'none'; object-src 'none'; frame-ancestors 'none'" });
        res.end(req.method === 'HEAD' ? undefined : body); return;
      }
      const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const file = path.resolve(root, `.${relative}`);
      if (!file.startsWith(`${root}${path.sep}`)) { res.writeHead(403).end('Forbidden'); return; }
      if (!production && relative.endsWith('.html')) await rebuild();
      if (!(await stat(file)).isFile()) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch { res.writeHead(404).end('Not found'); }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const production = process.argv.includes('--production');
  const portIndex = process.argv.indexOf('--port');
  const port = Number(process.env.PORT || (portIndex >= 0 ? process.argv[portIndex + 1] : 4321));
  if (!production) await build();
  createServer(createRequestHandler({ production })).on('error', error => {
    console.error(`Local preview unavailable: ${error.message}. Run npm run dev in your own terminal to review directory routes and the local editor.`);
    process.exitCode = 1;
  }).listen(port, '127.0.0.1', () => console.log(`Farm preview: http://localhost:${port}${production ? '' : '\nLocal sample editor (no authentication): /__editor/'}`));
}
