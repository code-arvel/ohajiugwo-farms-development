import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageProcessorClient} from '../../server/media/image-processing-client.mjs';
import {createImageProcessorRequestHandler} from '../../hosting/image-processor-worker.mjs';

const input=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
function images(){return{async info(){return{width:800,height:600,format:'png'};},input(){return{transform(){return this;},async output(){return{async response(){return new Response(new Uint8Array([9,8,7]),{headers:{'content-type':'image/webp'}});}};}};}};}
test('internal image Worker validates the processing request and returns bounded derivatives privately',async()=>{
 const handler=createImageProcessorRequestHandler(images()),request=new Request('https://farm-image-processor.internal/process',{method:'POST',headers:{'Content-Type':'image/png','x-max-dimension':'640'},body:input}),response=await handler(request);
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(response.headers.get('x-image-width'),'640');assert.equal(response.headers.get('x-image-height'),'480');assert.equal(response.headers.get('x-original-size'),'3');assert.equal(response.headers.get('x-preview-size'),'3');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array([9,8,7,9,8,7]));
 assert.equal((await handler(new Request('https://farm-image-processor.internal/process'))).status,404);
 assert.equal((await handler(new Request('https://farm-image-processor.internal/process',{method:'POST',headers:{'Content-Type':'image/svg+xml','x-max-dimension':'640'},body:input}))).status,400);
});
test('Pages image client verifies internal response lengths and metadata before splitting derivatives',async()=>{
 let sent;
 const service={async fetch(request){sent=request;return new Response(new Uint8Array([1,2,3,4,5]),{headers:{'content-type':'application/octet-stream','x-image-width':'640','x-image-height':'480','x-original-size':'3','x-preview-size':'2'}});}};
 const result=await createImageProcessorClient(service).process(input,{contentType:'image/png',maxDimension:640});assert.equal(sent.url,'https://farm-image-processor.internal/process');assert.equal(sent.headers.get('x-max-dimension'),'640');assert.deepEqual(result,{original:new Uint8Array([1,2,3]),preview:new Uint8Array([4,5]),contentType:'image/webp',width:640,height:480});
});
test('Pages image client rejects malformed or oversized Worker responses without returning bytes',async()=>{
 const service={async fetch(){return new Response(new Uint8Array([1]),{headers:{'content-type':'application/octet-stream','x-image-width':'1','x-image-height':'1','x-original-size':'1','x-preview-size':'2'}});}};
 await assert.rejects(()=>createImageProcessorClient(service).process(input,{contentType:'image/png'}),/processing is unavailable/i);
 await assert.rejects(()=>createImageProcessorClient(service).process(new Uint8Array(10_485_761),{contentType:'image/png'}),/processing is unavailable/i);
});
