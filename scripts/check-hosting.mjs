import {build} from 'esbuild';
import {browserAssetEntries} from '../hosting/assets.mjs';
const result=await build({entryPoints:['functions/[[path]].js'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,logLevel:'silent',define:{FARM_BROWSER_ASSETS:JSON.stringify(await browserAssetEntries())}});
if(!result.outputFiles.length)throw new Error('No function compiled.');
console.log('Composed Pages application and exact browser assets compile without deployment. Routes stay disabled by default. Node integration is not Wrangler/hosted HTTPS verification.');
