import {stat} from 'node:fs/promises';
import {loadAdminConfig} from '../server/config.mjs';
import {probeAuthenticatedNonmemberAccess} from '../server/stage2/nonmember-access-probe.mjs';

try{
 if(((await stat('.env.admin')).mode&0o077)!==0)throw new Error('Restrict .env.admin permissions before using server credentials.');
 console.log(JSON.stringify(await probeAuthenticatedNonmemberAccess(loadAdminConfig(process.env)),null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
