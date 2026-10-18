import {FirstAdminError} from './first-admin.mjs';

// Injectable maintainer command; never mounted as an HTTP route.
// The installed executable deliberately does not construct hosted dependencies yet.
export async function runBootstrapCommand(args,{config,service}){
 try{
  const [command,...rest]=args;
  if(!['prepare','issue','status','cancel'].includes(command)||rest.length%2)throw new FirstAdminError();
  const flags={};
  for(let i=0;i<rest.length;i+=2){
   const name=rest[i];if(!['--email','--id','--confirm-project'].includes(name)||Object.hasOwn(flags,name)||!rest[i+1]||rest[i+1].startsWith('--'))throw new FirstAdminError();
   flags[name]=rest[i+1];
  }
  if(config.environment!=='hosted-development'||flags['--confirm-project']!==config.projectRef)throw new FirstAdminError();
  if(command==='prepare'){
   if(!flags['--email']||flags['--id'])throw new FirstAdminError();
   return await service.prepare(flags['--email']);
  }
  if(!flags['--id']||flags['--email'])throw new FirstAdminError();
  return await service[command](flags['--id']);
 }catch(error){if(error instanceof FirstAdminError)throw error;throw new FirstAdminError(503);}
}
