import {loadAdminConfig} from '../server/config.mjs';
import {createHostedAuthProvider} from '../server/auth/provider.mjs';
import {createProviderEffects} from '../server/auth/provider-effects.mjs';
import {createFirstAdminService} from '../server/auth/first-admin.mjs';
import {runBootstrapCommand} from '../server/auth/bootstrap-command.mjs';

const help=`First-administrator maintainer command for the selected development project.
  prepare --email ADDRESS --confirm-project REF
  issue --id UUID --send-email true --confirm-project REF
  status --id UUID --confirm-project REF
  cancel --id UUID --confirm-project REF

The issue command sends one invitation using Supabase Auth's configured sender.
It requires ADMIN_ENABLE_FIRST_ADMIN_EMAIL=confirmed-development-only and a
configured Invite User email template that appends {{ .TokenHash }} to {{ .RedirectTo }}.
No passwords, tokens or action links are accepted or printed. A lost provider
response requires review; do not retry by creating a second invitation.
`;
if(process.argv.length===3&&process.argv[2]==='--help'){process.stdout.write(help);process.exit(0);}
try{
 const config=loadAdminConfig(process.env),provider=createHostedAuthProvider(config),effects=createProviderEffects(config,{rpc:provider.rpc});
 const service=createFirstAdminService(config,{provider,rpc:provider.rpc,effects,...(config.firstAdminEmailEnabled?{sendInvite:(email,redirectTo)=>provider.inviteUserByEmail(email,redirectTo)}:{})});
 const result=await runBootstrapCommand(process.argv.slice(2),{config,service});
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}catch{
 process.stderr.write('First-administrator command stopped safely. Check the project confirmation, local gates and pending invitation status. Do not repeat an issue command after an uncertain provider response.\n');
 process.exitCode=1;
}
