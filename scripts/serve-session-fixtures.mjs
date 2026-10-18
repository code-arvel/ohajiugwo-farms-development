// Explicit local-only test harness; never use as a hosting entry point.
import {createServer} from 'node:http';
import {createSessionFixtureApplication} from '../tests/admin/fixtures/session-browser.mjs';
const reauthentication=process.argv.includes('--reauthentication');
const origin='http://127.0.0.1:4325',app=await createSessionFixtureApplication({origin,composed:reauthentication,reauthentication});
createServer(app.nodeHandler).on('error',()=>{console.error('Local session fixture server could not start.');process.exitCode=1;}).listen(4325,'127.0.0.1',()=>console.log('Mock sign-in only — no real accounts or email.\nOpen '+origin+'/__session_fixtures/'));
