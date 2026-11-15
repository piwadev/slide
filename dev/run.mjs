// headless driver: node dev/run.mjs <script.mjs>  — script exports async (page, h) => {}
import { chromium } from '/workspace/kotools/node_modules/playwright-core/index.mjs';
const [,, script, w='1280', h='720'] = process.argv;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } }); const logs=[];
p.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.type()+': '+m.text()); }); p.on('pageerror', e => logs.push('PAGEERROR '+e.message+'\n'+(e.stack||'').split('\n').slice(0,5).join('\n')));
const mod = await import(script.startsWith('/')?script:process.cwd()+'/'+script);
try { await mod.default(p, { logs, url: 'http://localhost:8099/index.html', shot: async (n) => { await p.screenshot({ path: n }); } }); } catch (e) { logs.push('SCRIPT ERROR '+e.message); }
console.log(logs.join('\n')||'no errors'); await b.close();
