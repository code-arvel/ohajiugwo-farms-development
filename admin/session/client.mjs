const token=value=>/^[A-Za-z0-9_-]{43}$/.test(value||'');
const validSession=value=>token(value?.csrfToken)&&typeof value?.user?.id==='string'&&typeof value.user.email==='string';
// Only same-origin fixed routes. No provider credentials or browser storage.
export function createSessionController({mode,csrfToken='',user,view,onNavigate,fetchImpl=fetch}){
 if(!['login','protected','reauthenticate'].includes(mode))throw new Error('Invalid screen mode.');
 const confirm=mode==='reauthenticate';
 let disposed=false,busy=false,blocked=false;const abort=new AbortController();
 const render=(phase,title='',message='',fieldErrors={})=>{if(!disposed)view.render({phase,title,message,fieldErrors});};
 const request=(path,method='GET',body,csrf)=>fetchImpl(path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:abort.signal,headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json','x-csrf-token':csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const complete=()=>{if(disposed)return;csrfToken='';render('complete');onNavigate(mode==='login'?'/admin/':'/admin/login');};
 function start(){render('ready');}
 async function submit({email='',password=''}={}){
  if(disposed||busy||blocked)return;
  if(mode==='login'){
   const fieldErrors={};if(typeof email!=='string'||email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.trim()))fieldErrors.email='Enter a valid email address.';
   if(typeof password!=='string'||!password)fieldErrors.password='Enter your password.';else if(password.length>1024)fieldErrors.password='This password is too long.';
   if(Object.keys(fieldErrors).length){render('error','Check your sign-in details','Correct the fields below, then try again.',fieldErrors);return;}
   email=email.trim().toLowerCase();
  }else if(confirm&&(typeof password!=='string'||!password||password.length>1024)){render('error','Check your password','Correct the field below, then try again.',{password:!password?'Enter your current password.':'This password is too long.'});return;}
  if(mode!=='login'&&!token(csrfToken)){if(confirm)blocked=true;render(confirm?'reload':'error','Reload this page','Your request could not be verified. Reload this page before trying again.');return;}
  busy=true;render('busy',mode==='login'?'Signing in…':confirm?'Confirming password…':'Signing out…','Please wait.');
  try{
   if(mode==='login'){
    const contextResponse=await request('/admin/api/login'),context=await contextResponse.json();if(disposed)return;
    if(!contextResponse.ok||!token(context.csrfToken))throw new Error();
    const response=await request('/admin/api/login','POST',{email,password},context.csrfToken);if(disposed)return;
    if(response.status===401){render('error','Unable to sign in','Check your email and password, then try again.');return;}
    if(response.status===429){render('error','Too many attempts','Wait 15 minutes before trying again.');return;}
    if(response.status===403){render('retry','Please try again','Your request could not be verified. Try again to start a fresh sign-in request.');return;}
    const result=await response.json();if(!response.ok||!validSession(result))throw new Error();complete();
   }else if(confirm){
    const response=await request('/admin/api/reauthenticate','POST',{password},csrfToken);if(disposed)return;
    if(response.status===401){
     // Only an unchanged live context is correctable; a failed/rotated outcome needs reload.
     const checked=await request('/admin/api/session'),context=await checked.json();if(disposed)return;
     if(!checked.ok||!validSession(context)||context.csrfToken!==csrfToken||context.user.id!==user?.id||context.user.email!==user?.email)throw new Error();
     render('error','Unable to confirm your password','Check your current password and try again.',{password:'Enter your current password and try again.'});return;
    }
    if(response.status===429){render('error','Too many attempts','Wait 15 minutes before trying again.');return;}
    if(response.status===403)throw new Error();
    const result=await response.json();if(disposed)return;if(!response.ok||!validSession(result)||result.user.id!==user?.id||result.user.email!==user?.email||result.csrfToken===csrfToken||typeof result.providerCleanupPending!=='boolean')throw new Error();
    csrfToken='';blocked=true;render('confirmed','Password confirmed','Your identity has been confirmed. Return to administration to continue.');
   }else{
    const response=await request('/admin/api/logout','POST',{},csrfToken);if(disposed)return;
    if(response.status===403){render('error','Reload this page','Your request could not be verified. Reload this page before trying to sign out again.');return;}
    const result=await response.json();if(!response.ok||result.signedOut!==true||typeof result.providerCleanupPending!=='boolean')throw new Error();complete();
   }
  }catch{
   if(disposed)return;
   if(confirm){blocked=true;csrfToken='';render('reload','Reload before trying again','We couldn’t confirm the result. Reload password confirmation to check your session and start with a fresh request. Do not resubmit this form.');return;}
   // A login body can be lost after its cookie arrives. Only a matching, verified GET recovers it.
   if(mode==='login')try{const response=await request('/admin/api/session'),result=await response.json();if(disposed)return;if(response.ok&&validSession(result)&&result.user.email.toLowerCase()===email){complete();return;}}catch{}
   render('retry',mode==='login'?'We couldn’t confirm sign-in':'We couldn’t confirm sign-out',mode==='login'?'Keep this tab open and try again. Your entries are still here.':'Try signing out again. Until it is confirmed, do not leave this device unattended.');
  }finally{busy=false;}
 }
 function dispose(){disposed=true;csrfToken='';abort.abort();view.render({phase:'closed',title:'Session page closed',message:'Reload this page to continue.',fieldErrors:{}});}
 return {start,submit,dispose};
}

