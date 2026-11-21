import test from 'node:test';import assert from 'node:assert/strict';
const filters=await import('../../admin/workspace/filters.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
test('draft filtering searches only loaded titles and handles browser-local dates without inventing timestamps',()=>{
 const now=new Date(2026,10,21,13),rows=[{kind:'post',payload:{title:'Living SOIL'},updatedAt:new Date(2026,10,21,1).toISOString()},{kind:'post',payload:{title:'Older soil'},updatedAt:new Date(2026,10,20,23).toISOString()},{kind:'post',payload:{title:'No date'},updatedAt:'bad'}];
 assert.deepEqual(filters.filterDrafts(rows,{search:'soil',edited:'today'},now),[rows[0]]);assert.equal(filters.filterDrafts(rows,{search:'missing'}).length,0);assert.equal(filters.filterDrafts(rows,{edited:'any'}).length,3);assert.equal(filters.filterDrafts(rows,{edited:'today'},now).length,1);
});
test('photo orientation uses real dimensions and missing/invalid dates never match Today',()=>{
 const now=new Date(),today=now.toISOString(),rows=[{metadata:{width:900,height:600},createdAt:today},{metadata:{width:600,height:900},createdAt:'bad'},{metadata:{width:600,height:600},createdAt:today}];
 assert.deepEqual(filters.filterPhotos(rows,{orientation:'landscape'}),[rows[0]]);assert.deepEqual(filters.filterPhotos(rows,{orientation:'portrait',uploaded:'today'},now),[]);assert.deepEqual(filters.filterPhotos(rows,{orientation:'square',uploaded:'today'},now),[rows[2]]);assert.equal(filters.filterPhotos(rows,{}).length,3);
});
test('filter draft state changes commit only on Apply; cancel and clear have distinct semantics',()=>{
 let state=filters.updateFilterState(undefined,{type:'open'});state=filters.updateFilterState(state,{type:'change',values:{edited:'today'}});assert.equal(state.applied.edited,'any');assert.equal(state.pending.edited,'today');state=filters.updateFilterState(state,{type:'cancel'});assert.equal(state.applied.edited,'any');state=filters.updateFilterState(state,{type:'change',values:{edited:'today'}});state=filters.updateFilterState(state,{type:'apply'});assert.equal(state.applied.edited,'today');state=filters.updateFilterState(state,{type:'clear'});assert.equal(state.applied.edited,'any');
});
test('filter state sanitizes unsupported values and does not mutate loaded records',()=>{
 const state=filters.updateFilterState(undefined,{type:'change',values:{edited:'all-time-secret',orientation:'evil',uploaded:'wrong',search:'x'.repeat(1000)}});assert.equal(state.pending.edited,'any');assert.equal(state.pending.orientation,'any');assert.equal(state.pending.search.length,160);const rows=Object.freeze([Object.freeze({kind:'post',payload:Object.freeze({title:'Title'})})]);assert.equal(filters.filterDrafts(rows,{}).length,1);
});
