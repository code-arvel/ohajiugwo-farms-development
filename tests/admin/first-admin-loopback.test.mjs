import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
const module=await import('./fixtures/acceptance-server.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('loopback page/callback/API integration accepts fixtures only and preserves closed live routes',async t=>{
 assert.equal(typeof module.createAcceptanceFixtureApplication,'function');
 let app;const server=createServer((req,res)=>app.nodeHandler(req,res));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const origin=`http://127.0.0.1:${server.address().port}`;app=await module.createAcceptanceFixtureApplication({origin});
 const page=await fetch(origin+'/admin/callback');assert.equal(page.status,200);assert.match(await page.text(),/Local test/);assert.match(page.headers.get('content-security-policy'),/connect-src 'self'/);
 const client=await fetch(origin+'/admin/accept/client.mjs');assert.equal(client.status,200);
 assert.equal((await fetch(origin+'/.env.admin')).status,404);
 assert.equal((await fetch(origin+'/admin/api/login')).status,404);
 assert.equal((await fetch(origin+'/admin/accept',{headers:{Origin:'https://attacker.test'}})).status,403);
 const cookies=new Map();
 async function api(method,input,headers={}){
  const response=await fetch(origin+'/admin/accept',{method,headers:{Accept:'application/json',Origin:origin,Cookie:[...cookies].map(([key,value])=>`${key}=${value}`).join('; '),...(input?{'Content-Type':'application/json'}:{}),...headers},...(input?{body:JSON.stringify(input)}:{})});
  for(const cookie of response.headers.getSetCookie()){const part=cookie.split(';')[0],index=part.indexOf('=');cookies.set(part.slice(0,index),part.slice(index+1));}
  return response;
 }
 async function accept(input){const context=await (await api('GET')).json();return api('POST',input,{'x-csrf-token':context.csrfToken});}
 const valid=app.scenarios.get('valid');const response=await accept(valid.input);assert.equal(response.status,200);assert.equal(valid.h.active,1);
 assert.deepEqual(await (await api('GET',null,{'x-first-admin-invitation-id':valid.input.id})).json(),{completed:true});
 cookies.clear();assert.equal((await accept(valid.input)).status,400);
 for(const name of ['expired','cancelled','used'])assert.equal((await accept(app.scenarios.get(name).input)).status,400);
 const retry=app.scenarios.get('retry');const first=await accept(retry.input);assert.equal(first.status,503);assert.ok(!(await first.text()).includes('PRIVATE'));assert.equal(retry.h.active,0);
 assert.equal((await accept(retry.input)).status,200);assert.equal(retry.h.calls.filter(x=>x==='verifyInvite').length,1);
});
