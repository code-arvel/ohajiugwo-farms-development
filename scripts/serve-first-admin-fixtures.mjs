// Explicit offline developer harness. Never use as hosting entry point.
import {createServer} from 'node:http';
import {createAcceptanceFixtureApplication} from '../tests/admin/fixtures/acceptance-server.mjs';
const origin='http://127.0.0.1:4323';
const application=await createAcceptanceFixtureApplication({origin});
createServer(application.nodeHandler).on('error',()=>{console.error('Local acceptance fixture server could not start.');process.exitCode=1;}).listen(4323,'127.0.0.1',()=>console.log('Local mock acceptance checks only — no real accounts or email.\nOpen '+origin+'/__fixtures/'));
