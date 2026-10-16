import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('local-editor/generated', {recursive:true});
await build({entryPoints:['local-editor/editor.mjs'],bundle:true,format:'esm',platform:'browser',target:['es2022'],outfile:'local-editor/generated/editor.js',minify:true,legalComments:'eof'});
console.log('Bundled free Tiptap editor locally; excluded from public dist.');
