import test from 'node:test';import assert from 'node:assert/strict';
const module=await import('../../admin/media/upload-validation.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
test('upload validation names missing, unsupported and oversized inputs before any network request',()=>{
 assert.match(module.uploadValidationError(null),/Choose/);assert.match(module.uploadValidationError({type:'image/svg+xml',size:100}),/JPEG, PNG or WebP/);assert.match(module.uploadValidationError({type:'image/png',size:10_485_761}),/10 MB/);assert.match(module.uploadValidationError({type:'image/png',size:0}),/empty/);assert.equal(module.uploadValidationError({type:'image/png',size:10_485_760}),'');
});
