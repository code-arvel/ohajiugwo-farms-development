import {createServer} from 'node:http';
import {browserAssetEntries,decodeAssets} from '../hosting/assets.mjs';
import {createWorkspaceFixture} from '../tests/admin/fixtures/workspace.mjs';
// Explicit local fixture only: no .env loading, provider credentials or remote transport.
const assets=decodeAssets(await browserAssetEntries());const port=Number(process.env.WORKSPACE_FIXTURE_PORT||4330);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose a local port from 1024 to 65535.');
const origin=`http://127.0.0.1:${port}`,fixture=createWorkspaceFixture(origin,assets);
const server=createServer(async(req,res)=>{try{if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403).end('Loopback fixture only.');return;}const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1_100_000){res.writeHead(413).end('Fixture input too large.');return;}chunks.push(chunk);}const body=chunks.length?Buffer.concat(chunks):null;const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(body?{body}:{})});const response=await fixture.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500).end('Local fixture request failed.');}});
server.listen(port,'127.0.0.1',()=>console.log(`Local dummy workspace: ${origin}/admin/\nNo real sign-in required. Changes are memory-only and reset when this server stops.`));
