// Test-only application. No hosted configuration/transport is imported and no .env file is loaded.
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {fixture} from './first-admin.mjs';
import {createFirstAdminService,FirstAdminError} from '../../../server/auth/first-admin.mjs';
import {createFirstAdminBrowserHandler} from '../../../server/auth/first-admin-screen.mjs';
import {privateHeaders} from '../../../server/security.mjs';

export async function createAcceptanceFixtureApplication({origin}){
 const url=new URL(origin);
 if(url.origin!==origin||url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Loopback fixture origin required.');
 const files=[['/admin/accept/client.mjs','admin/accept/client.mjs','text/javascript'],['/admin/accept/screen.css','admin/accept/screen.css','text/css'],['/admin/accept/logo.css','src/styles/logo.css','text/css'],['/images/ohajiugwo-symbol.svg','public/images/ohajiugwo-symbol.svg','image/svg+xml'],['/fonts/manrope-variable.woff2','public/fonts/manrope-variable.woff2','font/woff2'],['/fonts/source-serif-4-variable.woff2','public/fonts/source-serif-4-variable.woff2','font/woff2']];
 files.push(['/admin/accept/fonts/lora-variable.ttf','admin/accept/fonts/lora-variable.ttf','font/ttf'],['/admin/accept/fonts/dm-sans-variable.ttf','admin/accept/fonts/dm-sans-variable.ttf','font/ttf']);
 const assets=new Map(await Promise.all(files.map(async([route,file,type])=>[route,{body:await readFile(file),type}])));
 const scenarios=new Map(),byId=new Map();
 for(const name of ['valid','expired','cancelled','used','retry']){
  const h=fixture(),config={...h.config,origin},service=createFirstAdminService(config,{provider:h.provider,rpc:h.rpc,now:h.clock});
  const pending=await service.prepare('owner@example.test');await service.issue(pending.id);const input=await h.inputs();
  if(name==='expired')h.advance(86400001);
  if(name==='cancelled')await service.cancel(input.id);
  if(name==='used')await service.accept(input);
  if(name==='retry'){const signIn=h.provider.signIn;let first=true;h.provider.signIn=async(...args)=>{if(first){first=false;throw new Error('PRIVATE MOCK TRANSIENT');}return signIn(...args);};}
  const scenario={h,service,input,url:origin+'/admin/callback#'+new URLSearchParams({id:input.id,nonce:input.nonce,token_hash:input.tokenHash})};
  scenarios.set(name,scenario);byId.set(input.id,scenario);
 }
 const config={...fixture().config,origin};
 const browser=createFirstAdminBrowserHandler(config,{service:{accept:input=>{const scenario=byId.get(input.id);if(!scenario)throw new FirstAdminError();return scenario.service.accept(input);}},assets,localFixture:true,getClientIp:()=> '127.0.0.1'});
 async function handler(request){
  const requestUrl=new URL(request.url);
  if(requestUrl.origin!==origin||(request.headers.get('origin')&&request.headers.get('origin')!==origin)||request.headers.get('sec-fetch-site')==='cross-site')return new Response('Local same-origin fixtures only.',{status:403,headers:privateHeaders});
  if(requestUrl.pathname==='/__fixtures/'&&request.method==='GET'&&!requestUrl.search){
   const list=[...scenarios].map(([name,scenario])=>`<li><a href="${scenario.url}">${name}</a></li>`).join('');
   return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local acceptance fixtures</title><h1>Local acceptance fixtures</h1><p>Disposable mock links only. No real account or email. Restart the fixture server to reset.</p><ul>${list}</ul><p>Use any fixture password of 12 or more characters (maximum 72 UTF-8 bytes). Never use a real password.</p></html>`,{headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8'}});
  }
  return browser(request);
 }
 async function nodeHandler(req,res){
  try{
   if(req.headers.host!==url.host){res.writeHead(403).end('Local fixture host rejected.');return;}
   const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
   const response=await handler(request),headers=Object.fromEntries(response.headers);
   const cookies=response.headers.getSetCookie();if(cookies.length)headers['set-cookie']=cookies;
   res.writeHead(response.status,headers);res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(503,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('Local fixture request unavailable.');}
 }
 return {scenarios,handler,nodeHandler};
}
