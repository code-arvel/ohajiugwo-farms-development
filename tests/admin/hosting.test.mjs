import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
import {buildHostingPreparation} from '../../scripts/build-hosting.mjs';
import {handleAdminRequest} from '../../server/handler.mjs';
test('unconfigured administrator routes are unavailable, private and cannot expose prototype or setup endpoints',async()=>{
 for(const path of ['/admin','/admin/','/admin/api/login','/admin/setup','/__editor/','/__review/contents/']){
  const response=await handleAdminRequest(new Request('http://127.0.0.1:4322'+path),{});
  assert.equal(response.status,path.startsWith('/admin')?503:404);
  assert.match(response.headers.get('cache-control'),/no-store/);
  assert.ok(!(await response.text()).includes('secret'));
 }
});
test('hosting configuration routes private areas through functions without any automatic deployment',()=>{
 const config=readFileSync('wrangler.toml','utf8');assert.match(config,/pages_build_output_dir = "hosting-output"/);assert.ok(!/secret|token|account_id/.test(config.replace(/^#.*$/gm,'')));
 const routes=JSON.parse(readFileSync('hosting/routes.json','utf8'));
 for(const route of ['/admin','/admin/*','/__editor','/__editor/*','/__review','/__review/*','/_worker.js','/_routes.json'])assert.ok(routes.include.includes(route));
 assert.ok(!routes.include.includes('/*'));
});
test('hosting preparation packages the approved public preview and composed admin worker without fixtures or secrets',async()=>{
 const outDir=await mkdtemp(path.join(tmpdir(),'farm-hosting-'));try{
  await buildHostingPreparation({outDir});const files=await readdir(outDir);assert.ok(files.includes('_worker.js'));assert.ok(files.includes('_routes.json'));assert.ok(files.includes('index.html'));assert.ok(files.includes('404.html'));assert.ok(files.includes('blog'));assert.ok(!files.includes('admin'));assert.ok(!files.includes('__editor'));assert.ok(!files.includes('.env.admin'));
  const notFound=await readFile(path.join(outDir,'404.html'),'utf8');assert.match(notFound,/<meta name="robots" content="noindex, nofollow">/);assert.match(notFound,/Return to the home page/);
  assert.match(await readFile(path.join(outDir,'robots.txt'),'utf8'),/Disallow:\s*\//);
  assert.deepEqual(JSON.parse(await readFile(path.join(outDir,'preparation.json'),'utf8')),{purpose:'stage-2-development-preparation',deploymentApproved:false,publicPreviewIncluded:true,publicReleaseIncluded:false,adminEnabledByDefault:false});
  const {default:worker}=await import('data:text/javascript;base64,'+(await readFile(path.join(outDir,'_worker.js'))).toString('base64'));
  const origin='http://127.0.0.1:4322',vars={ADMIN_ENABLE_DEVELOPMENT_ROUTES:'confirmed-development-only',ADMIN_ENVIRONMENT:'hosted-development',ADMIN_ORIGIN:origin,SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_PUBLISHABLE_KEY:'MOCK_PUBLIC',SUPABASE_SECRET_KEY:'MOCK_SECRET',ADMIN_SESSION_KEY:'ab'.repeat(32)};
  assert.equal((await worker.fetch(new Request(origin+'/admin/login'),{})).status,503);
  assert.equal((await worker.fetch(new Request(origin+'/admin/login'),vars)).status,200);
  const asset=await worker.fetch(new Request(origin+'/admin/session/client.mjs'),vars);assert.equal(asset.status,200);assert.match(asset.headers.get('cache-control'),/no-store/);assert.match(await asset.text(),/mountSession/);
  assert.equal((await worker.fetch(new Request(origin+'/admin/'),vars)).status,303);assert.equal((await worker.fetch(new Request(origin+'/admin/setup'),vars)).status,404);assert.equal((await worker.fetch(new Request(origin+'/_worker.js'),vars)).status,404);
 }finally{await rm(outDir,{recursive:true,force:true});}
});
