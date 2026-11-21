import test from 'node:test';
import assert from 'node:assert/strict';
import {mount} from '../../admin/media/metadata.mjs';
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.value='';this.textContent='';this.dataset={};}
 append(...elements){this.children.push(...elements);}replaceChildren(...elements){this.children=[...elements];}addEventListener(name,fn){this.listeners[name]=fn;}remove(){}setAttribute(){}
}
function descendants(el){return[el,...el.children.flatMap(v=>typeof v==='object'?descendants(v):[])];}
test('metadata form reads persisted state then sends the loaded CAS revision and escaped text as data',async()=>{
 const doc={createElement:tag=>new Element(tag)},root=new Element('main');root.ownerDocument=doc;
 const calls=[];let saved;
 await mount({root,media:{id:'photo'},request:async(path,options)=>{calls.push({path,options});if(path.endsWith('/usage'))return{revisions:[{}],releases:[{}],protected:true};return{id:'photo',revision:4,editorial:{displayName:'<script>text</script>'},technical:{width:10}};},onSaved:value=>saved=value});
 const elements=descendants(root),form=elements.find(el=>el.tag==='form'),name=elements.find(el=>el.name==='displayName');
 assert.equal(name.value,'<script>text</script>');name.value='New photo';
 await form.listeners.submit({preventDefault(){}});
 const write=calls.find(c=>c.options?.method==='POST');assert.equal(JSON.parse(write.options.body).baseRevision,4);assert.equal(JSON.parse(write.options.body).editorial.displayName,'New photo');assert.equal(saved.revision,4);
});
