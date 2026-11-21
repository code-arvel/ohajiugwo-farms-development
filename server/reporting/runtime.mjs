import {createReportingService} from './service.mjs';import {createGA4Adapter,createBetterStackAdapter,createServiceAccountTokenProvider} from './providers.mjs';
// Server-only construction. Merely loading this module sends no provider requests.
export function configuredReporting(config,{fetcher=fetch}={}){
 const settings=config.reporting||{};let analytics=null,availability=null;const unavailable={read:async()=>({state:'error',source:'Incomplete reporting configuration',observedAt:null})};
 if(settings.propertyId||settings.clientEmail||settings.privateKey){try{analytics=createGA4Adapter({propertyId:settings.propertyId,getAccessToken:createServiceAccountTokenProvider({clientEmail:settings.clientEmail,privateKey:settings.privateKey,fetcher}),fetcher});}catch{analytics=unavailable;}}
 if(settings.monitorId||settings.monitorToken){try{availability=createBetterStackAdapter({monitorId:settings.monitorId,token:settings.monitorToken,fetcher});}catch{availability=unavailable;}}
 return createReportingService({analytics,availability,collectionStart:settings.collectionStart||null});
}
