const defaults=()=>({search:'',edited:'any',orientation:'any',uploaded:'any'});
const clean=value=>({search:typeof value?.search==='string'?value.search.slice(0,160):'',edited:value?.edited==='today'?'today':'any',orientation:['landscape','portrait','square'].includes(value?.orientation)?value.orientation:'any',uploaded:value?.uploaded==='today'?'today':'any'});
export function updateFilterState(state={applied:defaults(),pending:defaults()},action={}){
 const current={applied:clean(state.applied),pending:clean(state.pending)};
 if(action.type==='open'||action.type==='cancel')current.pending={...current.applied};
 if(action.type==='change')current.pending=clean({...current.pending,...action.values});
 if(action.type==='apply')current.applied={...current.pending};
 if(action.type==='clear')return{applied:defaults(),pending:defaults()};
 return current;
}
const sameDay=(value,now)=>{if(typeof value!=='string'||!value)return false;const date=new Date(value);return Number.isFinite(date.getTime())&&date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth()&&date.getDate()===now.getDate();};
export function filterDrafts(rows,values={},now=new Date()){
 const state=clean(values),search=state.search.trim().toLocaleLowerCase();
 return rows.filter(row=>(row.kind==='post')&&String(row.payload?.title||'').toLocaleLowerCase().includes(search)&&(state.edited!=='today'||sameDay(row.updatedAt,now)));
}
export function filterPhotos(rows,values={},now=new Date()){
 const state=clean(values);
 return rows.filter(row=>{const w=row.metadata?.width,h=row.metadata?.height,orientation=w>h?'landscape':w<h?'portrait':'square';return(state.orientation==='any'||(Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0&&orientation===state.orientation))&&(state.uploaded!=='today'||sameDay(row.createdAt,now));});
}
export function mountFilters({root,onApply}){
 if(!root)return{destroy(){}};
 let state=updateFilterState();const abort=new AbortController(),options={signal:abort.signal};
 const query=selector=>root.querySelector(selector),dialog=query('dialog'),open=query('[data-filter-open]'),clear=query('[data-filter-clear]'),search=query('[data-filter-search]'),summary=query('[data-filter-summary]');
 const draw=()=>{const chosen=Object.entries(state.applied).filter(([key,value])=>key!=='search'&&value!=='any');summary.textContent=chosen.length?chosen.map(([key,value])=>(key==='orientation'?'Orientation':key==='uploaded'?'Uploaded':'Edited')+': '+(value==='today'?'Today':value[0].toUpperCase()+value.slice(1))).join(' · '):'';clear.hidden=!chosen.length&&!state.applied.search;open.textContent=chosen.length?`Filters (${chosen.length})`:'Filters';};
 const apply=()=>{draw();onApply({...state.applied});};
 open.addEventListener('click',()=>{state=updateFilterState(state,{type:'open'});for(const input of dialog.querySelectorAll('input[type=radio]'))input.checked=state.pending[input.name]===input.value;dialog.returnValue='';dialog.showModal();},options);
 dialog.addEventListener('change',event=>{if(event.target.matches('input[type=radio]'))state=updateFilterState(state,{type:'change',values:{[event.target.name]:event.target.value}});},options);
 dialog.addEventListener('close',()=>{state=updateFilterState(state,{type:dialog.returnValue==='apply'?'apply':'cancel'});apply();open.focus();},options);
 query('[data-filter-reset]').addEventListener('click',()=>{state.pending={...defaults(),search:state.applied.search};for(const input of dialog.querySelectorAll('input[type=radio]'))input.checked=input.value==='any';},options);
 clear.addEventListener('click',()=>{state=updateFilterState(state,{type:'clear'});if(search)search.value='';apply();open.focus();},options);
 search?.addEventListener('input',()=>{state=updateFilterState(state,{type:'change',values:{...state.applied,search:search.value}});state=updateFilterState(state,{type:'apply'});apply();},options);
 draw();return{destroy(){abort.abort();if(dialog.open)dialog.close();}};
}
