import { homepageContent, samplePosts } from '../src/content/seed.mjs';
import { readingMinutes, documentText, safeLink } from '../src/content/article.mjs';
import { readSample, writeSample, resetSample, normaliseSample, storageKey } from './storage.mjs';
import { companyFields, productFields } from './company-fields.mjs';
import { createWriter, writerContent } from './writer.mjs';

const $=selector=>document.querySelector(selector);
const e=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fallback=()=>({revision:1,homepage:structuredClone(homepageContent),posts:structuredClone(samplePosts)});
let data=normaliseSample(fallback()),baseRevision=1,dirty=false,view='posts',postIndex=0,writer=null,busy=false;
const post=()=>data.posts[postIndex];
const status=()=>{$('#save-state').textContent=busy?'Saving…':`${dirty?'Unsaved changes':'Saved locally'} · revision ${baseRevision}`;$('#post-state').textContent=post()?`${post().status==='draft'?'Draft':'Local fixture'} · revision ${post().revision}`:'';};
const feedback=message=>{$('#feedback').textContent=message;$('#error').textContent='';};
const error=cause=>{$('#error').textContent=cause.message||'The local operation failed. Export your edits and try again.';$('#feedback').textContent='';$('#error').focus();};
const changed=()=>{dirty=true;status();};
function flush(){if(writer)post().body=writerContent(writer);}
function disposeWriter(){flush();writer?.destroy();writer=null;}
function selection(editor){
 $('#text-style').value=editor.isActive('heading',{level:2})?'2':editor.isActive('heading',{level:3})?'3':'paragraph';
 for(const type of ['bulletList','orderedList'])$(`[data-format="${type}"]`).setAttribute('aria-pressed',String(editor.isActive(type)));
 $('[data-format="undo"]').disabled=!editor.can().undo();$('[data-format="redo"]').disabled=!editor.can().redo();
}
function wordCount(){if(writer){const words=(writer.getText().match(/\S+/g)||[]).length;$('#word-count').textContent=`${words} words · ${Math.max(1,Math.ceil(words/200))} min read`;}}
function closeNavigation(){$('#editor-sidebar').classList.remove('is-open');$('#nav-toggle').setAttribute('aria-expanded','false');}
function show(next){
 flush();writer?.destroy();writer=null;view=next;
 for(const name of ['post-list','write','company','products'])$(`#${name}-panel`).hidden=name!==(next==='posts'?'post-list':next);
 document.querySelectorAll('[data-view]').forEach(button=>{if(button.dataset.view===(next==='write'?'posts':next))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
 if(next==='posts'){
  $('#post-list').innerHTML=data.posts.length?data.posts.map((p,i)=>`<article class="post-row"><button type="button" class="post-open" data-post="${i}"><strong>${e(p.title)}</strong><span>${p.publishedAt?e(p.publishedAt)+' · ':''}${readingMinutes(p.body)} min read</span></button><span class="post-state">${p.status==='draft'?'Draft':'Local fixture'}</span></article>`).join(''):'<p>No posts yet. Create your first local draft.</p>';
 }else if(next==='write'){
  for(const [id,key]of [['post-title','title'],['post-excerpt','excerpt'],['post-slug','slug'],['post-date','publishedAt'],['post-author','author'],['post-cover','cover'],['post-status','status']])$(`#${id}`).value=post()[key]||'';
  writer=createWriter($('#writing-content'),post().body,{onChange:editor=>{changed();try{post().body=writerContent(editor);$('#error').textContent='';}catch(cause){$('#error').textContent=cause.message;}wordCount();selection(editor);},onSelection:selection});
  selection(writer);wordCount();$('#settings').open=matchMedia('(min-width:1201px)').matches;
 }else if(next==='company')$('#company-fields').innerHTML=companyFields(data.homepage.company);
 else $('#product-fields').innerHTML=productFields(data.homepage);
 closeNavigation();status();
}
function confirmChange(message){
 const dialog=$('#confirm-dialog');$('#confirm-message').textContent=message;dialog.returnValue='cancel';
 return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='continue'),{once:true});dialog.showModal();});
}
async function withLock(operation){
 if(!navigator.locks)throw new Error('This browser cannot safely coordinate saves. Export JSON instead.');
 const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),5000);
 try{return await navigator.locks.request(storageKey,{signal:abort.signal},operation);}catch(cause){if(cause.name==='AbortError')throw new Error('Another tab is busy saving. Try again shortly or export your edits.');throw cause;}finally{clearTimeout(timeout);}
}
function setBusy(value){busy=value;$('#save').disabled=value;writer?.setEditable(!value,false);document.querySelectorAll('#editor-main input,#editor-main textarea,#editor-main select,#editor-main button,#editor-sidebar button,.tools-menu button').forEach(el=>el.disabled=value);if(!value&&writer)selection(writer);status();}

