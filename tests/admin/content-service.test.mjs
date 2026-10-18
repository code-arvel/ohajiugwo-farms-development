import test from 'node:test';
import assert from 'node:assert/strict';
import {createContentService} from '../../server/content/content-service.mjs';

const id='11111111-1111-4111-8111-111111111111';
const homepage={company:{name:'Ohajiugwo Organic Farms Ltd',displayName:'Ohajiugwo',email:'',headquarters:'Enugu',farmland:'Enugu',hectares:1,mission:'Farm well.',vision:'Grow well.',values:['Care','Soil','Community']},products:[{title:'A',description:'B',enquiry:'Ask'},{title:'C',description:'D',enquiry:'Ask'},{title:'E',description:'F',enquiry:'Ask'}],services:[{title:'A',description:'B',enquiry:'Ask'},{title:'C',description:'D',enquiry:'Ask'},{title:'E',description:'F',enquiry:'Ask'}]};
function fixture(){
 const calls=[],auth={authenticate:async(_request,options={})=>{calls.push(['auth',options]);return{user:{id,email:'owner@example.test'},accessToken:'USER_JWT_PRIVATE',cookieHash:'a'.repeat(43)};}};
 const provider={userRpc:async(name,params,token)=>{calls.push([name,params,token]);if(token!=='USER_JWT_PRIVATE')throw Error('missing user JWT');if(name==='farm_content_save')return{id,kind:params.p_kind,revision:1,payload:params.p_payload,updated_at:new Date(0).toISOString(),deleted_at:null};if(name==='farm_content_list')return[];if(name==='farm_content_read')return null;if(name==='farm_content_history'||name==='farm_content_trash_list')return[];if(name==='farm_content_restore'||name==='farm_content_untrash')return{id,kind:'post',revision:4,payload:{},updated_at:new Date(0).toISOString(),deleted_at:null};if(name==='farm_content_trash')return false;throw Error('unexpected RPC');}};
 return{service:createContentService({auth,provider}),calls};
}
test('content service requires the active authenticated session and calls user-scoped RPCs only',async()=>{
 const h=fixture();await h.service.list(new Request('http://local/admin/api/content'));
 assert.equal(h.calls[0][0],'auth');assert.deepEqual(h.calls[0][1],{});assert.equal(h.calls[1][0],'farm_content_list');assert.equal(h.calls[1][2],'USER_JWT_PRIVATE');
});
test('homepage writes validate fixed fields and use revision compare-and-swap through the user JWT',async()=>{
 const h=fixture();const result=await h.service.save(new Request('http://local/admin/api/content'),{id:null,kind:'homepage',baseRevision:null,payload:homepage});
 assert.equal(result.revision,1);assert.equal(h.calls.at(-1)[0],'farm_content_save');assert.equal(h.calls.at(-1)[1].p_base_revision,null);
 await assert.rejects(()=>h.service.save(new Request('http://local/admin/api/content'),{id:null,kind:'homepage',baseRevision:null,payload:{...homepage,extra:'x'}}));
});
test('article writes validate safe structured content and discard client revision/provenance claims',async()=>{
 const h=fixture(),payload={slug:'soil-care',title:'Soil care',excerpt:'A short note.',publishedAt:'',cover:'planting',status:'draft',author:'',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Healthy soil.'}]}]},reviewOnly:false};
 const result=await h.service.save(new Request('http://local/admin/api/content'),{id:null,kind:'post',baseRevision:null,payload});
 assert.equal(result.revision,1);assert.equal(h.calls.at(-1)[1].p_payload.reviewOnly,undefined);assert.equal(h.calls.at(-1)[1].p_payload.status,'draft');
 const unsafe=structuredClone(payload);unsafe.body.content[0].content[0].marks=[{type:'link',attrs:{href:'javascript:alert(1)'}}];
 await assert.rejects(()=>h.service.save(new Request('http://local/admin/api/content'),{id:null,kind:'post',baseRevision:null,payload:unsafe}));
});
test('trash inventory and restore use the same active session and revision guard',async()=>{
 const h=fixture();assert.deepEqual(await h.service.listTrash(new Request('http://local/admin/api/content/trash')),[]);const restored=await h.service.untrash(new Request('http://local/admin/api/content/'+id+'/untrash'),id,3);assert.equal(restored.revision,4);assert.deepEqual(h.calls.filter(call=>call[0].startsWith('farm_')).map(call=>call[0]),['farm_content_trash_list','farm_content_untrash']);assert.ok(h.calls.filter(call=>call[0].startsWith('farm_')).every(call=>call[2]==='USER_JWT_PRIVATE'));
});
