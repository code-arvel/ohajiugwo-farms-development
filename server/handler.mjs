import {privateHeaders} from './security.mjs';
import {loadAdminConfig} from './config.mjs';
import {createAdminApplication} from './application.mjs';
import {bundledBrowserAssets} from './browser-assets.mjs';
// Default stays closed. Explicit development composition is not live/bootstrap approval.
export async function handleAdminRequest(request,env={},dependencies={}){
 const path=new URL(request.url).pathname;
 const asset=(dependencies.assets||bundledBrowserAssets).has(path);
 const enabled=env.ADMIN_ENVIRONMENT==='hosted-production'?env.ADMIN_ENABLE_PRODUCTION_ROUTES==='confirmed-production':env.ADMIN_ENVIRONMENT==='hosted-development'&&env.ADMIN_ENABLE_DEVELOPMENT_ROUTES==='confirmed-development-only';
 if(enabled&&(path==='/admin'||path.startsWith('/admin/')||asset)){
  try{return await createAdminApplication(loadAdminConfig(env),dependencies)(request);}catch{}
 }
 if(path==='/admin'||path.startsWith('/admin/'))return new Response('Administration is not available yet.',{status:503,headers:{...privateHeaders,'Content-Type':'text/plain; charset=utf-8'}});
 return new Response('Not found',{status:404,headers:privateHeaders});
}
