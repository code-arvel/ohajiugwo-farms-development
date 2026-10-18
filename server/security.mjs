// Portable Web Crypto primitives shared by the local server and Pages Functions.
const encoder=new TextEncoder();
const bytes=value=>encoder.encode(value);
const encode=value=>btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=value=>{if(!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('Invalid encrypted session.');return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));};
const keyBytes=hex=>{if(!/^[a-f0-9]{64}$/i.test(hex))throw new Error('Invalid encryption key.');return Uint8Array.from(hex.match(/../g),v=>parseInt(v,16));};
const aesKey=hex=>crypto.subtle.importKey('raw',keyBytes(hex),'AES-GCM',false,['encrypt','decrypt']);
export const newToken=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
export async function sessionDigest(token){return encode(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(token))));}
export async function seal(value,key,sessionId){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(sessionId)},await aesKey(key),bytes(JSON.stringify(value)));
 return `v1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}
export async function unseal(value,key,sessionId){
 const parts=value.split('.');if(parts.length!==3||parts[0]!=='v1')throw new Error('Invalid encrypted session.');
 const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(parts[1]),additionalData:bytes(sessionId)},await aesKey(key),decode(parts[2]));
 return JSON.parse(new TextDecoder().decode(plaintext));
}
const cookieName=config=>config.secureCookies?'__Secure-ohajiugwo_admin':'ohajiugwo_admin_local';
export function sessionCookie(token,config){
 if(token&&!/^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Invalid session token.');
 return `${cookieName(config)}=${token}; Path=/admin; Max-Age=${token?config.absoluteSeconds:0}; HttpOnly; SameSite=Lax${config.secureCookies?'; Secure':''}`;
}
export function parseSessionCookie(header,config){
 const matches=String(header||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName(config)+'='));
 if(matches.length!==1)return null;
 const value=matches[0].slice(cookieName(config).length+1);return /^[A-Za-z0-9_-]{43}$/.test(value)?value:null;
}
export async function checkMutation(request,config,expectedToken){
 if(request.headers.get('origin')!==config.origin||request.headers.get('sec-fetch-site')==='cross-site')throw new Error('Request origin rejected.');
 const supplied=request.headers.get('x-csrf-token');
 if(!/^[A-Za-z0-9_-]{43}$/.test(supplied||'')||!/^[A-Za-z0-9_-]{43}$/.test(expectedToken||''))throw new Error('Request token rejected.');
 const a=await sessionDigest(supplied),b=await sessionDigest(expectedToken);let diff=0;
 for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 if(diff!==0)throw new Error('Request token rejected.');
}
export const privateHeaders={
 'Cache-Control':'private, no-store, max-age=0',
 'Pragma':'no-cache',
 'X-Robots-Tag':'noindex, nofollow',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
 'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
