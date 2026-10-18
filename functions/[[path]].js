import {handleAdminRequest} from '../server/handler.mjs';
import {createImageProcessorClient} from '../server/media/image-processing-client.mjs';
// Cloudflare supplies CF-Connecting-IP at its edge; Node preview/tests inject their own transport IP.
export const onRequest = (context,dependencies={}) => handleAdminRequest(context.request,context.env,{getClientIp:request=>request.headers.get('CF-Connecting-IP')||'unknown',...dependencies,mediaProcessor:dependencies.mediaProcessor??(context.env.MEDIA_PROCESSOR?createImageProcessorClient(context.env.MEDIA_PROCESSOR):undefined)});
