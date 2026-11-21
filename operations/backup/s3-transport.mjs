import { createHash, createHmac } from 'node:crypto';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
const safePath = value => typeof value === 'string' && !value.startsWith('/') && !/[\x00-\x1f\\?#]/.test(value) && !value.split('/').some(part => part === '..' || part === '.');
function failure(status) { const error = new Error(`Private backup storage request failed${status ? ` (${status})` : ''}`); if (status) error.status = status; return error; }
async function boundedBody(response, limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 16 * 1024 * 1024 + 32) throw new Error('Invalid private storage read limit');
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new Error('Private storage response exceeds limit');
  if (!response.body) return Buffer.alloc(0);
  const parts = []; let size = 0;
  const reader = response.body.getReader();
  try { for (;;) { const {value, done} = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error('Private storage response exceeds limit'); parts.push(Buffer.from(value)); } }
  catch (error) { await reader.cancel().catch(() => {}); if (error.message === 'Private storage response exceeds limit') throw error; throw failure(); }
  finally { reader.releaseLock(); }
  return Buffer.concat(parts);
}
function xmlText(value) {
  if (/<|&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/.test(value)) throw new Error('Invalid private storage XML');
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, name) => name[0] === '#' ? String.fromCodePoint(name[1] === 'x' ? parseInt(name.slice(2),16) : Number(name.slice(1))) : ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[name]);
}
function listing(xml, requiredPrefix) {
  if (/<!DOCTYPE|<!ENTITY|<Error[ >]/i.test(xml) || !/^\s*(?:<\?xml[^?]*\?>\s*)?<ListBucketResult(?:\s[^>]*)?>[\s\S]*<\/ListBucketResult>\s*$/.test(xml)) throw new Error('Invalid private storage listing');
  const truncated = xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/)?.[1];
  if (!truncated) throw new Error('Incomplete private storage listing');
  const keys = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(match => { const key = match[1].match(/<Key>([\s\S]*?)<\/Key>/); if (!key) throw new Error('Incomplete private storage listing'); return xmlText(key[1]); });
  if (keys.some(key => !key.startsWith(requiredPrefix))) throw new Error('Private storage listing escaped scope');
  const nextCursor = truncated === 'true' ? xmlText(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? '') : null;
  if (truncated === 'true' && !nextCursor) throw new Error('Incomplete private storage pagination');
  return {keys, nextCursor};
}

/** Real SigV4 HTTP implementation, restricted to one R2 account or AWS expected owner.
 * No request occurs until a transport method is explicitly called. */
export function createS3Transport({endpoint, accountId, region, bucket, prefix, accessKeyId, secretAccessKey, sessionToken, fetch:requestFetch=globalThis.fetch, now=()=>new Date(), timeoutMs=30000}) {
  let url; try { url = new URL(endpoint); } catch { throw new Error('Explicit HTTPS storage configuration required'); }
  const r2 = /^[a-f0-9]{32}$/.test(accountId ?? '') && url.hostname === `${accountId}.r2.cloudflarestorage.com` && region === 'auto';
  const aws = /^\d{12}$/.test(accountId ?? '') && /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region ?? '') && url.hostname === `s3.${region}.amazonaws.com`;
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash || (!r2 && !aws) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket ?? '') || !safePath(prefix) || !prefix?.endsWith('/') || !/^[A-Za-z0-9_-]{1,128}$/.test(accessKeyId ?? '') || typeof secretAccessKey !== 'string' || !secretAccessKey || /[\r\n]/.test(secretAccessKey) || (sessionToken && /[\r\n]/.test(sessionToken)) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000 || typeof requestFetch !== 'function') throw new Error('Explicit scoped HTTPS storage configuration required');
  function scope(requestBucket, key) { if (requestBucket !== bucket || !safePath(key) || !key.startsWith(prefix)) throw new Error('Private storage request escaped scope'); }
  async function request(method, key, query=[], body=Buffer.alloc(0), extraHeaders={}) {
    const date = now(); if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Invalid storage signing time');
    const timestamp = date.toISOString().replace(/[:-]|\.\d{3}/g,''), day = timestamp.slice(0,8);
    const canonicalUri = `/${encode(bucket)}${key ? `/${key.split('/').map(encode).join('/')}` : ''}`;
    const canonicalQuery = query.map(([k,v])=>[encode(k),encode(v)]).sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv)).map(([k,v])=>`${k}=${v}`).join('&');
    const payloadHash = sha256(body);
    const headers = {host:url.hostname,'x-amz-content-sha256':payloadHash,'x-amz-date':timestamp,...extraHeaders};
    if (sessionToken) headers['x-amz-security-token'] = sessionToken;
    if (aws) headers['x-amz-expected-bucket-owner'] = accountId;
    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map(name=>`${name}:${String(headers[name]).trim().replace(/\s+/g,' ')}\n`).join('');
    const canonicalRequest = [method,canonicalUri,canonicalQuery,canonicalHeaders,names.join(';'),payloadHash].join('\n');
    const credentialScope = `${day}/${region}/s3/aws4_request`;
    const keyDate = hmac(`AWS4${secretAccessKey}`,day), keyRegion = hmac(keyDate,region), keyService = hmac(keyRegion,'s3');
    const signature = createHmac('sha256',hmac(keyService,'aws4_request')).update(`AWS4-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`).digest('hex');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
    let response; try { response = await requestFetch(`${url.origin}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ''}`, {method,headers,body:method === 'PUT' ? body : undefined,redirect:'error',signal:AbortSignal.timeout(timeoutMs)}); } catch { throw failure(); }
    if (response.redirected || !response.ok) { await response.body?.cancel().catch(()=>{}); throw failure(response.status); }
    return response;
  }
  return {
    async put({bucket:requestBucket,key,body,ifNoneMatch,acl}) { scope(requestBucket,key); if (!Buffer.isBuffer(body) || body.length > 16*1024*1024+32 || ifNoneMatch !== '*' || acl !== 'private') throw new Error('Private conditional encrypted object write required'); const response = await request('PUT',key,[],body,{'if-none-match':'*',...(aws?{'x-amz-acl':'private'}:{})}); await response.body?.cancel(); },
    async get({bucket:requestBucket,key,maxBytes=16*1024*1024+32}) { scope(requestBucket,key); return boundedBody(await request('GET',key),maxBytes); },
    async delete({bucket:requestBucket,key}) { scope(requestBucket,key); const response=await request('DELETE',key); await response.body?.cancel(); },
    async list({bucket:requestBucket,prefix:requestPrefix,cursor}) { scope(requestBucket,requestPrefix); if (cursor && (typeof cursor !== 'string' || cursor.length > 4096)) throw new Error('Invalid private storage cursor'); const query=[['list-type','2'],['prefix',requestPrefix],['max-keys','1000']]; if(cursor)query.push(['continuation-token',cursor]); return listing((await boundedBody(await request('GET','',query),4*1024*1024)).toString('utf8'),requestPrefix); }
  };
}
