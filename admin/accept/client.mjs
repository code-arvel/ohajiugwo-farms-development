const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function parseInvitation(fragment,hadQuery=false){
 if(hadQuery||typeof fragment!=='string'||fragment.length>2048||!fragment.startsWith('#'))return null;
 const params=new URLSearchParams(fragment.slice(1));
 if([...params.keys()].length!==3||['id','nonce','token_hash'].some(key=>params.getAll(key).length!==1))return null;
 const id=params.get('id'),nonce=params.get('nonce'),tokenHash=params.get('token_hash');
 return uuid.test(id||'')&&/^[A-Za-z0-9_-]{43}$/.test(nonce||'')&&/^[A-Za-z0-9_-]{32,512}$/.test(tokenHash||'')?{id,nonce,tokenHash}:null;
}
export function passwordError(password,confirmation){
 if(typeof password!=='string'||[...password].length<12)return 'Use at least 12 characters for your password.';
 if(new TextEncoder().encode(password).length>72)return 'This password is too long. Use fewer characters.';
 if(password!==confirmation)return 'Re-enter the confirmation below so it matches your new password.';
 return '';
}
const invalidMessage='This invitation could not be accepted. It may be invalid, expired or already used. Ask the maintainer for a new invitation.';
// Link context exists only in this closure. There is no browser storage or automatic mutation retry.
export function createAcceptanceController({fragment,hadQuery=false,view,fetchImpl=fetch}){
 let invitation=parseInvitation(fragment,hadQuery),phase='checking',disposed=false,busy=false;
 fragment='';
 const abort=new AbortController();
 function render(next,message='',fieldErrors={},title=''){
  if(disposed)return;phase=next;
  view.render({phase:next,message,fieldErrors,title});
 }
 function complete(){invitation=null;render('complete','You can close this page. You have not been signed in automatically.');}
 function invalid(){invitation=null;render('invalid',invalidMessage);}
 async function session(){
  const response=await fetchImpl('/admin/accept',{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:abort.signal,headers:{Accept:'application/json','x-first-admin-invitation-id':invitation.id}});
  if(!response.ok)throw new Error('unavailable');
  const data=await response.json();
  if(data.completed===true)return data;
  if(!/^[A-Za-z0-9_-]{43}$/.test(data.csrfToken||''))throw new Error('unavailable');
  return data;
 }
 async function start(){
  if(!invitation){invalid();return;}
  try{const data=await session();if(disposed)return;if(data.completed)complete();else render('ready');}
  catch{render('retry','The connection could not be confirmed. Try again when you are ready.');}
 }
 async function submit({password,confirmation}){
  if(disposed||busy||!invitation||['invalid','complete'].includes(phase))return;
  const error=passwordError(password,confirmation);if(error){
   const tooShort=typeof password!=='string'||[...password].length<12;
   const passwordInvalid=tooShort||new TextEncoder().encode(password).length>72;
   render('ready',error,passwordInvalid?{password:error}:{confirmation:'Enter the same password in both fields.'},passwordInvalid?(tooShort?'Use a longer password':'This password is too long'):'Your passwords don’t match');return;
  }
  busy=true;render('busy','Checking your invitation and setting your password…');
  try{
   const context=await session();if(disposed)return;if(context.completed){complete();return;}
   const response=await fetchImpl('/admin/accept',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal:abort.signal,headers:{Accept:'application/json','Content-Type':'application/json','x-csrf-token':context.csrfToken},body:JSON.stringify({...invitation,password})});
   if(disposed)return;
   if(response.status===400){invalid();return;}
   if(!response.ok){const error=new Error('unavailable');error.status=response.status;throw error;}
   const result=await response.json();
   if(result.activated!==true||result.signInRequired!==true||typeof result.providerCleanupPending!=='boolean')throw new Error('unavailable');
   complete();
  }catch(error){
   if(disposed)return;
   // A body may have been lost after Set-Cookie arrived. A safe GET can confirm completion without replaying POST.
   try{const receipt=await session();if(disposed)return;if(receipt.completed){complete();return;}}catch{}
   render('retry',error.status===429?'Too many attempts. Wait 15 minutes before trying again.':'Keep this tab open and try again. Your entries are still here. Do not refresh the page.');
  }finally{busy=false;}
 }
 function dispose(){invitation=null;disposed=true;abort.abort();view.render({phase:'closed',message:'For your privacy, reopen your original invitation to continue.'});}
 return {start,submit,dispose};
}

