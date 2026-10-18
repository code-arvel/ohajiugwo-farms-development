import {build} from 'esbuild';
import {mkdir,writeFile,readFile,rm,lstat} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {browserAssetEntries} from '../hosting/assets.mjs';

// Development preparation only: no website/sample articles, env values, fixtures or upload.
export async function buildHostingPreparation({outDir='hosting-output'}={}){
 const destination=path.resolve(outDir),normal=path.resolve('hosting-output');
 if(destination!==normal&&!(path.dirname(destination)===path.resolve(tmpdir())&&path.basename(destination).startsWith('farm-hosting-')))throw new Error('Only designated hosting preparation output is allowed.');
 try{if((await lstat(destination)).isSymbolicLink())throw new Error('Hosting output cannot be a symlink.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const entries=await browserAssetEntries();
 const bundle=await build({stdin:{contents:"import {onRequest} from './functions/[[path]].js'; export default {fetch:(request,env)=>onRequest({request,env})};",resolveDir:process.cwd(),sourcefile:'hosting-entry.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,logLevel:'silent',define:{FARM_BROWSER_ASSETS:JSON.stringify(entries)}});
 const routes=await readFile('hosting/routes.json','utf8');
 await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
 await writeFile(path.join(destination,'_worker.js'),bundle.outputFiles[0].contents);
 await writeFile(path.join(destination,'_routes.json'),routes);
 await writeFile(path.join(destination,'preparation.json'),JSON.stringify({purpose:'stage-2-development-preparation',deploymentApproved:false,publicReleaseIncluded:false,adminEnabledByDefault:false},null,2));
 await writeFile(path.join(destination,'robots.txt'),'User-agent: *\nDisallow: /\n');
 // Logo/font paths referenced by the approved CSS can use Pages static serving.
 for(const [route,encoded] of entries.filter(([route])=>!route.startsWith('/admin/'))){const file=path.join(destination,route.slice(1));await mkdir(path.dirname(file),{recursive:true});await writeFile(file,Buffer.from(encoded,'base64'));}
 return {outDir:destination,workerBytes:bundle.outputFiles[0].contents.byteLength,publicReleaseIncluded:false};
}
if(process.argv[1]?.endsWith('build-hosting.mjs'))console.log(JSON.stringify(await buildHostingPreparation())+'\nLocal preparation only; no deployment or real authentication was enabled.');
