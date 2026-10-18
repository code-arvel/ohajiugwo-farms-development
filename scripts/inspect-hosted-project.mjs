import {stat} from 'node:fs/promises';
import {loadAdminConfig} from '../server/config.mjs';
import {inspectHostedProject} from '../server/hosted-inspection.mjs';
try{
 const info=await stat('.env.admin');
 if((info.mode&0o077)!==0)throw new Error('Restrict .env.admin to owner-only access: chmod 600 .env.admin');
 const config=loadAdminConfig(process.env);
 const report=await inspectHostedProject(config);
 console.log(JSON.stringify(report,null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
