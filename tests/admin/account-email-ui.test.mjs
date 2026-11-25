import test from 'node:test';import assert from 'node:assert/strict';import{createAccountsBrowserHandler}from'../../server/auth/accounts-screen.mjs';
const actor={user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'},csrfToken:'a'.repeat(43)};
test('account screen explicitly distinguishes SMTP email sending from generation-only preparation',async()=>{for(const enabled of [false,true]){const handler=createAccountsBrowserHandler({origin:'https://preview.example.test',accountInviteIssueEnabled:true,accountRecoveryIssueEnabled:true,accountEmailDeliveryEnabled:enabled},{auth:{authenticate:async()=>actor},service:{}});const response=await handler(new Request('https://preview.example.test/admin/accounts'));assert.equal(response.status,200);const html=await response.text();assert.match(html,new RegExp('name="admin-email-delivery" content="'+(enabled?'enabled':'disabled')+'"'));assert.ok(html.includes(enabled?'Send invitation':'Prepare invitation'));assert.ok(html.includes(enabled?'Requests delivery through the configured sender':'It does not send email'));assert.match(response.headers.get('cache-control'),/no-store/);}});

test('pending recovery button and confirmation disclose email sending only when delivery is enabled',async()=>{
 const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');
 const source=(await readFile('admin/accounts/client.mjs','utf8')).replace('export function mountAccounts','function mountAccounts');
 for(const enabled of [false,true]){
  function element(){return{hidden:false,dataset:{},children:[],listeners:{},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},addEventListener(name,fn){this.listeners[name]=fn;},querySelector(){return element();},setAttribute(){},focus(){}};}
  const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};let question;
  const document={getElementById:get,createElement:element,querySelector:selector=>({content:selector.includes('admin-email-delivery')?(enabled?'enabled':'disabled'):'enabled'})};
  const context={document,window:{confirm:q=>{question=q;return false;}},location:{assign(){assert.fail('unexpected navigation');}},fetch:async()=>({ok:true,status:200,json:async()=>({admins:[],invitations:[],passwordResets:[{id:'11111111-1111-4111-8111-111111111111',email:'dummy@example.test',issueState:'new',deliveryState:'not_sent',expiresAt:'2027-01-01T00:00:00Z'}]})})};
  runInNewContext(source+';mountAccounts();',context);await new Promise(resolve=>setImmediate(resolve));
  const button=get('password-resets-list').children[0].children.find(item=>item.textContent===(enabled?'Send recovery email':'Prepare recovery link'));
  assert.ok(button,'pending action must accurately name its effect');await button.listeners.click();
  assert.match(question,enabled?/Request one password recovery email/:/No email will be sent/);
  if(enabled)assert.doesNotMatch(question,/No email/);
 }
});
