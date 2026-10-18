// Maintainer command only; no HTTP setup endpoint and no credential logging.
import {stat} from 'node:fs/promises';
import {loadAdminConfig} from '../server/config.mjs';
import {configurePhotoBucket} from '../server/storage-setup.mjs';
try{
 if(((await stat('.env.admin')).mode&0o077)!==0)throw new Error('Run chmod 600 .env.admin before using server credentials.');
 const result=await configurePhotoBucket(loadAdminConfig(process.env));
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
