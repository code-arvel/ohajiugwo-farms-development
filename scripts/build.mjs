import { mkdir, cp, writeFile, readFile, unlink } from 'node:fs/promises';
import { pages } from '../src/pages/index.mjs';
import { company } from '../src/config/company.mjs';

export async function build() {
  if (company.email && !/^[^\s@<>"'&]+@[^\s@<>"'&]+\.[^\s@<>"'&]+$/.test(company.email)) throw new Error('Set a valid company email, or leave it empty.');
  if (company.publicationReady && (!company.email || !company.siteUrl || !company.locationsConfirmed)) throw new Error('Publication requires a confirmed email, public origin and locations.');
  if (company.siteUrl && (new URL(company.siteUrl).protocol !== 'https:' || new URL(company.siteUrl).pathname !== '/')) throw new Error('siteUrl must be a public HTTPS origin without a path.');
  await mkdir('dist', { recursive: true });
  // Remove only the five retired page outputs, including after rebuilding an older checkout.
  for (const filename of ['about.html', 'products.html', 'services-training.html', 'sustainable-farming.html', 'contact.html', 'pages.css']) {
    await unlink(`dist/${filename}`).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  await cp('public', 'dist', { recursive: true });
  for (const page of pages) await writeFile(`dist/${page.path}`, page.render());
  await cp('src/styles/main.css', 'dist/styles.css');
  await cp('src/client.js', 'dist/client.js');
  await writeFile('dist/robots.txt', company.publicationReady ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
  const css = await readFile('dist/styles.css');
  console.log(`Built single scrolling homepage → dist/index.html (${css.length} bytes base CSS; no runtime dependencies).`);
}

if (process.argv[1]?.endsWith('build.mjs')) await build();
