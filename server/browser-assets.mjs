// Exact browser-only files. No environment, source fixtures, editor content or server modules.
export const browserAssetFiles=[
 ['/admin/accept/client.mjs','admin/accept/client.mjs','text/javascript'],
 ['/admin/accept/screen.css','admin/accept/screen.css','text/css'],
 ['/admin/accept/logo.css','src/styles/logo.css','text/css'],
 ['/admin/accept/fonts/lora-variable.ttf','admin/accept/fonts/lora-variable.ttf','font/ttf'],
 ['/admin/accept/fonts/dm-sans-variable.ttf','admin/accept/fonts/dm-sans-variable.ttf','font/ttf'],
 ['/admin/session/client.mjs','admin/session/client.mjs','text/javascript'],
 ['/admin/session/screen.css','admin/session/screen.css','text/css'],
 ['/admin/accounts/client.mjs','admin/accounts/client.mjs','text/javascript'],
 ['/admin/accounts/screen.css','admin/accounts/screen.css','text/css'],
 ['/admin/content/screen.css','admin/content/screen.css','text/css'],
 ['/admin/content/editor.css','local-editor/editor.css','text/css'],
 ['/admin/content/logo.css','src/styles/logo.css','text/css'],
 ['/admin/media/client.mjs','admin/media/client.mjs','text/javascript'],
 ['/admin/media/screen.css','admin/media/screen.css','text/css'],
 ['/admin/media/logo.css','src/styles/logo.css','text/css'],
 ['/admin/content/fonts/lora-variable.ttf','admin/accept/fonts/lora-variable.ttf','font/ttf'],
 ['/admin/content/fonts/dm-sans-variable.ttf','admin/accept/fonts/dm-sans-variable.ttf','font/ttf'],
 ['/images/ohajiugwo-symbol.svg','public/images/ohajiugwo-symbol.svg','image/svg+xml'],
 ['/fonts/manrope-variable.woff2','public/fonts/manrope-variable.woff2','font/woff2'],
 ['/fonts/source-serif-4-variable.woff2','public/fonts/source-serif-4-variable.woff2','font/woff2'],
];
// Replaced only at bundle time with the explicit asset list; never with environment values.
const entries=typeof FARM_BROWSER_ASSETS==='undefined'?[]:FARM_BROWSER_ASSETS;
export const bundledBrowserAssets=new Map(entries.map(([route,encoded,type])=>[route,{body:Uint8Array.from(atob(encoded),char=>char.charCodeAt(0)),type}]));
