import test from 'node:test';import assert from 'node:assert/strict';import {validateHomepage} from '../../src/content/schema.mjs';import {homepageContent} from '../../src/content/seed.mjs';
test('homepage validators identify the real input path without changing rejection messages',()=>{
 const cases=[['company.email','bad','Email:'],['company.hectares',0,'Farmland area:'],['company.values.1','','Value:'],['products.1.title','','Title:'],['services.2.description','','Description:'],['services.0.enquiry','','Enquiry label:']];
 for(const [path,value,prefix]of cases){const payload=structuredClone(homepageContent),parts=path.split('.'),key=parts.pop(),parent=parts.reduce((current,key)=>current[key],payload);parent[key]=value;assert.throws(()=>validateHomepage(payload),error=>{assert.ok(error.message.startsWith(prefix));assert.equal(error.fieldPath,path);return true;});}
});
