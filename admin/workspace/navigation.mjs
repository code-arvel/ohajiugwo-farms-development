// Shared disclosure navigation. No credentials, persistence or provider requests.
export function mountNavigation(sidebar){
 const toggle=sidebar?.querySelector('.workspace-menu-toggle'),nav=sidebar?.querySelector('#workspace-menu-links');if(!toggle||!nav)return;
 const view=sidebar.ownerDocument.defaultView,doc=sidebar.ownerDocument,mobile=view.matchMedia('(max-width:800px)'),events=new AbortController();
 const close=(focus=false)=>{sidebar.removeAttribute('data-menu-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation menu');toggle.querySelector('[data-menu-label]').textContent='Menu';if(focus)toggle.focus();};
 toggle.addEventListener('click',()=>{if(!mobile.matches)return;if(sidebar.hasAttribute('data-menu-open'))close();else{sidebar.setAttribute('data-menu-open','');toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Close navigation menu');toggle.querySelector('[data-menu-label]').textContent='Close';}},{signal:events.signal});
 nav.addEventListener('click',event=>{if(mobile.matches&&event.target.closest('a,button'))close(nav.contains(doc.activeElement));},{signal:events.signal});
 doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile.matches&&sidebar.hasAttribute('data-menu-open')){event.preventDefault();close(true);}},{signal:events.signal});
 doc.addEventListener('pointerdown',event=>{if(!sidebar.contains(event.target))close();},{signal:events.signal});
 sidebar.addEventListener('focusout',event=>{if(event.relatedTarget&&!sidebar.contains(event.relatedTarget))close();},{signal:events.signal});
 mobile.addEventListener('change',()=>close(),{signal:events.signal});close();sidebar.setAttribute('data-menu-ready','');
 view.addEventListener('pagehide',()=>events.abort(),{once:true});
}
if(typeof document!=='undefined')document.querySelectorAll('.workspace-sidebar').forEach(mountNavigation);
