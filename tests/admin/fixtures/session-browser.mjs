// Loopback-only disposable browser fixtures. No hosted config, transport, identities or mail.
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {sessionFixture} from './session-http.mjs';
import {reauthFixture} from './reauthentication.mjs';
import {createSessionBrowserHandler} from '../../../server/auth/session-screen.mjs';
import {AuthError} from '../../../server/auth/sessions.mjs';
import {privateHeaders} from '../../../server/security.mjs';
import {onRequest} from '../../../functions/[[path]].js';

export async function createSessionFixtureApplication({origin,composed=false,reauthentication=false}){
 const url=new URL(origin);if(url.origin!==origin||url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Loopback fixture origin required.');
 const h=reauthentication?reauthFixture({origin}):sessionFixture({origin}),signIn=h.provider.signIn;
 h.provider.signIn=async(email,password)=>{if(email!=='owner@example.test'||password!=='DummyFarmPass123!')throw new AuthError('MOCK_INVALID_PASSWORD',400);return signIn(email,password);};
 const files=[['/admin/session/client.mjs','admin/session/client.mjs','text/javascript'],['/admin/session/screen.css','admin/session/screen.css','text/css'],['/admin/accept/screen.css','admin/accept/screen.css','text/css'],['/admin/accept/logo.css','src/styles/logo.css','text/css'],['/images/ohajiugwo-symbol.svg','public/images/ohajiugwo-symbol.svg','image/svg+xml'],['/fonts/manrope-variable.woff2','public/fonts/manrope-variable.woff2','font/woff2'],['/fonts/source-serif-4-variable.woff2','public/fonts/source-serif-4-variable.woff2','font/woff2'],['/admin/accept/fonts/lora-variable.ttf','admin/accept/fonts/lora-variable.ttf','font/ttf'],['/admin/accept/fonts/dm-sans-variable.ttf','admin/accept/fonts/dm-sans-variable.ttf','font/ttf']];
 const assets=new Map(await Promise.all(files.map(async([route,file,type])=>[route,{body:await readFile(file),type}])));
 const direct=createSessionBrowserHandler(h.config,{service:h.service,assets,localFixture:true,getClientIp:()=> '127.0.0.1'});
 const env={ADMIN_ENABLE_DEVELOPMENT_ROUTES:'confirmed-development-only',ADMIN_ENVIRONMENT:'hosted-development',ADMIN_ORIGIN:origin,SUPABASE_PROJECT_REF:h.config.projectRef,SUPABASE_URL:h.config.supabaseUrl,SUPABASE_PUBLISHABLE_KEY:h.config.publishableKey,SUPABASE_SECRET_KEY:h.config.secretKey,ADMIN_SESSION_KEY:h.config.sessionKey};
 const browser=composed?request=>onRequest({request,env},{auth:h.service,assets,getClientIp:()=> '127.0.0.1'}):direct;
 const handler=request=>{
  if(request.url===origin+'/__session_fixtures/'&&request.method==='GET'&&request.headers.get('sec-fetch-site')!=='cross-site')return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local session fixtures</title><h1>Local mock sign-in</h1><p>No real accounts or email. Use only these dummy credentials:</p><p>owner@example.test / DummyFarmPass123!</p><a href="/admin/login">Open sign-in</a><p>Restart the fixture server for fresh state. Protected page is session confirmation/sign-out only; editing is unavailable.</p></html>',{headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8'}});
  return browser(request);
 };
 async function nodeHandler(req,res){try{
  if(req.headers.host!==url.host){res.writeHead(403).end('Local fixture host rejected.');return;}
  const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
  const response=await handler(request),headers=Object.fromEntries(response.headers);if(response.headers.getSetCookie().length)headers['set-cookie']=response.headers.getSetCookie();res.writeHead(response.status,headers);res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(503,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('Local fixture unavailable.');}}
 return {h,handler,nodeHandler};
}