$('#save').addEventListener('click',async()=>{
 try{flush();setBusy(true);await withLock(()=>{const next=writeSample(localStorage,fallback(),data,baseRevision);data=next;baseRevision=next.revision;dirty=false;});feedback('Saved in this browser. The website and source files are unchanged.');}
 catch(cause){error(cause);}finally{setBusy(false);}
});
$('#post-list').addEventListener('click',event=>{const button=event.target.closest('[data-post]');if(!button)return;try{disposeWriter();postIndex=Number(button.dataset.post);show('write');$('#post-title').focus();}catch(cause){error(cause);}});
$('#new-post').addEventListener('click',()=>{
 try{disposeWriter();if(data.posts.length>=100)throw new Error('The local limit is 100 posts.');const id=crypto.randomUUID();data.posts.push({id,revision:1,status:'draft',reviewOnly:true,slug:`new-post-${id.slice(0,8)}`,title:'Untitled post',excerpt:'A short introduction.',publishedAt:'',cover:'planting',body:{type:'doc',content:[{type:'paragraph'}]}});postIndex=data.posts.length-1;changed();show('write');$('#post-title').focus();}catch(cause){error(cause);}
});
$('#back-posts').addEventListener('click',()=>{try{show('posts');}catch(cause){error(cause);}});
for(const [id,key]of [['post-title','title'],['post-excerpt','excerpt'],['post-slug','slug'],['post-date','publishedAt'],['post-author','author'],['post-cover','cover'],['post-status','status']])$(`#${id}`).addEventListener('input',event=>{post()[key]=event.target.value;changed();});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{try{show(button.dataset.view);}catch(cause){error(cause);}}));
for(const id of ['company-fields','product-fields']){
 $(`#${id}`).addEventListener('submit',event=>event.preventDefault());
 $(`#${id}`).addEventListener('input',event=>{const path=event.target.dataset.path;if(!path)return;const parts=path.split('.');const last=parts.pop();const parent=parts.reduce((value,part)=>value[part],data);parent[last]=event.target.type==='number'?Number(event.target.value):event.target.value;changed();});
}
$('#text-style').addEventListener('change',event=>{if(event.target.value==='paragraph')writer.chain().focus().setParagraph().run();else writer.chain().focus().setHeading({level:Number(event.target.value)}).run();});
document.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>{if(!writer)return;const chain=writer.chain().focus();({bulletList:()=>chain.toggleBulletList(),orderedList:()=>chain.toggleOrderedList(),undo:()=>chain.undo(),redo:()=>chain.redo()})[button.dataset.format]().run();}));
$('#link-button').addEventListener('click',()=>{
 if(!writer)return;if(writer.state.selection.empty&&!writer.isActive('link')){feedback('Select the words you want to link, then choose Link.');return;}
 $('#link-url').value=writer.getAttributes('link').href||'';$('#link-error').textContent='';$('#unlink').disabled=!writer.isActive('link');$('#link-dialog').showModal();$('#link-url').focus();
});
$('#link-form').addEventListener('submit',event=>{event.preventDefault();try{const href=safeLink($('#link-url').value);writer.chain().focus().extendMarkRange('link').setLink({href}).run();$('#link-dialog').close();}catch(cause){$('#link-error').textContent=cause.message;}});
$('#link-cancel').addEventListener('click',()=>$('#link-dialog').close());
$('#unlink').addEventListener('click',()=>{writer.chain().focus().extendMarkRange('link').unsetLink().run();$('#link-dialog').close();});
$('#export').addEventListener('click',()=>{
 try{flush();const exported=normaliseSample(data);const blob=new Blob([JSON.stringify(exported,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ohajiugwo-local-sample.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('Local JSON exported. Nothing was published.');$('#tools').open=false;}catch(cause){error(cause);}
});
$('#import-button').addEventListener('click',()=>{$('#tools').open=false;$('#import').click();});
$('#import').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 try{if(file.size>1024*1024)throw new Error('Choose a JSON file smaller than 1 MB.');const imported=normaliseSample(JSON.parse(await file.text()));if(dirty&&!await confirmChange('Replace your unsaved local edits with this imported document? Export first to keep a copy.'))return;writer?.destroy();writer=null;data={...imported,revision:baseRevision};postIndex=0;changed();show('posts');feedback('Imported into memory. Save to keep it in this browser.');}catch(cause){error(cause);}finally{event.target.value='';}
});
$('#reload').addEventListener('click',async()=>{
 $('#tools').open=false;if(dirty&&!await confirmChange('Discard unsaved edits and reload the browser-saved document?'))return;
 try{const next=readSample(localStorage,fallback());writer?.destroy();writer=null;data=next;baseRevision=data.revision;dirty=false;postIndex=0;show('posts');feedback('Saved local content reloaded.');}catch(cause){error(cause);}
});
$('#reset').addEventListener('click',async()=>{
 $('#tools').open=false;if(!await confirmChange('Replace the browser-saved document and unsaved edits with the original local sample? Export first to keep your work.'))return;
 try{const next=await withLock(()=>resetSample(localStorage,fallback()));writer?.destroy();writer=null;data=next;baseRevision=data.revision;dirty=false;postIndex=0;show('posts');feedback('Original local sample restored. Nothing was published.');}catch(cause){error(cause);}
});
$('#nav-toggle').addEventListener('click',()=>{const open=!$('#editor-sidebar').classList.contains('is-open');$('#editor-sidebar').classList.toggle('is-open',open);$('#nav-toggle').setAttribute('aria-expanded',String(open));if(open)$('[data-view="posts"]').focus();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#editor-sidebar').classList.contains('is-open')){closeNavigation();$('#nav-toggle').focus();}});
document.addEventListener('click',event=>{if(!$('#editor-sidebar').contains(event.target)&&!$('#nav-toggle').contains(event.target))closeNavigation();});
window.addEventListener('storage',event=>{if(event.key===storageKey)error(new Error('Another tab changed the saved document. Export your edits, then reload. Stale saves will be rejected.'));});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
try{data=readSample(localStorage,fallback());baseRevision=data.revision;}catch(cause){error(cause);}
show('posts');
