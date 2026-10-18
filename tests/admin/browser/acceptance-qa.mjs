// Explicit optional Chrome QA. Isolated local provider/RPC fixtures only; never loads .env.admin.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAcceptanceFixtureApplication} from '../fixtures/acceptance-server.mjs';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(read,description){for(let i=0;i<100;i++){const value=await read();if(value)return value;await delay(50);}throw new Error('Timed out: '+description);}
const profile=await mkdtemp(join(tmpdir(),'farm-acceptance-chrome-'));
let app,chrome,socket;
const server=createServer((req,res)=>app.nodeHandler(req,res));
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin=`http://127.0.0.1:${server.address().port}`;
 app=await createAcceptanceFixtureApplication({origin});
 chrome=spawn('google-chrome',['--headless','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 const port=await until(async()=>{try{return (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{return null;}},'isolated Chrome startup');
 const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;const pending=new Map(),exceptions=[],requests=[];
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const entry=pending.get(data.id);pending.delete(data.id);data.error?entry.reject(new Error(data.error.message)):entry.resolve(data.result);}else if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params);else if(data.method==='Network.requestWillBeSent')requests.push(data.params.request);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error('Browser evaluation failed');return result.result.value;};
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 const viewport=(width,height)=>call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
 const key=async(key,code,keyCode)=>{for(const type of ['keyDown','keyUp'])await call('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode,...(type==='keyDown'&&key==='Enter'?{text:'\r'}:{})});};
 const enter=()=>key('Enter','Enter',13),tab=()=>key('Tab','Tab',9),space=()=>key(' ','Space',32);
 const navigate=async name=>{await call('Page.navigate',{url:app.scenarios.get(name).url});await until(()=>evaluate("Boolean(document.getElementById('accept-form')&&!document.getElementById('accept-form').hidden&&!document.getElementById('accept-submit').disabled)"),'ready screen');await evaluate('document.fonts.ready');assert.equal(await evaluate('location.hash+location.search'),'');};
 const fill=(password='DummyFarmPass123!',confirmation=password)=>evaluate(`document.getElementById('password').value=${JSON.stringify(password)};document.getElementById('confirmation').value=${JSON.stringify(confirmation)};`);
 const submit=async()=>{await evaluate("document.getElementById('accept-submit').focus()");await enter();};
 const state=async desired=>{try{return await until(()=>evaluate(`document.getElementById('accept-message').dataset.state===${JSON.stringify(desired)}`),desired+' state');}catch(error){console.error(JSON.stringify(await evaluate("({phase:document.getElementById('accept-message').dataset.state,focus:document.activeElement.id,disabled:document.getElementById('accept-submit').disabled,fieldError:document.getElementById('password').getAttribute('aria-invalid')})")));console.error('Browser exception count:',exceptions.length);if(exceptions.length)console.error(exceptions.map(item=>item.exceptionDetails.exception?.description||item.exceptionDetails.text).join('\n'));throw error;}};
 const fit=async()=>assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 const screenshot=async name=>{const result=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(tmpdir(),`farm-acceptance-${name}.png`),Buffer.from(result.data,'base64'));};

 await viewport(1440,1100);await navigate('valid');await fit();
 assert.equal(await evaluate("Math.abs(document.querySelector('.accept-main').getBoundingClientRect().left-(innerWidth-document.querySelector('.accept-main').getBoundingClientRect().width)/2)<1"),true);
 assert.equal(await evaluate("getComputedStyle(document.querySelector('.accept-content')).boxShadow"),'none');await screenshot('desktop-ready');
 for(const font of ['/admin/accept/fonts/lora-variable.ttf','/admin/accept/fonts/dm-sans-variable.ttf'])assert.equal((await fetch(origin+font)).status,200);
 await evaluate("document.getElementById('password').focus()");await tab();assert.equal(await evaluate('document.activeElement.id'),'confirmation');await tab();assert.equal(await evaluate('document.activeElement.id'),'show-passwords');
 assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"),'solid');assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineWidth"),'3px');
 await space();assert.equal(await evaluate("document.getElementById('show-passwords').checked&&document.getElementById('password').type==='text'&&document.getElementById('confirmation').type==='text'"),true);await space();
 await fill('short');await submit();await state('error');assert.equal(await evaluate('document.activeElement.id'),'password');assert.equal(await evaluate("document.getElementById('password').getAttribute('aria-invalid')"),'true');
 await fill('é'.repeat(40));await submit();await state('error');assert.equal(await evaluate('document.activeElement.id'),'password');
 await fill('DummyFarmPass123!','DifferentDummy123!');await submit();await state('error');assert.equal(await evaluate('document.activeElement.id'),'confirmation');
 assert.equal(await evaluate("!document.getElementById('confirmation-error').hidden&&document.getElementById('password').value==='DummyFarmPass123!'&&document.getElementById('accept-message').getAttribute('role')==='alert'"),true);
 assert.equal(await evaluate("getComputedStyle(document.getElementById('accept-error-icon')).display!=='none'&&getComputedStyle(document.getElementById('accept-info-icon')).display==='none'"),true,'render the error icon, not the initial information icon');
 await viewport(375,900);await fit();await screenshot('mobile-error');
 await viewport(320,900);await fit();await viewport(375,360);
 assert.equal(await evaluate("getComputedStyle(document.querySelector('.accept-main')).marginTop"),'32px');
 await evaluate("document.getElementById('accept-submit').scrollIntoView({block:'center'})");assert.equal(await evaluate("document.getElementById('accept-submit').getBoundingClientRect().bottom<=innerHeight"),true);
 await viewport(375,900);await fill();await submit();await state('complete');
 assert.equal(await evaluate("document.getElementById('accept-form').hidden&&document.getElementById('accept-intro').hidden&&document.getElementById('password').value===''&&document.activeElement.id==='accept-heading'"),true);
 assert.match(await evaluate("document.getElementById('accept-message-copy').textContent"),/not been signed in automatically/);await screenshot('mobile-success');
 assert.equal(await evaluate("getComputedStyle(document.getElementById('accept-success-icon')).display!=='none'&&getComputedStyle(document.getElementById('accept-info-icon')).display==='none'"),true);
 for(const scenario of ['expired','cancelled','used']){await navigate(scenario);await fill();await submit();await state('error');assert.equal(await evaluate("document.getElementById('accept-form').hidden&&document.getElementById('accept-intro').hidden&&document.getElementById('password').value===''"),true);await fit();}
 await screenshot('mobile-rejected');
 await navigate('retry');await fill();await submit();await state('retry');
 assert.equal(await evaluate("!document.getElementById('accept-form').hidden&&document.getElementById('password').value==='DummyFarmPass123!'&&document.getElementById('accept-submit').textContent==='Try again'&&document.activeElement.id==='accept-message'"),true);await fit();await screenshot('mobile-retry');
 await submit();await state('complete');assert.equal(app.scenarios.get('retry').h.calls.filter(value=>value==='verifyInvite').length,1);
 assert.equal(await evaluate('localStorage.length+sessionStorage.length'),0);assert.equal(requests.filter(request=>!request.url.startsWith(origin+'/')).length,0);assert.equal(exceptions.length,0);
 console.log(JSON.stringify({localMockBrowser:'PASS',desktop1440:true,mobile375and320:true,validationAndFieldFocus:true,passwordSpaceToggleAndEnterSubmit:true,visibleFocusComputed:true,successAndRejectionCopy:true,retryRecovery:true,sameOriginAssetsAndEmptyStorage:true,screenshots:'OS temp directory: farm-acceptance-*.png',unverified:'Screen-reader announcements, physical keyboard/touch/virtual-keyboard behaviour and actual 200% browser zoom; all hosted Auth/email behaviour.'},null,2));
}finally{
 socket?.close();if(chrome){chrome.kill();await new Promise(resolve=>{if(chrome.exitCode!==null)resolve();else chrome.once('exit',resolve);});}
 await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});await rm(profile,{recursive:true,force:true});
}
