// Explicit browser checks with disposable local provider/RPC fixtures only.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createSessionFixtureApplication} from '../fixtures/session-browser.mjs';
import {localChrome,until} from './chrome-local.mjs';
let app,browser;const server=createServer((req,res)=>app.nodeHandler(req,res));
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const origin=`http://127.0.0.1:${server.address().port}`;app=await createSessionFixtureApplication({origin,composed:true});browser=await localChrome();
 const {evaluate:ev}=browser,enter=()=>browser.key('Enter','Enter',13),tab=()=>browser.key('Tab','Tab',9),space=()=>browser.key(' ','Space',32);
 const ready=async path=>{await until(()=>ev(`location.pathname===${JSON.stringify(path)}&&Boolean(document.getElementById('session-submit')&&!document.getElementById('session-submit').disabled)`),path+' ready');await ev('document.fonts.ready');};
 const navigate=async path=>{await browser.call('Page.navigate',{url:origin+path});};
 const fit=async()=>assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true);
 const fill=(password='DummyFarmPass123!',email='owner@example.test')=>ev(`document.getElementById('email').value=${JSON.stringify(email)};document.getElementById('password').value=${JSON.stringify(password)};`);
 const submit=async()=>{await ev("document.getElementById('session-submit').focus()");await enter();};
 const state=value=>until(()=>ev(`document.getElementById('session-message')?.dataset.state===${JSON.stringify(value)}`),value+' message');
 await browser.viewport(1440,1000);await navigate('/admin/');await ready('/admin/login');await fit();await browser.screenshot('desktop-login');
 const count=browser.requests.length;await fill('','bad');await submit();await state('error');assert.equal(await ev('document.activeElement.id'),'email');assert.equal(browser.requests.length,count);
 await fill('WrongDummyPassword');await submit();await state('error');assert.equal(await ev("document.getElementById('password').value"),'WrongDummyPassword');assert.ok(!(await ev('document.body.textContent')).includes('MOCK_'));
 await browser.viewport(375,900);await fit();await browser.screenshot('mobile-login-error');await browser.viewport(320,900);await fit();
 await ev("document.getElementById('password').focus()");await tab();assert.equal(await ev('document.activeElement.id'),'show-passwords');await space();assert.equal(await ev("document.getElementById('password').type"),'text');await space();
 await fill();await submit();await ready('/admin/');assert.equal(await ev("document.getElementById('session-identity').textContent"),'owner@example.test');await fit();await browser.screenshot('mobile-session');
 const oldCookies=(await browser.call('Network.getCookies')).cookies.filter(item=>item.name==='ohajiugwo_admin_local');assert.equal(oldCookies.length,1);assert.equal(oldCookies[0].httpOnly,true);const oldCookie=oldCookies.map(item=>item.name+'='+item.value).join('; ');
 app.h.setCloseFailure('throw');await submit();await state('retry');assert.equal(await ev('location.pathname'),'/admin/');assert.equal(await ev("document.getElementById('session-identity').textContent"),'owner@example.test');await browser.screenshot('mobile-logout-retry');
 app.h.setCloseFailure(undefined);await submit();await ready('/admin/login');assert.equal((await fetch(origin+'/admin/api/session',{headers:{Cookie:oldCookie}})).status,401);
 await fill();await submit();await ready('/admin/');app.h.setActive(false);await navigate('/admin/');await ready('/admin/login');assert.equal(await ev("document.getElementById('session-identity')===null"),true);
 await fill();await submit();await state('error');assert.equal(await ev('location.pathname'),'/admin/login');
 app.h.setActive(true);await fill();await submit();await ready('/admin/');const getUser=app.h.provider.getUser;app.h.provider.getUser=async()=>{throw new Error('MOCK_PRIVATE_OUTAGE');};await navigate('/admin/');await until(()=>ev("document.body.textContent.includes('Session verification is temporarily unavailable')"),'safe outage');assert.ok(!(await ev('document.body.textContent')).includes('MOCK_'));app.h.provider.getUser=getUser;
 await navigate('/admin/');await ready('/admin/');await submit();await ready('/admin/login');await fill();await ev("window.dispatchEvent(new PageTransitionEvent('pagehide'))");assert.equal(await ev("document.getElementById('password').value+document.getElementById('email').value"),'');assert.equal(await ev("document.getElementById('session-form').hidden"),true);
 await browser.call('Network.setCacheDisabled',{cacheDisabled:true});await browser.call('Fetch.enable',{patterns:[{urlPattern:'*/admin/session/client.mjs',requestStage:'Request'}]});
 await navigate('/admin/login');const paused=await until(()=>browser.call.events.find(item=>item.method==='Fetch.requestPaused'),'delayed client import');await until(()=>ev("Boolean(document.getElementById('password'))"),'unmounted login fields');
 await fill();await ev("window.dispatchEvent(new PageTransitionEvent('pagehide'))");assert.equal(await ev("document.getElementById('password').value+document.getElementById('email').value"),'');assert.equal(await ev("document.getElementById('session-form').hidden"),true);
 await browser.call('Fetch.failRequest',{requestId:paused.params.requestId,errorReason:'Aborted'});await browser.call('Fetch.disable');await ev("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");await ready('/admin/login');assert.equal(await ev("document.getElementById('password').value"),'');
 assert.equal(await ev('localStorage.length+sessionStorage.length'),0);assert.equal(browser.requests.filter(item=>!item.url.startsWith(origin+'/')).length,0);assert.equal(browser.exceptions.length,0);
 console.log(JSON.stringify({localMockSessionBrowser:'PASS',actualHostingEntry:true,desktop1440:true,mobile375and320:true,validationAndKeyboardSubmit:true,passwordVisibility:true,loginAndProtectedPage:true,nonmemberAndRevokedDenied:true,logoutFailureRetryAndOldCookieDenied:true,providerOutageSafe:true,pagehideClearsFields:true,sameOriginAndNoBrowserStorage:true,screenshots:'OS temp directory: farm-session-*.png',pending:'Owner keyboard/screen-reader/touch review and all hosted authentication/HTTPS/provider/email checks.'},null,2));
}finally{await browser?.close();await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});}
