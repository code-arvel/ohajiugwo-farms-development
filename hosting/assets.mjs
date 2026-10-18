import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {browserAssetFiles} from '../server/browser-assets.mjs';
export async function browserAssetEntries(){const entries=[];for(const [route,file,type] of browserAssetFiles)entries.push([route,(await readFile(file)).toString('base64'),type]);const bundle=await build({entryPoints:['admin/content/client-entry.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,logLevel:'silent'});entries.push(['/admin/content/client.mjs',Buffer.from(bundle.outputFiles[0].contents).toString('base64'),'text/javascript']);return entries;}
export function decodeAssets(entries){return new Map(entries.map(([route,encoded,type])=>[route,{body:Buffer.from(encoded,'base64'),type}]));}
