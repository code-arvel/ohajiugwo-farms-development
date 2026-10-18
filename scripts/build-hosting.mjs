import {build} from 'esbuild';
import {mkdir,writeFile,readFile,rm,lstat,cp} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {browserAssetEntries} from '../hosting/assets.mjs';
import {build as buildPublicPreview} from './build.mjs';

// Development preview: include the existing unindexed website/blog preview and private admin worker, never env values or fixtures.
export async function buildHostingPreparation({outDir='hosting-output'}={}){
 const destination=path.resolve(outDir),normal=path.resolve('hosting-output');
 if(destination!==normal&&!(path.dirname(destination)===path.resolve(tmpdir())&&path.basename(destination).startsWith('farm-hosting-')))throw new Error('Only designated hosting preparation output is allowed.');
 try{if((await lstat(destination)).isSymbolicLink())throw new Error('Hosting output cannot be a symlink.');}catch(error){if(error.code!=='ENOENT')throw error;}
 await buildPublicPreview();
 const entries=await browserAssetEntries();
 const bundle=await build({stdin:{contents:"import {onRequest} from './functions/[[path]].js'; export default {fetch:(request,env)=>onRequest({request,env})};",resolveDir:process.cwd(),sourcefile:'hosting-entry.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,logLevel:'silent',define:{FARM_BROWSER_ASSETS:JSON.stringify(entries)}});
 const routes=await readFile('hosting/routes.json','utf8');
 await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});await cp('dist',destination,{recursive:true});
 await writeFile(path.join(destination,'404.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Page not found · Ohajiugwo Organic Farms</title><link rel="icon" href="/images/ohajiugwo-symbol.svg"><style>body{margin:0;background:#f7f3e9;color:#233d2e;font:1rem/1.6 system-ui,sans-serif}main{box-sizing:border-box;max-width:42rem;margin:clamp(2rem,12vh,8rem) auto;padding:2rem 1.25rem}img{width:3rem;height:3rem}h1{font-family:Georgia,serif;font-size:clamp(2rem,7vw,3.5rem);line-height:1.08}a{color:#244d36;font-weight:700;text-underline-offset:.2em}</style></head><body><main><a href="/" aria-label="Ohajiugwo Organic Farms home"><img src="/images/ohajiugwo-symbol.svg" alt=""></a><p>That page isn’t here.</p><h1>We couldn’t find this page.</h1><p>Try the home page to find what you need.</p><a href="/">Return to the home page</a></main></body></html>\n');
 await writeFile(path.join(destination,'_worker.js'),bundle.outputFiles[0].contents);
 await writeFile(path.join(destination,'_routes.json'),routes);
 await writeFile(path.join(destination,'preparation.json'),JSON.stringify({purpose:'stage-2-development-preparation',deploymentApproved:false,publicPreviewIncluded:true,publicReleaseIncluded:false,adminEnabledByDefault:false},null,2));
 // Logo/font paths referenced by the approved CSS can use Pages static serving.
 for(const [route,encoded] of entries.filter(([route])=>!route.startsWith('/admin/'))){const file=path.join(destination,route.slice(1));await mkdir(path.dirname(file),{recursive:true});await writeFile(file,Buffer.from(encoded,'base64'));}
 return {outDir:destination,workerBytes:bundle.outputFiles[0].contents.byteLength,publicReleaseIncluded:false};
}
if(process.argv[1]?.endsWith('build-hosting.mjs'))console.log(JSON.stringify(await buildHostingPreparation())+'\nLocal preparation only; no deployment or real authentication was enabled.');
