import test from 'node:test';
import assert from 'node:assert/strict';
import {mountAcceptance} from '../../admin/accept/client.mjs';

// Small DOM boundary double; exercises the real mount/controller, mocking only browser nodes and HTTP.
function element(){return {hidden:false,disabled:false,value:'',type:'password',checked:false,textContent:'',dataset:{},attributes:{},events:{},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},toggleAttribute(key,present){if(present)this.setAttribute(key,'');else this.removeAttribute(key);if(key==='hidden')this.hidden=present;},addEventListener(name,callback){this.events[name]=callback;},focus(){this.owner.activeElement=this;}};}
function setup(replies){
 const ids=['accept-form','password','confirmation','accept-submit','accept-message','accept-heading','accept-intro','accept-message-title','accept-message-copy','password-error','confirmation-error','show-passwords','accept-error-icon','accept-retry-icon','accept-success-icon','accept-info-icon'];
 const doc={activeElement:null,defaultView:{addEventListener(){}}},nodes=Object.fromEntries(ids.map(id=>[id,element()]));
 for(const node of Object.values(nodes))node.owner=doc;
 doc.getElementById=id=>nodes[id];
 const requests=[],controller=mountAcceptance({fragment:'#id=11111111-1111-4111-8111-111111111111&nonce='+ 'n'.repeat(43)+'&token_hash='+ 'f'.repeat(64),document:doc,fetchImpl:async(url,options)=>{requests.push(options);const next=replies.shift();if(next instanceof Error)throw next;return new Response(JSON.stringify(next?.body||{}),{status:next?.status||200});}});
 return {nodes,doc,controller,requests};
}
const csrf={body:{csrfToken:'c'.repeat(43)}},tick=()=>new Promise(resolve=>setImmediate(resolve));

test('correctable confirmation errors mark and focus that field, retain values and clear stale errors after correction',async()=>{
 const h=setup([csrf,csrf,{body:{activated:true,signInRequired:true,providerCleanupPending:false}}]);await tick();
 h.nodes.password.value='DummyFarmPass123!';h.nodes.confirmation.value='DifferentDummy123!';
 await h.controller.submit({password:h.nodes.password.value,confirmation:h.nodes.confirmation.value});
 assert.equal(h.nodes.confirmation.attributes['aria-invalid'],'true');assert.match(h.nodes.confirmation.attributes['aria-describedby'],/confirmation-error/);
 assert.equal(h.nodes['confirmation-error'].hidden,false);assert.equal(h.nodes['password-error'].hidden,true);
 assert.equal(h.doc.activeElement,h.nodes.confirmation);assert.equal(h.nodes.password.value,'DummyFarmPass123!');assert.equal(h.nodes.confirmation.value,'DifferentDummy123!');
 assert.equal(h.nodes['accept-message'].attributes.role,'alert');assert.ok(h.nodes['accept-message-title'].textContent);
 h.nodes.confirmation.value=h.nodes.password.value;await h.controller.submit({password:h.nodes.password.value,confirmation:h.nodes.confirmation.value});
 assert.equal(h.nodes.confirmation.attributes['aria-invalid'],undefined);assert.equal(h.nodes['confirmation-error'].hidden,true);
 assert.equal(h.nodes['accept-form'].hidden,true);assert.equal(h.nodes['accept-intro'].hidden,true);assert.equal(h.nodes.password.value,'');assert.equal(h.nodes.confirmation.value,'');
 assert.equal(h.doc.activeElement,h.nodes['accept-heading']);assert.match(h.nodes['accept-message-copy'].textContent,/not been signed in automatically/);
});

test('short and overlong passwords attach errors to the password field without a submission',async()=>{
 const h=setup([csrf]);await tick();
 for(const value of ['short','é'.repeat(40)]){h.nodes.password.value=value;h.nodes.confirmation.value=value;await h.controller.submit({password:value,confirmation:value});assert.equal(h.nodes.password.attributes['aria-invalid'],'true');assert.equal(h.nodes['password-error'].hidden,false);assert.equal(h.doc.activeElement,h.nodes.password);assert.equal(h.nodes.password.value,value);}
 assert.equal(h.requests.length,1);
});

test('rejection removes stale setup instructions, clears credentials and announces an actionable error',async()=>{
 const h=setup([csrf,csrf,{status:400}]);await tick();h.nodes.password.value=h.nodes.confirmation.value='DummyFarmPass123!';
 h.nodes['show-passwords'].checked=true;h.nodes['show-passwords'].events.change({target:h.nodes['show-passwords']});
 await h.controller.submit({password:h.nodes.password.value,confirmation:h.nodes.confirmation.value});
 assert.equal(h.nodes['accept-form'].hidden,true);assert.equal(h.nodes['accept-intro'].hidden,true);assert.match(h.nodes['accept-message-copy'].textContent,/maintainer.*new invitation/);
 assert.equal(h.nodes.password.value,'');assert.equal(h.nodes.confirmation.value,'');assert.equal(h.nodes.password.type,'password');assert.equal(h.nodes['show-passwords'].checked,false);
 assert.equal(h.doc.activeElement,h.nodes['accept-message']);assert.equal(h.nodes['accept-error-icon'].hidden,false);
});

test('retry retains entries and prominent action, then success changes heading and removes instructions',async()=>{
 const h=setup([csrf,csrf,{status:503},csrf,csrf,{body:{activated:true,signInRequired:true,providerCleanupPending:false}}]);await tick();
 h.nodes.password.value=h.nodes.confirmation.value='DummyFarmPass123!';await h.controller.submit({password:h.nodes.password.value,confirmation:h.nodes.confirmation.value});
 assert.equal(h.nodes['accept-form'].hidden,false);assert.equal(h.nodes['accept-intro'].hidden,true);assert.equal(h.nodes['accept-submit'].textContent,'Try again');assert.equal(h.nodes['accept-retry-icon'].hidden,false);assert.equal(h.nodes.password.value,'DummyFarmPass123!');assert.equal(h.doc.activeElement,h.nodes['accept-message']);
 await h.controller.submit({password:h.nodes.password.value,confirmation:h.nodes.confirmation.value});
 assert.equal(h.nodes['accept-form'].hidden,true);assert.equal(h.nodes['accept-intro'].hidden,true);assert.equal(h.nodes['accept-success-icon'].hidden,false);assert.equal(h.nodes['accept-message'].attributes.role,'status');
});
