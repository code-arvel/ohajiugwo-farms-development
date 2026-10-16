import { mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pages } from '../src/pages/index.mjs';
import { company } from '../src/config/company.mjs';
import { samplePosts } from '../src/content/seed.mjs';
import { publicPosts } from '../src/content/schema.mjs';

export function resolveBuildOutput(outDir) {
  const destination = path.resolve(outDir);
  const project = path.resolve('.');
  const generated = destination === path.join(project, 'dist');
  const temporary = path.dirname(destination) === path.resolve(tmpdir()) && path.basename(destination).startsWith('ohajiugwo-build-');
  if ((!generated && !temporary) || destination === project || project.startsWith(destination + path.sep)) throw new Error('Build cleanup accepts only generated output: dist or an allocated ohajiugwo-build-* temporary directory.');
  return destination;
}

export async function build({ outDir = 'dist' } = {}) {
  outDir = resolveBuildOutput(outDir);
  if (company.email && !/^[^\s@<>"'&]+@[^\s@<>"'&]+\.[^\s@<>"'&]+$/.test(company.email)) throw new Error('Set a valid company email, or leave it empty.');
  if (company.publicationReady && (!company.email || !company.siteUrl || !company.locationsConfirmed)) throw new Error('Publication requires a confirmed email, public origin and locations.');
  if (company.siteUrl && (new URL(company.siteUrl).protocol !== 'https:' || new URL(company.siteUrl).pathname !== '/')) throw new Error('siteUrl must be a public HTTPS origin without a path.');
  if (company.publicationReady) {
    publicPosts(samplePosts, {production:true});
    throw new Error('Stage 1 is local-only. Launch requires reviewed content and explicit approval.');
  }
  // Render before replacing generated output. No editor/source fixtures are copied to dist.
  const rendered = pages.map(page => ({ path: page.path, html: page.render() }));
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp('public', outDir, { recursive: true });
  for (const page of rendered) {
    await mkdir(path.dirname(`${outDir}/${page.path}`), { recursive: true });
    await writeFile(`${outDir}/${page.path}`, page.html);
  }
  await cp('src/styles/main.css', `${outDir}/styles.css`);
  await cp('src/styles/blog.css', `${outDir}/blog.css`);
  await cp('src/styles/logo.css', `${outDir}/logo.css`);
  await cp('src/styles/navbar.css', `${outDir}/navbar.css`);
  await cp('src/client.js', `${outDir}/client.js`);
  await writeFile(`${outDir}/robots.txt`, company.publicationReady ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
  const css = await readFile(`${outDir}/styles.css`);
  console.log(`Built homepage and ${rendered.length - 1} blog pages → ${outDir}/ (${css.length} bytes base CSS). Local editor excluded.`);
}

if (process.argv[1]?.endsWith('build.mjs')) await build();
