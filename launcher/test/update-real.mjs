// Real-GitHub update test. Stage 1 `install`: fresh profile installs the currently published release and a save is written.
// Stage 2 `update`: same profile after a newer release is published -> launcher must detect it, download, verify (sha256) and install it,
// keep the save, and the new game must boot with zero errors. Usage: node test/update-real.mjs install|update [expectedVersion]
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs';
const require = createRequire(import.meta.url); const { _electron } = require(process.env.PLAYWRIGHT_CORE || '/workspace/kotools/node_modules/playwright-core');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const TMP = process.env.UPD_DIR || '/workspace/updtest'; fs.mkdirSync(TMP, { recursive: true });
const stage = process.argv[2] || 'install', want = process.argv[3]; const sleep = ms => new Promise(r => setTimeout(r, ms));
const app = await _electron.launch({ executablePath: path.join(ROOT, 'node_modules/electron/dist/electron'), cwd: ROOT, args: ['.', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  env: { ...process.env, SLIDE_TEST: '1', SLIDE_NO_BUNDLE: '1', SLIDE_ROAMING: TMP + '/r', SLIDE_LOCAL: TMP + '/l' } });
const w = await app.firstWindow(); const txt = id => w.locator('#' + id).innerText();
const t0 = Date.now(); let sawUpdateBtn = false;
for (let i = 0; i < 400; i++) {
  const inst = await txt('vInstalled'), latest = await txt('vLatest');
  if (stage === 'update' && !sawUpdateBtn && await w.locator('#btnUpdate').isVisible().catch(() => false)) { sawUpdateBtn = true; console.log('update available detected: installed', inst, 'latest', latest); await w.click('#btnUpdate'); }
  if (/^v\d/.test(inst) && (stage === 'install' || (want ? inst === 'v' + want : true) && (sawUpdateBtn || !/^v1\.0/.test(inst)))) break; await sleep(300);
}
console.log('installed:', await txt('vInstalled'), '| latest:', await txt('vLatest'), '| status:', await txt('statusText'), '| took', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await sleep(1200); await w.screenshot({ path: process.env.LSHOT || TMP + `/launcher-${stage}.png` });
const gp = app.waitForEvent('window'); await w.click('#btnPlay'); const g = await gp; const errs = []; g.on('pageerror', e => errs.push(String(e))); g.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); });
await g.waitForFunction("document.getElementById('loading')==null", null, { timeout: 120000 }); await sleep(2500);
const info = await g.evaluate(async () => { const a = window.__slide.app; const v = await (await fetch('version.json')).json(); return { version: v.version, cash: a.profile.save.cash, name: a.profile.save.name, native: !!window.slideNative }; });
console.log('game version.json:', info.version, '| native bridge:', info.native);
if (stage === 'install') { await g.evaluate(() => { const a = window.__slide.app; a.profile.save.cash = 424242; a.profile.save.name = 'UPDATE TEST'; a.profile.emit(); a.profile.flush(); }); await sleep(1500); }
else {
  console.log('save survived update:', info.cash === 424242 && info.name === 'UPDATE TEST', JSON.stringify({ cash: info.cash, name: info.name }));
  const glb = await g.evaluate(async () => { const a = window.__slide.app; const car = 'r34'; a.profile.save.owned[car] = { cfg: a.profile.fixCfg(window.__cars[car], null), bought: 1 }; a.profile.save.selected = car; a.garage.setCar(window.__cars[car], a.profile.cfg); await new Promise(r => setTimeout(r, 6000)); return !!a.garage.model.isGlb; });
  console.log('real model loads through slide:// protocol (R34 isGlb):', glb);
  if (process.env.GSHOT) await g.screenshot({ path: process.env.GSHOT });
}
console.log('game errors:', errs.length, errs.slice(0, 5));
try { console.log('state.json:', fs.readFileSync(TMP + '/l/state.json', 'utf8')); } catch (e) { console.log('state.json missing', e.message); }
console.log('save file:', fs.existsSync(TMP + '/r/saves/slide_save.json'), '| versions:', fs.existsSync(TMP + '/l/versions') ? fs.readdirSync(TMP + '/l/versions') : '(see l/)', fs.readdirSync(TMP + '/l'));
await app.close();
