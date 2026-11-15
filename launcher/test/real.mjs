// Smoke test against the REAL GitHub release (no mock): fresh profile -> downloads v4.0.0 -> plays.
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import os from 'os';
const require = createRequire(import.meta.url); const { _electron } = require(process.env.PLAYWRIGHT_CORE || '/workspace/kotools/node_modules/playwright-core');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kowreal-'));
const app = await _electron.launch({ executablePath: path.join(ROOT, 'node_modules/electron/dist/electron'), cwd: ROOT, args: ['.', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  env: { ...process.env, KOW_TEST: '1', KOW_NO_BUNDLE: '1', KOW_ROAMING: TMP + '/r', KOW_LOCAL: TMP + '/l' } });
const w = await app.firstWindow(); const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 100; i++) { if ((await w.locator('#vInstalled').innerText()) === 'v4.0.0' && /installed|up to date/i.test(await w.locator('#statusText').innerText())) break; await sleep(300); }
console.log('status:', await w.locator('#statusText').innerText(), '| installed:', await w.locator('#vInstalled').innerText(), '| latest:', await w.locator('#vLatest').innerText(), '| launcher banner visible:', await w.locator('#launcherBanner').isVisible());
console.log('state.json:', fs.readFileSync(TMP + '/l/state.json', 'utf8').replace(/\s+/g, ' '));
await w.setViewportSize?.({ width: 1040, height: 660 }); await sleep(5000); await w.screenshot({ path: process.argv[2] || TMP + '/real.png' });
const gp = app.waitForEvent('window'); await w.click('#btnPlay'); const g = await gp; const errs = []; g.on('pageerror', e => errs.push(String(e))); g.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await g.waitForSelector('#playBtn:not([disabled])', { timeout: 120000 }); await g.click('#playBtn'); await sleep(15000);
console.log('save file exists:', fs.existsSync(TMP + '/r/saves/kow_save.json'), '| game errors:', errs.length, errs.slice(0, 2));
await app.close(); console.log('tmp', TMP);
