import {createHostedAuthProvider} from './auth/provider.mjs';
import {createProviderEffects} from './auth/provider-effects.mjs';
import {createAuthService} from './auth/sessions.mjs';
import {createFirstAdminService} from './auth/first-admin.mjs';
import {createInvitationAcceptanceService} from './auth/additional-admin-acceptance.mjs';
import {createFirstAdminBrowserHandler} from './auth/first-admin-screen.mjs';
import {createSessionBrowserHandler} from './auth/session-screen.mjs';
import {createAccountLifecycleService} from './auth/account-lifecycle.mjs';
import {createAccountsBrowserHandler} from './auth/accounts-screen.mjs';
import {createContentService} from './content/content-service.mjs';
import {createContentHandler} from './content/content-http.mjs';
import {createContentScreenHandler} from './content/content-screen.mjs';
import {createMediaService} from './media/media-service.mjs';
import {createMediaHandler} from './media/media-http.mjs';
import {createMediaScreenHandler} from './media/media-screen.mjs';
import {createPrivateStorageProvider} from './media/storage-provider.mjs';
import {bundledBrowserAssets} from './browser-assets.mjs';

// Shared composition for Pages and local integration. No bootstrap issue/prepare HTTP route.
export function createAdminApplication(config,{provider, rpc,auth,firstAdmin,assets=bundledBrowserAssets,getClientIp=()=> 'unknown',storage,mediaProcessor}={}){
 const customFirstAdmin=firstAdmin!=null;
 provider??=createHostedAuthProvider(config);rpc??=provider.rpc;
 const effects=createProviderEffects(config,{rpc});
 auth??=createAuthService(config,{provider,rpc,effects});firstAdmin??=createFirstAdminService(config,{provider,rpc,effects});
 const session=createSessionBrowserHandler(config,{service:auth,assets,getClientIp});
 const acceptanceService=customFirstAdmin?firstAdmin:createInvitationAcceptanceService(config,{provider,rpc,effects,firstAdmin});
 const acceptance=createFirstAdminBrowserHandler(config,{service:acceptanceService,assets,getClientIp});
 const accounts=config.accountLifecycleEnabled?createAccountsBrowserHandler(config,{auth,service:createAccountLifecycleService(config,{auth,rpc,provider,effects}),assets}):null;
 const content=createContentHandler(config,{service:createContentService({auth,provider})});
 const mediaAvailable=config.privateMediaEnabled===true&&mediaProcessor!=null;
 const contentScreen=createContentScreenHandler(config,{auth,service:createContentService({auth,provider}),assets,privateMediaEnabled:mediaAvailable});
 const mediaService=mediaAvailable?createMediaService({auth,rpc,storage:storage||createPrivateStorageProvider(config),processor:mediaProcessor}):null;
 const media=mediaAvailable?createMediaHandler(config,{service:mediaService}):null;
 const mediaScreen=mediaAvailable?createMediaScreenHandler({auth,assets}):null;
 return request=>{const path=new URL(request.url).pathname;if(['/admin/accept','/admin/callback'].includes(path))return acceptance(request);if(media&&(path==='/admin/api/media'||path.startsWith('/admin/api/media/')))return media(request);if(mediaScreen&&(path==='/admin/media'||path.startsWith('/admin/media/')))return mediaScreen(request);if(path==='/admin/api/content'||path.startsWith('/admin/api/content/'))return content(request);if(path==='/admin/content'||path.startsWith('/admin/content/'))return contentScreen(request);if(accounts&&(path==='/admin/accounts'||path.startsWith('/admin/api/accounts')||path.startsWith('/admin/accounts/')))return accounts(request);return session(request);};
}
