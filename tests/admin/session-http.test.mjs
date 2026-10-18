import test from 'node:test';
import assert from 'node:assert/strict';
import {newToken} from '../../server/security.mjs';
import {sessionFixture} from './fixtures/session-http.mjs';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {handleAdminRequest} from '../../server/handler.mjs';
const {createSessionHandler}=await import('../../server/auth/session-http.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
function setup(options){const h=sessionFixture(options);let now=1000000;const handler=createSessionHandler(h.config,{service:h.service,now:()=>now,getClientIp:()=> '127.0.0.1'}),cookies=new Map();
 const send=async(path,method='GET',body,headers={})=>{const response=await handler(new Request(h.config.origin+path,{method,headers:{cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(method==='POST'?{origin:h.config.origin}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}));for(const entry of response.headers.getSetCookie()){const pair=entry.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}return response;};
 const context=async()=>{const response=await send('/admin/api/login');return {response,data:await response.json()};};
 const login=async()=>{const {data}=await context();return send('/admin/api/login','POST',{email:'owner@example.test',password:'DummyFarmPass123!'},{'x-csrf-token':data.csrfToken});};
 return {...h,fixture:h,handler,send,context,login,cookies,advance:ms=>now+=ms};
}
function privateResponse(response){assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.match(response.headers.get('x-robots-tag'),/noindex/);assert.equal(response.headers.get('access-control-allow-origin'),null);}
test('HTTP login requires an encrypted expiring CSRF context and returns only opaque session/user data',async()=>{
 const h=setup({https:true}),{response,data}=await h.context();privateResponse(response);assert.equal(response.status,200);assert.match(data.csrfToken,/^[A-Za-z0-9_-]{43}$/);assert.equal(h.calls.length,0);
 const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly; SameSite=Lax; Secure/);assert.match(cookie,/Path=\/admin\/api\/login; Max-Age=600;/);assert.ok(!cookie.includes('Domain='));assert.ok(!cookie.includes(data.csrfToken));
 const login=await h.send('/admin/api/login','POST',{email:'owner@example.test',password:'DummyFarmPass123!'},{'x-csrf-token':data.csrfToken});assert.equal(login.status,200);privateResponse(login);
 const body=await login.json();assert.deepEqual(Object.keys(body).sort(),['csrfToken','user']);assert.equal(body.user.email,'owner@example.test');assert.ok(!JSON.stringify(body).includes('MOCK_'));assert.ok(login.headers.getSetCookie().some(value=>value.startsWith('__Secure-ohajiugwo_admin=')&&value.includes('HttpOnly; SameSite=Lax; Secure')));
 assert.ok(login.headers.getSetCookie().some(value=>value.includes('login_csrf')&&value.includes('Max-Age=0')));
});
test('login denies wrong origin/site/token, absent/tampered/duplicate/expired contexts before provider calls',async()=>{
 for(const kind of ['origin','site','token','missing','tampered','duplicate','expired','future']){const h=setup(),{data}=await h.context();const headers={'x-csrf-token':data.csrfToken};if(kind==='origin')headers.origin='https://attacker.test';if(kind==='site')headers['sec-fetch-site']='cross-site';if(kind==='token')headers['x-csrf-token']=newToken();if(kind==='missing')headers.cookie='';if(kind==='tampered')headers.cookie='ohajiugwo_login_csrf_local=v1.bad.bad';if(kind==='duplicate')headers.cookie=[...h.cookies].map(([k,v])=>`${k}=${v}; ${k}=${v}`).join('; ');if(kind==='expired')h.advance(600000);if(kind==='future')h.advance(-1);
  const response=await h.send('/admin/api/login','POST',{email:'owner@example.test',password:'DummyFarmPass123!'},headers);assert.equal(response.status,403,kind);assert.equal(h.calls.length,0);privateResponse(response);
 }
});
test('route/method/query checks reject before invoking authentication and never redirect',async()=>{
 const h=setup();for(const [path,method,status] of [['/admin/api/login?next=https://attacker.test','GET',400],['/admin/api/logout','GET',405],['/admin/api/session','POST',405],['/admin/api/login','PUT',405],['/admin/api/unknown','GET',404]]){const response=await h.send(path,method);assert.equal(response.status,status);assert.equal(response.headers.get('location'),null);privateResponse(response);}
 assert.equal((await h.handler(new Request('https://attacker.test/admin/api/login'))).status,403);assert.equal((await h.send('/admin/api/login','GET',undefined,{origin:'https://attacker.test'})).status,403);assert.equal(h.calls.length,0);
});
test('bounded strict JSON rejects unsupported types, extra fields, arrays, malformed and oversized bodies',async()=>{
 for(const [body,extra,status] of [[{email:'owner@example.test',password:'dummy',redirect_to:'https://attacker.test'},{},400],[[],{},400],['{',{},400],[{email:'owner@example.test',password:'dummy'},{'content-type':'text/plain'},415],['x'.repeat(4097),{},413]]){const h=setup(),{data}=await h.context();const response=await h.send('/admin/api/login','POST',body,{'x-csrf-token':data.csrfToken,...extra});assert.equal(response.status,status);assert.equal(h.calls.length,0);}
});
test('password failure/nonmembership are generic, attempts are throttled and provider exceptions stay private',async()=>{
 const inactive=setup();inactive.fixture.setActive(false);const denied=await inactive.login();assert.equal(denied.status,401);assert.ok(!(await denied.text()).includes('MOCK_'));assert.ok(inactive.calls.includes('signOut'));
 const bad=setup();bad.provider.signIn=async()=>{const {AuthError}=await import('../../server/auth/sessions.mjs');throw new AuthError('MOCK_PRIVATE_PASSWORD',400);};assert.equal((await bad.login()).status,401);
 const limited=setup();limited.fixture.setAllowed(false);const throttled=await limited.login();assert.equal(throttled.status,429);assert.equal(throttled.headers.get('retry-after'),'900');assert.ok(!limited.calls.includes('signIn'));
 const outage=setup();outage.provider.signIn=async()=>{throw new Error('MOCK_PRIVATE_PROVIDER');};const failed=await outage.login();assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('MOCK_'));assert.ok(!failed.headers.getSetCookie().some(value=>/^ohajiugwo_admin_local=/.test(value)));
});
test('session endpoint checks active membership each time and projects no provider/session credentials',async()=>{
 const h=setup();assert.equal((await h.send('/admin/api/session')).status,401);assert.equal((await h.login()).status,200);
 const session=await h.send('/admin/api/session');assert.equal(session.status,200);const data=await session.json();assert.deepEqual(Object.keys(data).sort(),['csrfToken','user']);assert.ok(!JSON.stringify(data).includes('MOCK_'));privateResponse(session);
 h.fixture.setActive(false);assert.equal((await h.send('/admin/api/session')).status,401);
});
test('logout rejects CSRF before revocation; valid logout stays effective after provider cleanup failure',async()=>{
 const h=setup(),loggedIn=await h.login(),data=await loggedIn.json();const oldCookie=[...h.cookies].map(([k,v])=>`${k}=${v}`).join('; ');
 assert.equal((await h.send('/admin/api/logout','POST',{}, {'x-csrf-token':newToken()})).status,403);assert.equal((await h.send('/admin/api/session')).status,200);
 h.provider.signOut=async()=>{throw new Error('MOCK_PRIVATE_CLEANUP');};const logout=await h.send('/admin/api/logout','POST',{}, {'x-csrf-token':data.csrfToken});assert.equal(logout.status,200);assert.deepEqual(await logout.json(),{signedOut:true,providerCleanupPending:true});assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await h.send('/admin/api/session','GET',undefined,{cookie:oldCookie})).status,401);assert.equal((await h.send('/admin/api/logout','POST',{}, {'x-csrf-token':newToken()})).status,200);
});
test('logout rejects cross-origin and malformed bodies even without a live session',async()=>{
 const h=setup();assert.equal((await h.send('/admin/api/logout','POST',{}, {origin:'https://attacker.test'})).status,403);assert.equal((await h.send('/admin/api/logout','POST',{extra:true},{'x-csrf-token':newToken()})).status,400);assert.equal(h.calls.length,0);
});
test('failed application revocation never clears the browser cookie or claims logout succeeded',async()=>{
 for(const failure of ['null','throw']){const h=setup(),data=await (await h.login()).json();h.fixture.setCloseFailure(failure);
  const response=await h.send('/admin/api/logout','POST',{}, {'x-csrf-token':data.csrfToken});assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);assert.ok(!(await response.text()).includes('MOCK_'));assert.ok(!h.calls.includes('signOut'));assert.equal((await h.send('/admin/api/session')).status,200);
 }
});
test('session requests refresh server credentials without disclosing them and return safe retryable outages',async()=>{
 const h=setup();h.fixture.setTtl(10);await h.login();assert.equal((await h.send('/admin/api/session')).status,200);assert.equal(h.fixture.refreshes,1);
 h.provider.getUser=async()=>{throw new Error('MOCK_PRIVATE_NETWORK');};const unavailable=await h.send('/admin/api/session');assert.equal(unavailable.status,503);assert.ok(!(await unavailable.text()).includes('MOCK_'));
});
test('new authentication rotates opaque identifiers rather than accepting a fixed existing cookie',async()=>{
 const h=setup(),first=await h.login(),oldCookie=first.headers.getSetCookie().find(value=>value.startsWith('ohajiugwo_admin_local='));
 const second=await h.login(),newCookie=second.headers.getSetCookie().find(value=>value.startsWith('ohajiugwo_admin_local='));
 assert.equal(second.status,200);assert.notEqual(oldCookie,newCookie);assert.equal(h.rows.size,2);
});
test('HTTP response projection excludes extra internal actor data while production routes remain unavailable',async()=>{
 const h=setup(),handler=createSessionHandler(h.config,{service:{authenticate:async()=>({user:{id:'dummy',email:'owner@example.test',refresh_token:'MOCK_PRIVATE'},csrfToken:newToken(),sessionId:'MOCK_PRIVATE',accessToken:'MOCK_PRIVATE'})}});
 const response=await handler(new Request(h.config.origin+'/admin/api/session'));assert.equal(response.status,200);assert.ok(!(await response.text()).includes('MOCK_PRIVATE'));
 for(const path of ['/admin/api/login','/admin/api/session','/admin/api/logout'])assert.equal((await handleAdminRequest(new Request(h.config.origin+path),{})).status,503);
});
test('real loopback HTTP preserves separate cookies and supports sign-in/session/logout with disposable mocks',async t=>{
 let handler;const server=createServer(async(req,res)=>{
  try{const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});const response=await handler(request),headers=Object.fromEntries(response.headers);if(response.headers.getSetCookie().length)headers['set-cookie']=response.headers.getSetCookie();res.writeHead(response.status,headers);res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(503).end('Local fixture unavailable.');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const origin=`http://127.0.0.1:${server.address().port}`,h=sessionFixture({origin});handler=createSessionHandler(h.config,{service:h.service,getClientIp:()=> '127.0.0.1'});
 const context=await fetch(origin+'/admin/api/login'),csrf=await context.json(),contextCookie=context.headers.get('set-cookie').split(';')[0];
 const login=await fetch(origin+'/admin/api/login',{method:'POST',headers:{Origin:origin,Cookie:contextCookie,'Content-Type':'application/json','x-csrf-token':csrf.csrfToken},body:JSON.stringify({email:'owner@example.test',password:'DummyFarmPass123!'})});
 assert.equal(login.status,200);assert.equal(login.headers.getSetCookie().length,2);const signed=await login.json(),cookie=login.headers.getSetCookie().find(value=>value.startsWith('ohajiugwo_admin_local=')).split(';')[0];
 assert.equal((await fetch(origin+'/admin/api/session',{headers:{Cookie:cookie}})).status,200);
 const logout=await fetch(origin+'/admin/api/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','x-csrf-token':signed.csrfToken},body:'{}'});assert.equal(logout.status,200);assert.deepEqual(await logout.json(),{signedOut:true,providerCleanupPending:false});
 assert.equal((await fetch(origin+'/admin/api/session',{headers:{Cookie:cookie}})).status,401);
});
