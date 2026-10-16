import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {logo} from '../src/components/logo.mjs';
import {header,footer} from '../src/components/shared.mjs';
import {createRequestHandler} from '../scripts/serve.mjs';

test('one shared logo renders exact LTD lettering with preserved symbol and safe custom text',()=>{
 const html=logo();assert.match(html,/class="brand-name">Ohajiugwo<\/span>/);
 assert.match(html,/class="brand-description">Organic Farms LTD<\/span>/);
 assert.match(html,/width="234" height="211"/);assert.match(html,/\/images\/ohajiugwo-symbol.svg/);
 for(const placement of [header(),footer(),header(true),footer(true)])assert.ok(placement.includes('Organic Farms LTD'));
 assert.ok(!logo({profile:{name:'<script>bad</script>'}}).includes('<script>'));
 assert.ok(!readFileSync('src/components/shared.mjs','utf8').includes('const wordmark ='));
});

test('local editor receives the same compact component and reusable logo CSS',async()=>{
 const res={status:0,body:'',writeHead(s){this.status=s;return this;},end(b=''){this.body=String(b);}};
 await createRequestHandler()({url:'/__editor/',method:'GET',headers:{host:'localhost:4321'}},res);
 assert.equal(res.status,200);assert.ok(res.body.includes('farm-logo--compact'));
 assert.ok(res.body.includes('Organic Farms LTD'));assert.ok(res.body.includes('href="/logo.css"'));
 assert.ok(!res.body.includes('farm-logo--white'));
 assert.ok(!res.body.includes('wordmark-name'));assert.ok(!res.body.includes('<!-- SHARED_LOGO -->'));
 const css=readFileSync('src/styles/logo.css','utf8');assert.ok(/background:\s*transparent/.test(css));
});

test('white logo variant is selected only by the public footer',()=>{
 assert.match(logo({variant:'white'}),/farm-logo--white/);
 assert.ok(!logo().includes('farm-logo--white'));
 assert.ok(!header().includes('farm-logo--white'));
 assert.match(footer(),/farm-logo--white/);
 assert.match(footer(true),/farm-logo--white/);
 const css=readFileSync('src/styles/logo.css','utf8');
 assert.match(css,/\.site-footer \.farm-logo--white,\s*\.site-footer \.farm-logo--white \.brand-name,\s*\.site-footer \.farm-logo--white \.brand-description\s*\{\s*color:\s*#e3e9d9;?\s*\}/);
 assert.match(css,/\.site-footer \.farm-logo--white \.brand-symbol img\s*\{\s*display:\s*none;?\s*\}/);
 assert.match(css,/\.site-footer \.farm-logo--white \.brand-symbol::before\s*\{[^}]*background-color:\s*currentColor;[^}]*mask:\s*url\("\/images\/ohajiugwo-symbol\.svg"\) center \/ contain no-repeat;/);
 assert.ok(!css.includes('filter:brightness(0) invert(1)'));
});
