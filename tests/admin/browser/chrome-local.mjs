// Optional local Chrome driver for explicit browser QA; no application/runtime dependency.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export async function until(read,label){for(let i=0;i<150;i++){const value=await read();if(value)return value;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Timed out: '+label);}
export async function localChrome(){
 const profile=await mkdtemp(join(tmpdir(),'farm-session-chrome-'));let socket,launchError;
 const chrome=spawn('google-chrome',['--headless','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 chrome.on('error',error=>{launchError=error;});
 const close=async()=>{socket?.close();if(chrome.pid){chrome.kill();await new Promise(resolve=>{if(chrome.exitCode!==null)resolve();else chrome.once('exit',resolve);});}await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});};
 try{
  const port=await until(async()=>{if(launchError)throw new Error('Installed Chrome is required for this optional check.');try{return (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{return null;}},'Chrome startup');
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();socket=new WebSocket(targets.find(item=>item.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map(),requests=[],exceptions=[],events=[];
  socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const entry=pending.get(data.id);pending.delete(data.id);data.error?entry.reject(new Error(data.error.message)):entry.resolve(data.result);}else{events.push(data);if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params);else if(data.method==='Network.requestWillBeSent')requests.push(data.params.request);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  call.events=events;
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error('Browser evaluation failed');return result.result.value;};
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  return {call,evaluate,requests,exceptions,close,viewport:(width,height)=>call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600}),key:async(key,code,keyCode)=>{for(const type of ['keyDown','keyUp'])await call('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode,...(type==='keyDown'&&key==='Enter'?{text:'\r'}:{})});},screenshot:async name=>{const result=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(tmpdir(),'farm-session-'+name+'.png'),Buffer.from(result.data,'base64'));}};
 }catch(error){await close();throw error;}
}
