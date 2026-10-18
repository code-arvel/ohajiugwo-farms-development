// Explicit local-only Pages/workerd smoke check. No account login, remote mode or real bindings.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildHostingPreparation} from './build-hosting.mjs';
const version='4.151.1';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function unusedPort(){const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
const workspace=await mkdtemp(path.join(tmpdir(),'farm-runtime-')),artifact=await mkdtemp(path.join(tmpdir(),'farm-hosting-runtime-'));
let child;
async function stop(){if(!child)return;const current=child;child=null;try{process.kill(-current.pid,'SIGTERM');}catch{}await Promise.race([new Promise(resolve=>current.exitCode!==null?resolve():current.once('exit',resolve)),delay(4000)]);try{process.kill(-current.pid,'SIGKILL');}catch{}}
try{
 await buildHostingPreparation({outDir:artifact});await mkdir(path.join(workspace,'config'));await writeFile(path.join(workspace,'empty-npmrc'),'');
 for(const enabled of [false,true]){
  const port=await unusedPort(),origin=`http://127.0.0.1:${port}`;
  const bindings=enabled?{ADMIN_ENABLE_DEVELOPMENT_ROUTES:'confirmed-development-only',ADMIN_ENVIRONMENT:'hosted-development',ADMIN_ORIGIN:origin,SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_PUBLISHABLE_KEY:'MOCK_PUBLIC',SUPABASE_SECRET_KEY:'MOCK_SECRET',ADMIN_SESSION_KEY:'ab'.repeat(32)}:{};
  const args=['exec','--yes',`--package=wrangler@${version}`,'--','wrangler','pages','dev',artifact,'--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--compatibility-date','2025-01-01','--show-interactive-dev-session=false',...Object.entries(bindings).flatMap(([key,value])=>['--binding',key+'='+value])];
  // Explicit environment allowlist: no inherited Cloudflare/Supabase/account credentials.
  const env={PATH:process.env.PATH,HOME:process.env.HOME,CI:'true',XDG_CONFIG_HOME:path.join(workspace,'config'),NPM_CONFIG_USERCONFIG:path.join(workspace,'empty-npmrc'),WRANGLER_SEND_METRICS:'false',CLOUDFLARE_SEND_METRICS:'false',WRANGLER_LOG_PATH:path.join(workspace,'wrangler.log'),WRANGLER_LOG_SANITIZE:'true'};
  child=spawn('npm',args,{cwd:workspace,env,detached:true,stdio:['ignore','pipe','pipe']});let output='',spawnError;child.on('error',error=>spawnError=error);for(const stream of [child.stdout,child.stderr])stream.on('data',value=>{output=(output+value).slice(-8000);});
  let ready=false;
  for(let i=0;i<600;i++){if(spawnError)throw spawnError;if(child.exitCode!==null)throw new Error('Local runtime exited: '+output);try{const response=await fetch(origin+'/admin/login',{redirect:'manual',signal:AbortSignal.timeout(500)});if(response.status===(enabled?200:503)){ready=true;break;}}catch{}await delay(200);}
  if(!ready)throw new Error('Local runtime did not become ready: '+output);
  const get=route=>fetch(origin+route,{redirect:'manual',signal:AbortSignal.timeout(5000)});
  const login=await get('/admin/login');assert.equal(login.status,enabled?200:503);assert.match(login.headers.get('cache-control'),/no-store/);
  for(const route of ['/__editor/','/__review/','/.env.admin','/_worker.js','/_routes.json'])assert.equal((await get(route)).status,404,route);
  assert.equal((await get('/robots.txt')).status,200);assert.equal((await get('/images/ohajiugwo-symbol.svg')).status,200);
  if(enabled){
   const confirmation=await get('/admin/confirm-password');assert.equal(confirmation.status,303);assert.equal(confirmation.headers.get('location'),'/admin/login');
   const asset=await get('/admin/session/client.mjs');assert.equal(asset.status,200);assert.match(await asset.text(),/reauthenticate/);assert.match(asset.headers.get('cache-control'),/no-store/);
   assert.equal((await get('/admin/callback')).status,200);const context=await get('/admin/api/login');assert.equal(context.status,200);assert.match((await context.json()).csrfToken,/^[A-Za-z0-9_-]{43}$/);assert.match(context.headers.get('set-cookie'),/HttpOnly/);
   const denied=await fetch(origin+'/admin/api/reauthenticate',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{"password":"DUMMY_ONLY"}'});assert.equal(denied.status,403);
  }
  await stop();
 }
 console.log(JSON.stringify({localPagesRuntime:'PASS',wrangler:version,defaultClosed:true,dummyDevelopmentComposition:true,webCryptoCsrfCookie:true,privateRoutesAndAssets:true,pagesStaticDispatch:true,remoteBindings:false,deploymentPerformed:false,pending:'Real HTTPS/cookies/provider/DB/concurrency and hosted Pages verification remain separate.'},null,2));
}finally{await stop();await rm(workspace,{recursive:true,force:true});await rm(artifact,{recursive:true,force:true});}