export function mountAcceptance({fragment,hadQuery=false,document:doc=document,fetchImpl=fetch}){
 const form=doc.getElementById('accept-form'),password=doc.getElementById('password'),confirmation=doc.getElementById('confirmation');
 const button=doc.getElementById('accept-submit'),message=doc.getElementById('accept-message'),heading=doc.getElementById('accept-heading');
 const intro=doc.getElementById('accept-intro'),title=doc.getElementById('accept-message-title'),copy=doc.getElementById('accept-message-copy');
 const passwordFeedback=doc.getElementById('password-error'),confirmationFeedback=doc.getElementById('confirmation-error'),show=doc.getElementById('show-passwords');
 const view={render({phase,message:text,fieldErrors={},title:validationTitle=''}){
  const terminal=['complete','invalid','closed'].includes(phase);
  form.hidden=terminal;form.setAttribute('aria-busy',String(phase==='busy'));button.disabled=['busy','checking'].includes(phase);
  button.textContent=phase==='busy'?'Setting up…':phase==='retry'?'Try again':'Set password and accept';
  password.disabled=confirmation.disabled=phase==='busy';
  intro.hidden=terminal||phase==='retry';
  heading.textContent=phase==='complete'?'Invitation accepted.':phase==='invalid'?'This invitation can’t be used.':phase==='closed'?'Invitation closed':phase==='retry'?'Let’s try again.':'Set your password.';
  const error=phase==='invalid'||(phase==='ready'&&Boolean(text));
  message.hidden=!text;message.dataset.state=error?'error':phase;
  message.setAttribute('role',error?'alert':'status');message.setAttribute('aria-live',error?'assertive':'polite');
  title.textContent=validationTitle||(phase==='complete'?'Your administrator access is ready':phase==='invalid'?'A fresh invitation is needed':phase==='retry'?'We couldn’t confirm completion':phase==='closed'?'Reopen your invitation':phase==='busy'?'Please wait':'');
  copy.textContent=text;
  // SVG elements do not implement HTMLElement.hidden; toggle the actual attribute.
  for(const kind of ['error','retry','success','info'])doc.getElementById(`accept-${kind}-icon`).toggleAttribute('hidden',kind!==(error?'error':phase==='retry'?'retry':phase==='complete'?'success':'info'));
  for(const [key,input,feedback] of [['password',password,passwordFeedback],['confirmation',confirmation,confirmationFeedback]]){
   const fieldError=fieldErrors[key]||'';feedback.textContent=fieldError;feedback.hidden=!fieldError;
   if(fieldError)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
   const description=[key==='password'?'password-help':'',fieldError?`${key}-error`:''].filter(Boolean).join(' ');
   if(description)input.setAttribute('aria-describedby',description);else input.removeAttribute('aria-describedby');
  }
  if(terminal){password.value='';confirmation.value='';password.type=confirmation.type='password';show.checked=false;}
  if(fieldErrors.password)password.focus();else if(fieldErrors.confirmation)confirmation.focus();
  else if(phase==='complete'||phase==='closed')heading.focus();else if(phase==='invalid'||phase==='retry')message.focus();
 }};
 const controller=createAcceptanceController({fragment,hadQuery,view,fetchImpl});fragment='';
 form.addEventListener('submit',event=>{event.preventDefault();void controller.submit({password:password.value,confirmation:confirmation.value});});
 show.addEventListener('change',event=>{password.type=confirmation.type=event.target.checked?'text':'password';});
 doc.defaultView.addEventListener('pagehide',()=>controller.dispose(),{once:true});
 void controller.start();
 return controller;
}
