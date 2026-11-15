// Offline smoke test: fresh profile -> bundled game installs -> Play opens the game -> game boots, saves to a file.
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import os from 'os';
const require = createRequire(import.meta.url); const { _electron } = require(process.env.PLAYWRIGHT_CORE || '/workspace/kotools/node_modules/playwright-core');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'slidereal-'));
const app = await _electron.launch({ executablePath: path.join(ROOT, 'node_modules/electron/dist/electron'), cwd: ROOT, args: ['.', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  env: { ...process.env, SLIDE_TEST: '1', SLIDE_NO_BUNDLE: '1', SLIDE_ROAMING: TMP + '/r', SLIDE_LOCAL: TMP + '/l' } });
const w = await app.firstWindow(); const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 200; i++) { if (/^v\d/.test(await w.locator('#vInstalled').innerText())) break; await sleep(300); }
console.log('latest:', await w.locator('#vLatest').innerText(), '| installed:', await w.locator('#vInstalled').innerText(), '| status:', await w.locator('#statusText').innerText());
await sleep(1500); await w.screenshot({ path: process.argv[2] || TMP + '/launcher.png' });
const gp = app.waitForEvent('window'); await w.click('#btnPlay'); const g = await gp; const errs = []; g.on('pageerror', e => errs.push(String(e))); g.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); });
await g.waitForFunction("document.getElementById('loading')==null", null, { timeout: 120000 }); await sleep(2500);
console.log('native bridge:', await g.evaluate(() => !!window.slideNative), '| url:', g.url());
await g.evaluate(() => { const a = window.__slide.app; a.profile.save.cash += 777; a.profile.save.name = 'LAUNCHER TEST'; a.profile.emit(); a.profile.flush(); });
await sleep(1500);
console.log('save file exists:', fs.existsSync(TMP + '/r/saves/slide_save.json'), '| game errors:', errs.length, errs.slice(0, 3));
if (process.argv[3]) await g.screenshot({ path: process.argv[3] });
await app.close(); console.log('tmp', TMP);
