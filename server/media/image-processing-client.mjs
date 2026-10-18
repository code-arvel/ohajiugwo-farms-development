const MAX_INPUT=10_485_760,MAX_OUTPUT=10_485_760;
const unavailable=()=>new Error('Image processing is unavailable.');
export function createImageProcessorClient(service){
 if(!service||typeof service.fetch!=='function')throw unavailable();
 return {async process(bytes,{contentType,maxDimension=4096}={}){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<12||bytes.byteLength>MAX_INPUT||!['image/jpeg','image/png','image/webp'].includes(contentType)||!Number.isInteger(maxDimension)||maxDimension<1||maxDimension>4096)throw unavailable();
  let response;try{response=await service.fetch(new Request('https://farm-image-processor.internal/process',{method:'POST',headers:{'Content-Type':contentType,'X-Max-Dimension':String(maxDimension)},body:bytes}));}catch{throw unavailable();}
  if(!response.ok||response.headers.get('content-type')!=='application/octet-stream')throw unavailable();
  const width=Number(response.headers.get('x-image-width')),height=Number(response.headers.get('x-image-height')),
   originalSize=Number(response.headers.get('x-original-size')),previewSize=Number(response.headers.get('x-preview-size'));
  if(!Number.isInteger(width)||width<1||width>maxDimension||!Number.isInteger(height)||height<1||height>maxDimension||!Number.isInteger(originalSize)||originalSize<1||originalSize>MAX_OUTPUT||!Number.isInteger(previewSize)||previewSize<1||previewSize>MAX_OUTPUT)throw unavailable();
  let combined;try{combined=new Uint8Array(await response.arrayBuffer());}catch{throw unavailable();}
  if(combined.byteLength!==originalSize+previewSize)throw unavailable();
  return {original:combined.slice(0,originalSize),preview:combined.slice(originalSize),contentType:'image/webp',width,height};
 }};
}
