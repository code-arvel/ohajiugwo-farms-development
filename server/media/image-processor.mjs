const MAX_PIXELS=24_000_000,MAX_SIDE=12_000,MAX_OUTPUT=10_485_760;
const unavailable=()=>new Error('Image processing is unavailable.');
export function createImageProcessor(images){
 if(!images||typeof images.info!=='function'||typeof images.input!=='function')throw unavailable();
 async function encode(bytes,width,height){
  const result=await images.input(new Blob([bytes]).stream()).transform({width,height,fit:'scale-down'}).output({format:'image/webp',quality:84,anim:false});
  const response=await result.response();if(!response.ok||response.headers.get('content-type')!=='image/webp')throw unavailable();
  const output=new Uint8Array(await response.arrayBuffer());if(output.length<1||output.length>MAX_OUTPUT)throw unavailable();return output;
 }
 return {
  async process(bytes,{maxDimension=2048,contentType}={}){
   if(!(bytes instanceof Uint8Array)||bytes.byteLength<12||bytes.byteLength>MAX_OUTPUT||!Number.isInteger(maxDimension)||maxDimension<1||maxDimension>MAX_SIDE)throw unavailable();
   let info;try{info=await images.info(new Blob([bytes]).stream());}catch{throw unavailable();}
   const width=info?.width,height=info?.height;
   const format=String(info?.format||'').toLowerCase().replace(/^image\//,'').replace(/^jpg$/,'jpeg');
   const expected=contentType==='image/jpeg'?'jpeg':contentType==='image/png'?'png':contentType==='image/webp'?'webp':'';
   if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>MAX_SIDE||height>MAX_SIDE||width*height>MAX_PIXELS||!['jpeg','png','webp'].includes(format)||format!==expected)throw unavailable();
   const original=await encode(bytes,maxDimension,maxDimension);
   const preview=await encode(bytes,960,960);
   const scale=Math.min(1,maxDimension/width,maxDimension/height);
   return {original,preview,contentType:'image/webp',width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
  },
 };
}
