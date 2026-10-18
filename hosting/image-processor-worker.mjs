import {createImageProcessor} from '../server/media/image-processor.mjs';
import {privateHeaders} from '../server/security.mjs';
const MAX_INPUT=10_485_760,MAX_OUTPUT=10_485_760;
const json=(status=400)=>new Response('Image processing unavailable.',{status,headers:{...privateHeaders,'Content-Type':'text/plain; charset=utf-8'}});
export function createImageProcessorRequestHandler(images){
 let processor;try{processor=createImageProcessor(images);}catch{return async()=>json(503);}
 return async request=>{
  const url=new URL(request.url);
  if(url.origin!=='https://farm-image-processor.internal'||url.pathname!=='/process'||url.search||request.method!=='POST')return json(404);
  const contentType=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase(),dimensionText=request.headers.get('x-max-dimension');
  if(!['image/jpeg','image/png','image/webp'].includes(contentType)||!/^\d{1,4}$/.test(dimensionText||''))return json(400);
  let bytes;try{bytes=new Uint8Array(await request.arrayBuffer());}catch{return json(400);}
  if(bytes.byteLength<12||bytes.byteLength>MAX_INPUT)return json(413);
  let result;try{result=await processor.process(bytes,{contentType,maxDimension:Number(dimensionText)});}catch{return json(503);}
  if(result.original.byteLength<1||result.original.byteLength>MAX_OUTPUT||result.preview.byteLength<1||result.preview.byteLength>MAX_OUTPUT)return json(503);
  const combined=new Uint8Array(result.original.byteLength+result.preview.byteLength);combined.set(result.original);combined.set(result.preview,result.original.byteLength);
  return new Response(combined,{status:200,headers:{...privateHeaders,'Content-Type':'application/octet-stream','Content-Length':String(combined.byteLength),'x-image-width':String(result.width),'x-image-height':String(result.height),'x-original-size':String(result.original.byteLength),'x-preview-size':String(result.preview.byteLength)}});
 };
}
export default {async fetch(request,env){return createImageProcessorRequestHandler(env?.IMAGES)(request);}};
