import test from 'node:test';
import assert from 'node:assert/strict';
import {homepageContent,samplePosts} from '../src/content/seed.mjs';
import {readSample,writeSample,resetSample,normaliseSample,storageKey} from '../local-editor/storage.mjs';
const fallback=()=>structuredClone({revision:1,homepage:homepageContent,posts:samplePosts});
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};};
test('old browser saves migrate and rich content survives export/import/save',()=>{
 const store=storage();store.setItem(storageKey,JSON.stringify(fallback()));
 const a=readSample(store,fallback());
 a.posts[0].body={type:'doc',content:[{type:'heading',attrs:{level:3},content:[{type:'text',text:'Soil notes'}]},{type:'paragraph',content:[{type:'text',text:'Read ',marks:[]},{type:'text',text:'this guide',marks:[{type:'link',attrs:{href:'https://example.org/soil'}}]}]},{type:'orderedList',attrs:{start:1},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Observe the soil'}]}]}]}]};
 const imported=normaliseSample(JSON.parse(JSON.stringify(a)));
 const saved=writeSample(store,fallback(),imported,1);
 assert.equal(saved.revision,2);assert.equal(saved.posts[0].revision,2);
 assert.deepEqual(readSample(store,fallback()).posts[0].body,a.posts[0].body);
 assert.ok(saved.posts.every(post=>post.reviewOnly));
 assert.throws(()=>writeSample(store,fallback(),a,1),/another tab/);
});
test('invalid imports and failed writes cannot replace saved content',()=>{
 const store=storage();const original=writeSample(store,fallback(),readSample(store,fallback()),1);
 const edited=structuredClone(original);edited.posts[0].body.content[0]={type:'html',text:'bad'};
 assert.throws(()=>writeSample(store,fallback(),edited,2));assert.deepEqual(readSample(store,fallback()),original);
 const failing={getItem:store.getItem,setItem(){throw new Error('Storage full');}};
 assert.throws(()=>resetSample(failing,fallback()),/Storage full/);
 assert.deepEqual(readSample(store,fallback()),original);
 assert.equal(resetSample(store,fallback()).revision,3);
});
