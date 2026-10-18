import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaService} from '../../server/media/media-service.mjs';

const actor={cookieHash:'a'.repeat(43)};
function fixture(){
 const calls=[],objects=new Map();let current={...actor};
 const auth={authenticate:async(_request,options={})=>{if(options.requireMutation&&!current)throw Object.assign(new Error('denied'),{status:401});return current;}};
 const reservation={id:'11111111-1111-4111-8111-111111111111',media_id:'22222222-2222-4222-8222-222222222222',version_id:'33333333-3333-4333-8333-333333333333',upload_path:'staging/opaque',original_path:'media/opaque/original.webp',preview_path:'media/opaque/preview.webp'};
 const rpc=async(name,params)=>{calls.push({name,params});if(name==='farm_media_reserve')return reservation;if(name==='farm_media_claim')return true;if(name==='farm_media_ready')return true;if(name==='farm_media_quarantine')return true;if(name==='farm_media_list')return[];throw Error('unexpected RPC');};
 const storage={put:async(path,bytes,type)=>{objects.set(path,{bytes,type});},delete:async paths=>{for(const path of paths)objects.delete(path);},get:async path=>objects.get(path)};
 const processor={process:async(bytes,{contentType})=>({original:new Uint8Array([1,2,3]),preview:new Uint8Array([4,5]),contentType:'image/webp',width:800,height:600,sourceType:contentType})};
 return {service:createMediaService({auth,rpc,storage,processor}),calls,objects,storage,reservation,setActor:value=>current=value};
}
const png=()=>new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);

test('private media upload reserves a scoped slot, sanitizes through the processor and publishes only after both private objects exist',async()=>{
 const f=fixture(),result=await f.service.upload(new Request('https://farm.test/admin/api/media'),{bytes:png(),contentType:'image/png'});
 assert.equal(result.state,'ready');assert.equal(result.mediaId,'22222222-2222-4222-8222-222222222222');assert.equal(result.previewPath,undefined);
 assert.deepEqual(f.calls.map(call=>call.name),['farm_media_reserve','farm_media_claim','farm_media_ready']);
 assert.deepEqual([...f.objects.keys()].sort(),['media/opaque/original.webp','media/opaque/preview.webp']);
 assert.ok(f.calls.every(call=>call.params.p_actor_cookie_hash===actor.cookieHash));
 assert.equal(f.calls.at(-1).params.p_checksum.length,64);assert.equal(f.calls.at(-1).params.p_mime_type,'image/webp');
});

test('invalid signatures and oversized photos fail before a reservation or Storage write',async()=>{
 const f=fixture();await assert.rejects(()=>f.service.upload(new Request('https://farm.test/admin/api/media'),{bytes:new Uint8Array([1,2,3]),contentType:'image/png'}));
 await assert.rejects(()=>f.service.upload(new Request('https://farm.test/admin/api/media'),{bytes:new Uint8Array(10_485_761),contentType:'image/png'}));
 assert.deepEqual(f.calls,[]);assert.equal(f.objects.size,0);
});

test('a failed transform quarantines the reservation and removes staged or partial private objects',async()=>{
 const f=fixture();f.service= createMediaService({auth:{authenticate:async()=>actor},rpc:async(name,params)=>{f.calls.push({name,params});return name==='farm_media_reserve'?f.reservation:true;},storage:f.storage,processor:{process:async()=>{throw Error('decoder detail must not escape');}}});
 await assert.rejects(()=>f.service.upload(new Request('https://farm.test/admin/api/media'),{bytes:png(),contentType:'image/png'}),error=>!error.message.includes('decoder detail'));
 assert.deepEqual(f.calls.map(call=>call.name),['farm_media_reserve','farm_media_claim','farm_media_quarantine']);
 assert.equal(f.objects.size,0);
});

test('a lost ready acknowledgement preserves final objects instead of deleting a possibly published preview',async()=>{
 const f=fixture();f.service=createMediaService({auth:{authenticate:async()=>actor},rpc:async(name,params)=>{f.calls.push({name,params});if(name==='farm_media_reserve')return f.reservation;if(name==='farm_media_ready')throw Error('ack lost');return true;},storage:f.storage,processor:{process:async()=>({original:new Uint8Array([1,2,3]),preview:new Uint8Array([4,5]),contentType:'image/webp',width:800,height:600})}});
 await assert.rejects(()=>f.service.upload(new Request('https://farm.test/admin/api/media'),{bytes:png(),contentType:'image/png'}));
 assert.deepEqual(f.calls.map(call=>call.name),['farm_media_reserve','farm_media_claim','farm_media_ready']);
 assert.deepEqual([...f.objects.keys()].sort(),['media/opaque/original.webp','media/opaque/preview.webp']);
});

test('private media list returns only validated display metadata and same-origin preview paths',async()=>{
 const f=fixture(),mediaId='22222222-2222-4222-8222-222222222222',versionId='33333333-3333-4333-8333-333333333333';
 f.service=createMediaService({auth:{authenticate:async()=>actor},rpc:async(name)=>name==='farm_media_list'?[{id:mediaId,versionId,metadata:{width:640,height:480,mimeType:'image/webp',byteSize:900,storagePath:'must-not-leak',exif:{gps:'private'}},createdAt:'2026-10-18T00:00:00Z'}]:true,storage:f.storage,processor:{process(){}}});
 const [item]=await f.service.list(new Request('https://farm.test/admin/api/media'));assert.deepEqual(item,{id:mediaId,versionId,metadata:{width:640,height:480,mimeType:'image/webp',byteSize:900},createdAt:'2026-10-18T00:00:00Z',previewUrl:`/admin/api/media/${mediaId}/${versionId}/preview`});
});

test('private media list rejects malformed identity and image metadata',async()=>{
 const f=fixture();f.service=createMediaService({auth:{authenticate:async()=>actor},rpc:async()=>[{id:'bad',versionId:'bad',metadata:{width:1,height:1,mimeType:'image/webp',byteSize:1}}],storage:f.storage,processor:{process(){}}});
 await assert.rejects(()=>f.service.list(new Request('https://farm.test/admin/api/media')),/photograph could not be processed/i);
});
