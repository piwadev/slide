import { chromium } from '/workspace/kotools/node_modules/playwright-core/index.mjs';
const [,, url, out, w='1280', h='720'] = process.argv;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } }); const logs=[];
p.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.type()+': '+m.text()); }); p.on('pageerror', e => logs.push('PAGEERROR '+e.message+'\n'+(e.stack||'').split('\n').slice(0,4).join('\n')));
await p.goto(url); await p.waitForFunction('window.done', null, {timeout: 60000}).catch(e=>logs.push('timeout'));
await p.waitForTimeout(500); await p.screenshot({ path: out }); console.log(logs.join('\n')||'no errors'); await b.close();
