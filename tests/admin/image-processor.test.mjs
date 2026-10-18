import test from 'node:test';import assert from 'node:assert/strict';
import {createImageProcessor} from '../../server/media/image-processor.mjs';
function binding({width=4000,height=2000,format='image/jpeg'}={}){const transforms=[];return{transforms,images:{info:async stream=>{assert.ok(stream instanceof ReadableStream);return{width,height,format};},input:stream=>{assert.ok(stream instanceof ReadableStream);let options;return{transform:value=>{options=value;return{output:async output=>{transforms.push({options,output});return{response:async()=>new Response(new Uint8Array([82,73,70,70]),{headers:{'content-type':'image/webp'}})};}};}};}}};}
test('image processor applies pixel limits and emits bounded WebP original plus preview',async()=>{
 const mock=binding(),processor=createImageProcessor(mock.images),result=await processor.process(new Uint8Array(12),{maxDimension:2048,contentType:'image/jpeg'});
 assert.equal(result.contentType,'image/webp');assert.equal(result.width,2048);assert.equal(result.height,1024);assert.deepEqual(mock.transforms.map(item=>item.options),[{width:2048,height:2048,fit:'scale-down'},{width:960,height:960,fit:'scale-down'}]);assert.ok(mock.transforms.every(item=>item.output.format==='image/webp'&&item.output.anim===false));
});
test('image processor rejects unsupported or excessive decoded images before transformations',async()=>{
 const unknown=binding({format:'image/svg+xml'});await assert.rejects(()=>createImageProcessor(unknown.images).process(new Uint8Array(12)));
 const tooLarge=binding({width:8000,height:4000});await assert.rejects(()=>createImageProcessor(tooLarge.images).process(new Uint8Array(12)));assert.equal(tooLarge.transforms.length,0);
});
