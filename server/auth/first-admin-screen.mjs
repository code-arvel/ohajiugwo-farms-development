import {logo} from '../../src/components/logo.mjs';
import {newToken,privateHeaders} from '../security.mjs';
import {createFirstAdminHandler} from './first-admin-http.mjs';

function page(nonce,localFixture){
 return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Accept your invitation | Ohajiugwo Organic Farms</title>
<script nonce="${nonce}">(function(){let fragment=location.hash;const hadQuery=Boolean(location.search);history.replaceState(null,'','/admin/accept');const ready=()=>document.readyState==='loading'?new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true})):Promise.resolve();import('/admin/accept/client.mjs').then(async module=>{await ready();module.mountAcceptance({fragment,hadQuery});fragment='';}).catch(async()=>{fragment='';await ready();document.getElementById('accept-message').textContent='This page could not load. Reopen your original invitation when your connection is available.';});})();</script>
<link rel="stylesheet" href="/admin/accept/logo.css"><link rel="stylesheet" href="/admin/accept/screen.css"></head>
<body class="accept-page"><a class="skip-link" href="#accept-main">Skip to invitation</a>
<main id="accept-main" class="accept-main"><header class="accept-header">${logo()}</header><section class="accept-content" aria-labelledby="accept-heading">
${localFixture?'<p class="fixture-notice">Local test · No real account is created and no email is sent.</p>':''}
<h1 id="accept-heading" tabindex="-1">Set your password.</h1>
<p id="accept-intro" class="accept-intro">Choose a password to accept your administrator invitation.</p>
<div id="accept-message" role="status" aria-live="polite" aria-atomic="true" tabindex="-1">
<svg id="accept-error-icon" hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3h.01"/></svg>
<svg id="accept-retry-icon" hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.5 7a8 8 0 0 1 13-1L20 8M4 16l1.5 2a8 8 0 0 0 13-1"/></svg>
<svg id="accept-success-icon" hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>
<svg id="accept-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></svg>
<div><strong id="accept-message-title">Please wait</strong><p id="accept-message-copy">Checking your invitation…</p></div></div>
<noscript><p>JavaScript is needed to verify this invitation. Enable it and reopen your original invitation, or contact the maintainer.</p></noscript>
<form id="accept-form" hidden novalidate>
<div class="accept-field"><label for="password">New password</label><input id="password" name="password" type="password" autocomplete="new-password" required aria-describedby="password-help">
<p id="password-error" class="field-error" hidden></p><p id="password-help" class="field-help">Use at least 12 characters, up to 72 bytes. Spaces and pasted passwords are welcome.</p></div>
<div class="accept-field"><label for="confirmation">Confirm password</label><input id="confirmation" name="confirmation" type="password" autocomplete="new-password" required>
<p id="confirmation-error" class="field-error" hidden></p></div>
<label class="show-passwords" for="show-passwords"><input id="show-passwords" type="checkbox">Show passwords</label>
<button id="accept-submit" type="submit" disabled>Set password and accept</button>
<p class="accept-help">Your invitation is checked when you submit. Accepting does not sign you in automatically.</p></form>
<p class="accept-return"><a href="/">Return to the farm website</a></p></section><p class="accept-footer">Ohajiugwo Organic Farms LTD</p></main></body></html>`;
}
// Injected browser integration; shared hosting composition is explicitly development-gated.
export function createFirstAdminBrowserHandler(config,{service,assets=new Map(),localFixture=false,...options}){
 const api=createFirstAdminHandler(config,{service,...options});
 return async request=>{
  const url=new URL(request.url);
  if(url.origin!==config.origin)return new Response('Request rejected.',{status:403,headers:privateHeaders});
  if(assets.has(url.pathname)){
   if(url.search||request.method!=='GET')return new Response('Not found.',{status:404,headers:privateHeaders});
   const {body,type}=assets.get(url.pathname);return new Response(body,{headers:{...privateHeaders,'Content-Type':type}});
  }
  if(!['/admin/accept','/admin/callback'].includes(url.pathname))return new Response('Not found.',{status:404,headers:privateHeaders});
  if(url.pathname==='/admin/accept'&&(request.method==='POST'||request.headers.get('accept')==='application/json'))return api(request);
  if(request.method!=='GET')return new Response('Method not allowed.',{status:405,headers:{...privateHeaders,Allow:'GET'}});
  const nonce=newToken();
  return new Response(page(nonce,localFixture),{status:url.search?400:200,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'`}});
 };
}