export function mountSession({mode,document:doc=document,fetchImpl=fetch}){
 const form=doc.getElementById('session-form'),button=doc.getElementById('session-submit'),message=doc.getElementById('session-message'),heading=doc.getElementById('session-heading');
 const email=doc.getElementById('email'),password=doc.getElementById('password'),identity=doc.getElementById('session-identity'),show=doc.getElementById('show-passwords');
 const meta=doc.querySelector('meta[name="admin-csrf-token"]'),csrfToken=meta?.content||'';meta?.remove();
 const idMeta=doc.querySelector('meta[name="admin-user-id"]'),user={id:idMeta?.content||'',email:identity?.textContent||''};idMeta?.remove();
 const confirm=mode==='reauthenticate',reload=doc.getElementById('session-reload'),intro=doc.getElementById('session-intro');
 const view={render({phase,title='',message:text='',fieldErrors={}}){
  const terminal=['complete','closed','confirmed','reload'].includes(phase);form.hidden=terminal;form.setAttribute('aria-busy',String(phase==='busy'));button.disabled=phase==='busy';
  button.textContent=phase==='busy'?(mode==='login'?'Signing in…':confirm?'Confirming password…':'Signing out…'):confirm?'Confirm password':mode==='login'?(phase==='retry'?'Try again':'Sign in'):phase==='retry'?'Try signing out again':'Sign out';
  message.hidden=!text;message.dataset.state=phase==='reload'?'retry':phase;if(reload)reload.hidden=phase!=='reload';message.setAttribute('role',phase==='error'?'alert':'status');message.setAttribute('aria-live',phase==='error'?'assertive':'polite');doc.getElementById('session-message-title').textContent=title;doc.getElementById('session-message-copy').textContent=text;
  for(const [key,input] of [['email',email],['password',password]])if(input){input.disabled=phase==='busy';const feedback=doc.getElementById(key+'-error'),error=fieldErrors[key];feedback.hidden=!error;feedback.textContent=error||'';if(error){input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',key+'-error');}else{input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');}if(terminal)input.value='';}
  if(terminal){if(intro&&(confirm||phase==='closed'))intro.hidden=true;if(password)password.type='password';if(show)show.checked=false;if(identity)identity.textContent='';heading.textContent=phase==='closed'?'Session page closed':phase==='confirmed'?'Password confirmed.':phase==='reload'?'Check your session.':'Please wait…';}
  if(fieldErrors.email)email.focus();else if(fieldErrors.password)password.focus();else if(['error','retry','closed','reload','confirmed'].includes(phase))message.focus();
 }};
 const controller=createSessionController({mode,csrfToken,user,view,fetchImpl,onNavigate:path=>doc.defaultView.location.replace(path)});
 form.addEventListener('submit',event=>{event.preventDefault();void controller.submit({email:email?.value,password:password?.value});});
 show?.addEventListener('change',()=>{password.type=show.checked?'text':'password';});
 doc.defaultView.addEventListener('pagehide',()=>controller.dispose(),{once:true});
 controller.start();return controller;
}
