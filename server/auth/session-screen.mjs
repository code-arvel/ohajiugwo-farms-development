import {logo} from '../../src/components/logo.mjs';
import {escapeHtml as e} from '../../src/utils/html.mjs';
import {newToken,privateHeaders} from '../security.mjs';
import {AuthError} from './sessions.mjs';
import {createSessionHandler} from './session-http.mjs';

function page(mode,actor,nonce,localFixture,accountsEnabled=false){
 const login=mode==='login',confirm=mode==='reauthenticate';
 return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${login?'Sign in':confirm?'Confirm password':'Administration'} | Ohajiugwo Organic Farms</title>
${login?'':`<meta name="admin-csrf-token" content="${e(actor.csrfToken)}"><meta name="admin-user-id" content="${e(actor.user.id||'')}">`}
<link rel="stylesheet" href="/admin/accept/logo.css"><link rel="stylesheet" href="/admin/session/screen.css">
<script nonce="${nonce}">(function(){
let closed=false;
window.addEventListener('pagehide',()=>{
 closed=true;
 for(const id of ['email','password']){const input=document.getElementById(id);if(input)input.value='';}
 const password=document.getElementById('password');if(password)password.type='password';
 const show=document.getElementById('show-passwords');if(show)show.checked=false;
 const identity=document.getElementById('session-identity');if(identity)identity.textContent='';
 const form=document.getElementById('session-form');if(form)form.hidden=true;
 document.querySelector('meta[name="admin-csrf-token"]')?.remove();
 document.querySelector('meta[name="admin-user-id"]')?.remove();
 const reload=document.getElementById('session-reload');if(reload)reload.hidden=true;
},{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
const ready=()=>document.readyState==='loading'?new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true})):Promise.resolve();
import('/admin/session/client.mjs').then(async module=>{await ready();if(!closed)module.mountSession({mode:'${mode}'});}).catch(async()=>{if(closed)return;await ready();if(closed)return;const box=document.getElementById('session-message');box.hidden=false;box.dataset.state='error';box.setAttribute('role','alert');document.getElementById('session-message-title').textContent='This page could not load';document.getElementById('session-message-copy').textContent='Reload this page when your connection is available.';box.focus();});
})();</script></head>
<body class="accept-page"><a class="skip-link" href="#session-main">Skip to ${login?'sign in':confirm?'password confirmation':'session'}</a><main id="session-main" class="accept-main"><header class="accept-header">${logo()}</header><section class="accept-content" aria-labelledby="session-heading">
${localFixture?'<p class="fixture-notice">Local test · No real account is created and no email is sent.</p>':''}
<h1 id="session-heading" tabindex="-1">${login?'Sign in.':confirm?'Confirm your password.':'You’re signed in.'}</h1>
${login?'<p id="session-intro" class="accept-intro">Use your administrator email and password.</p>':`<p id="session-identity" class="session-identity">${e(actor.user.email)}</p><p id="session-intro" class="accept-intro">${confirm?'Enter your current password to confirm your identity. You’ll choose what to do next.':'Administration is being prepared. You can sign out below.'}</p>`}
<div id="session-message" role="status" aria-live="polite" aria-atomic="true" tabindex="-1" hidden><div><strong id="session-message-title"></strong><p id="session-message-copy"></p></div></div>
<noscript><p>JavaScript is needed to ${login?'sign in':confirm?'confirm your password':'sign out'}. Enable it and reload this page.</p></noscript>
<form id="session-form" method="post" action="${login?'/admin/api/login':confirm?'/admin/api/reauthenticate':'/admin/api/logout'}" novalidate>
${login?'<div class="accept-field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required><p id="email-error" class="field-error" hidden></p></div><div class="accept-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required><p id="password-error" class="field-error" hidden></p></div><label class="show-passwords"><input id="show-passwords" type="checkbox">Show password</label>':confirm?'<div class="accept-field"><label for="password">Current password</label><input id="password" name="password" type="password" autocomplete="current-password" required><p id="password-error" class="field-error" hidden></p></div><label class="show-passwords"><input id="show-passwords" type="checkbox">Show password</label>':''}
<button id="session-submit" class="${login||confirm?'':'session-logout'}" type="submit" disabled>${login?'Sign in':confirm?'Confirm password':'Sign out'}</button></form>${confirm?'<p class="accept-return"><a id="session-reload" href="/admin/confirm-password" hidden>Reload password confirmation</a></p><p class="accept-return"><a href="/admin/">Return to administration</a></p>':!login?`<p class="accept-return"><a href="/admin/confirm-password">Confirm your password</a></p>${accountsEnabled?'<p class="accept-return"><a href="/admin/accounts">Review administrator access</a></p>':''}`:''}<p class="accept-return"><a href="/">Return to the farm website</a></p></section><p class="accept-footer">Ohajiugwo Organic Farms LTD</p></main></body></html>`;
}
// Shared browser integration; default hosting routes stay closed.
export function createSessionBrowserHandler(config,{service,assets=new Map(),localFixture=false,...options}){
 const api=createSessionHandler(config,{service,...options});
 return async request=>{
  const url=new URL(request.url),response=(text,status=200,headers={})=>new Response(text,{status,headers:{...privateHeaders,...headers}});
  if(url.origin!==config.origin||request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==config.origin))return response('Request rejected.',403);
  if(['/admin/api/login','/admin/api/session','/admin/api/logout','/admin/api/reauthenticate'].includes(url.pathname))return api(request);
  const known=assets.has(url.pathname)||['/admin','/admin/','/admin/login','/admin/confirm-password'].includes(url.pathname);
  if(!known)return response('Not found.',404);if(url.search)return response('Invalid request.',400);
  if(request.method!=='GET')return response('Method not allowed.',405,{Allow:'GET'});
  if(assets.has(url.pathname)){const {body,type}=assets.get(url.pathname);return response(body,200,{'Content-Type':type});}
  let actor;
  try{actor=await service.authenticate(request);}catch(error){if(!(error instanceof AuthError)||error.status!==401)return response('Session verification is temporarily unavailable. Reload this page to try again.',503,{'Content-Type':'text/plain; charset=utf-8'});}
  const login=url.pathname==='/admin/login';
  if(!actor&&!login)return response(null,303,{Location:'/admin/login'});
  if(actor&&login)return response(null,303,{Location:'/admin/'});
  const nonce=newToken();return response(page(login?'login':url.pathname==='/admin/confirm-password'?'reauthenticate':'protected',actor,nonce,localFixture,config.accountLifecycleEnabled),200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'`});
 };
}
