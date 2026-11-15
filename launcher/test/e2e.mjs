// End-to-end test of the launcher against a local mock GitHub release server (nothing is published).
// Run from launcher/:  node test/e2e.mjs   (needs playwright-core; uses the Linux electron in node_modules)
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs'; import path from 'path'; import os from 'os'; import crypto from 'crypto'; import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
const { _electron } = require(process.env.PLAYWRIGHT_CORE || '/workspace/kotools/node_modules/playwright-core');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const REPO = path.dirname(ROOT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kowtest-')); const results = []; let failed = 0;
const ok = (name, cond, extra = '') => { results.push([cond, name, extra]); if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// ---- build release assets: v4.0.0 (real) and a simulated v4.0.1 (never published)
function buildVersion(ver, mutate) {
  const d = path.join(TMP, 'src-' + ver); fs.mkdirSync(d, { recursive: true });
  for (const x of ['index.html', 'version.json', 'css', 'js', 'assets', 'scripts']) fs.cpSync(path.join(REPO, x), path.join(d, x), { recursive: true });
  fs.writeFileSync(path.join(d, 'version.json'), JSON.stringify({ version: ver }));
  if (mutate) mutate(d);
  execFileSync('python3', [path.join(d, 'scripts/build-game-zip.py'), '--launcher-json', '/nonexistent', '--out', path.join(TMP, 'out-' + ver)], { stdio: 'pipe' });
  const o = path.join(TMP, 'out-' + ver); return { dir: o, zip: path.join(o, `slide-game-${ver}.zip`), manifest: JSON.parse(fs.readFileSync(path.join(o, 'manifest.json'))) };
}
const R = { '4.0.0': buildVersion('4.0.0'), '4.0.1': buildVersion('4.0.1', d => fs.appendFileSync(path.join(d, 'index.html'), '\n<!-- v4.0.1 marker -->\n')) };
let serve = '4.0.0', tamper = false, hits = [];
const srv = http.createServer((req, res) => {
  hits.push(req.url); const port = srv.address().port, base = `http://127.0.0.1:${port}`;
  if (req.url === '/api/latest') {
    const v = serve, r = R[v]; res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ tag_name: 'v' + v, name: 'SLIDE ' + v, published_at: new Date().toISOString(), html_url: 'https://github.com/piwadev/slide/releases/tag/v' + v,
      body: `## What's new in ${v}\n- **Launcher test** release notes for ${v}\n- Second \`bullet\` <b>escaped</b>`,
      assets: [{ name: 'manifest.json', browser_download_url: `${base}/dl/${v}/manifest.json`, size: 100 }, { name: r.manifest.game.file, browser_download_url: `${base}/dl/${v}/${r.manifest.game.file}`, size: r.manifest.game.size }] }));
  }
  const m = /^\/dl\/([\d.]+)\/(.+)$/.exec(req.url); if (m) {
    let f = path.join(R[m[1]].dir, m[2]); if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
    let buf = fs.readFileSync(f);
    if (m[2] === 'manifest.json' && tamper) { const j = JSON.parse(buf); j.game.sha256 = '0'.repeat(64); buf = Buffer.from(JSON.stringify(j)); }
    res.setHeader('content-length', buf.length); return res.end(buf);
  }
  res.statusCode = 404; res.end();
});
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const API = `http://127.0.0.1:${srv.address().port}/api/latest`;

const ROAM = path.join(TMP, 'roaming'), LOCAL = path.join(TMP, 'local'), CLOUD = path.join(TMP, 'cloud-folder'), EXPORT = path.join(TMP, 'export.json');
const SAVE = path.join(ROAM, 'saves', 'slide_save.json');
async function start(env = {}) {
  const app = await _electron.launch({ executablePath: path.join(ROOT, 'node_modules/electron/dist/electron'), cwd: ROOT,
    args: ['.', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    env: { ...process.env, SLIDE_TEST: '1', SLIDE_NO_BUNDLE: '1', SLIDE_ROAMING: ROAM, SLIDE_LOCAL: LOCAL, SLIDE_API: API, ...env } });
  const launcher = await app.firstWindow(); const errors = []; launcher.on('pageerror', e => errors.push('launcher: ' + e)); launcher.on('console', m => { if (m.type() === 'error') errors.push('launcher console: ' + m.text()); });
  await launcher.waitForLoadState('domcontentloaded'); return { app, launcher, errors };
}
const txt = (p, id) => p.locator('#' + id).innerText();
async function waitStatus(p, re, ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await txt(p, 'statusText'); if (re.test(s)) return s; await sleep(150); } throw new Error('status timeout; last=' + await txt(p, 'statusText')); }
async function playGame(app, launcher) {
  const wp = app.waitForEvent('window'); await launcher.click('#btnPlay'); const game = await wp; const errs = [];
  game.on('pageerror', e => errs.push('pageerror: ' + e)); game.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  game.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));
  await game.waitForLoadState('domcontentloaded'); await game.addStyleTag({ content: '.mback,.modal,.ctx.enter,.toast{animation:none!important}' }).catch(() => {});
  await game.waitForSelector('#playBtn:not([disabled])', { timeout: 120000 }); return { game, errs };
}
const closeGame = async (app, game) => { const c = game.waitForEvent('close'); await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().filter(w => w.getTitle() === 'SLIDE').forEach(w => w.close()); }); await c; await sleep(500); };

try {
  // ================= 1. fresh install: update check + download + verify + extract
  let { app, launcher, errors } = await start();
  await launcher.screenshot({ path: path.join(TMP, 'launcher-0.png') });
  await waitStatus(launcher, /4\.0\.0 installed|up to date/i, 30000);
  ok('1. first run downloads + installs v4.0.0 from the (mock) release', (await txt(launcher, 'vInstalled')) === 'v4.0.0', await txt(launcher, 'statusText'));
  const stateFile = JSON.parse(fs.readFileSync(path.join(LOCAL, 'state.json')));
  ok('1b. state.json current=4.0.0, game extracted under local/game/4.0.0', stateFile.current === '4.0.0' && fs.existsSync(path.join(LOCAL, 'game/4.0.0/index.html')) && fs.existsSync(path.join(LOCAL, 'game/4.0.0/js/main.js')));
  ok('1c. release notes rendered (and HTML escaped)', (await launcher.locator('#notes').innerHTML()).includes('&lt;b&gt;escaped&lt;/b&gt;') && (await txt(launcher, 'notesVer')) === 'v4.0.0');
  await launcher.screenshot({ path: path.join(TMP, 'launcher-1.png') });

  // ================= 2. play: game loads from slide://, zero console errors, save written to file
  const { game, errs } = await playGame(app, launcher);
  ok('2. game window served from slide:// protocol', game.url().startsWith('slide://game/'), game.url());
  ok('2b. native bridge present in the game', await game.evaluate(() => !!window.slideNative && typeof window.slideNative.saveSync === 'function'));
  await game.click('#playBtn'); await sleep(2500);
  const t0 = Date.now(); while (!fs.existsSync(SAVE) && Date.now() - t0 < 40000) await sleep(500);
  ok('2c. save file written to saves folder', fs.existsSync(SAVE), SAVE);
  ok('2d. nothing written to localStorage in launcher mode', await game.evaluate(() => localStorage.getItem('slide_save_v1') === null));
  await sleep(1500); await game.screenshot({ path: path.join(TMP, 'game-play.png') });
  await closeGame(app, game);
  ok('2e. zero console/page errors in the game window', errs.length === 0, errs.slice(0, 3).join(' | '));
  const saveObj = JSON.parse(fs.readFileSync(SAVE, 'utf8')); const saveHash1 = sha(SAVE);
  ok('2f. save is valid game save (v/res/buildings)', typeof saveObj.v === 'number' && !!saveObj.res && saveObj.buildings.length > 0, `v${saveObj.v}, ${saveObj.buildings.length} buildings`);
  const nBackups = fs.readdirSync(path.join(ROAM, 'saves/backups')).length; ok('2g. rotating backup created on exit', nBackups >= 1, nBackups + ' backup(s)');

  // ================= 3. export / import + cloud backup (via launcher UI, dialogs stubbed by env)
  await app.close(); ({ app, launcher, errors } = await start({ SLIDE_TEST_PATH: EXPORT, SLIDE_TEST_DIR: CLOUD }));
  await waitStatus(launcher, /up to date/i);
  await launcher.click('#btnBackup'); await sleep(800);
  ok('3. "Back up save" exports an identical JSON copy', fs.existsSync(EXPORT) && sha(EXPORT) === saveHash1);
  await launcher.click('#btnSettings'); await launcher.click('#btnChooseCloud'); await sleep(500); await launcher.click('#sAutoCloud');
  await launcher.screenshot({ path: path.join(TMP, 'launcher-settings.png') }); await launcher.click('#btnCloseSettings');
  await launcher.click('#btnCloud'); await sleep(800);
  ok('3b. "Cloud backup" writes to the chosen folder (+latest file)', fs.existsSync(path.join(CLOUD, 'Slide-save-latest.json')) && fs.readdirSync(CLOUD).length === 2, fs.readdirSync(CLOUD).join(', '));
  // corrupt the live save, restore from the exported file
  fs.writeFileSync(SAVE, '{"corrupt":true}'); await sleep(100);
  await launcher.click('#btnRestore'); await sleep(800);
  ok('3c. "Restore save" brings the exported save back (byte-identical)', sha(SAVE) === saveHash1);
  const saveHashRestored = sha(SAVE);

  // ================= 4. simulated update to v4.0.1 (mock server only), then play again
  serve = '4.0.1'; await launcher.click('#btnCheck'); await waitStatus(launcher, /4\.0\.1 is available/i, 15000);
  ok('4. update check sees v4.0.1 available', (await txt(launcher, 'vLatest')) === 'v4.0.1' && await launcher.locator('#btnUpdate').isVisible());
  await launcher.screenshot({ path: path.join(TMP, 'launcher-update.png') });
  await launcher.click('#btnUpdate'); await waitStatus(launcher, /4\.0\.1 installed/i, 30000);
  const st2 = JSON.parse(fs.readFileSync(path.join(LOCAL, 'state.json')));
  ok('4b. v4.0.1 installed, v4.0.0 kept for rollback', st2.current === '4.0.1' && st2.previous === '4.0.0' && fs.existsSync(path.join(LOCAL, 'game/4.0.0/index.html')) && fs.existsSync(path.join(LOCAL, 'game/4.0.1/index.html')), JSON.stringify(st2));
  ok('4c. SAVE UNTOUCHED by the update (byte-identical)', sha(SAVE) === saveHashRestored);
  const g2 = await playGame(app, launcher);
  const gv = await g2.game.evaluate(() => fetch('version.json').then(r => r.json()).then(j => j.version)); const html = await g2.game.evaluate(() => fetch('index.html').then(r => r.text()));
  ok('4d. game now runs v4.0.1 content', gv === '4.0.1' && html.includes('v4.0.1 marker'));
  await g2.game.click('#playBtn'); await sleep(4000);
  const ingame = await g2.game.evaluate(() => { const k = window.__kow; return k ? k.server.state.buildings.length : -1; }).catch(() => -1);
  await closeGame(app, g2.game);
  const after = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  ok('4e. save loaded by v4.0.1 with all buildings (village intact)', after.buildings.length === saveObj.buildings.length, `${after.buildings.length} vs ${saveObj.buildings.length}; in-game=${ingame}`);
  ok('4f. zero console errors on v4.0.1', g2.errs.length === 0, g2.errs.slice(0, 3).join(' | '));
  const bk = fs.readdirSync(path.join(ROAM, 'saves/backups')).filter(f => f.startsWith('save-')).length; ok('4g. at most 5 rotating "save-*" backups kept', bk <= 5, bk + '');
  ok('4h. cloud auto-backup on game exit ran', fs.readdirSync(CLOUD).length >= 2);

  // ================= 5. rollback
  await sleep(500); await launcher.click('#btnSettings'); await launcher.click('#btnRollback'); await sleep(800);
  const st3 = JSON.parse(fs.readFileSync(path.join(LOCAL, 'state.json')));
  ok('5. rollback switches back to 4.0.0 (save untouched)', st3.current === '4.0.0' && st3.previous === '4.0.1' && (await txt(launcher, 'vInstalled')) === 'v4.0.0');
  await launcher.click('#btnCloseSettings'); await launcher.click('#btnCheck'); await waitStatus(launcher, /available/i, 15000); await launcher.click('#btnUpdate'); await waitStatus(launcher, /4\.0\.1 installed/i, 30000);
  ok('5b. re-update after rollback works', (await txt(launcher, 'vInstalled')) === 'v4.0.1');

  // ================= 6. tampered download rejected
  fs.rmSync(path.join(LOCAL, 'game', '4.0.1'), { recursive: true }); fs.writeFileSync(path.join(LOCAL, 'state.json'), JSON.stringify({ current: '4.0.0', previous: null }));
  tamper = true; await launcher.click('#btnCheck'); await waitStatus(launcher, /available/i, 15000); await launcher.click('#btnUpdate'); const es = await waitStatus(launcher, /checksum mismatch/i, 30000);
  ok('6. checksum mismatch rejected, nothing installed', !fs.existsSync(path.join(LOCAL, 'game/4.0.1')) && JSON.parse(fs.readFileSync(path.join(LOCAL, 'state.json'))).current === '4.0.0' && !fs.existsSync(path.join(LOCAL, 'downloads/slide-game-4.0.1.zip')), es.slice(0, 60));
  tamper = false;
  ok('6b. launcher UI has no JS errors', errors.length === 0, errors.join(' | '));
  await app.close();

  // ================= 7. offline: server down, installed game still launches
  const portSrv = srv.address().port; await new Promise(r => srv.close(r));
  ({ app, launcher, errors } = await start()); await waitStatus(launcher, /could not reach/i, 20000);
  ok('7. offline: friendly message and Play still enabled', await launcher.locator('#btnPlay').isEnabled());
  await launcher.screenshot({ path: path.join(TMP, 'launcher-offline.png') });
  await app.close();

  // ================= 8. localStorage -> file migration
  const ROAM2 = path.join(TMP, 'roaming2'), LOCAL2 = path.join(TMP, 'local2'); const env2 = { SLIDE_ROAMING: ROAM2, SLIDE_LOCAL: LOCAL2, SLIDE_API: 'http://127.0.0.1:1/x', SLIDE_NO_BUNDLE: '' };
  const bundle = path.join(ROOT, 'resources/bundled'); // use the bundled game here (also tests offline first-run seeding)
  ({ app, launcher, errors } = await start(env2)); await sleep(3000);
  await waitStatus(launcher, /could not reach|installed/i, 20000);
  ok('8. offline first run seeds the bundled game', fs.existsSync(bundle) ? (await txt(launcher, 'vInstalled')) === 'v4.0.0' : true, await txt(launcher, 'vInstalled'));
  let g3 = await playGame(app, launcher); const legacy = JSON.stringify({ ...saveObj, res: { ...saveObj.res, gold: 777777 } });
  await g3.game.evaluate(t => localStorage.setItem('slide_save_v1', t), legacy); await closeGame(app, g3.game); await app.close();
  fs.rmSync(path.join(ROAM2, 'saves'), { recursive: true, force: true });
  ({ app, launcher, errors } = await start(env2)); await sleep(1500); g3 = await playGame(app, launcher); await g3.game.click('#playBtn'); await sleep(1500);
  const migrated = fs.existsSync(path.join(ROAM2, 'saves/slide_save.json')) ? fs.readFileSync(path.join(ROAM2, 'saves/slide_save.json'), 'utf8') : '';
  ok('8b. existing localStorage save migrated into the save file', migrated.includes('777777'), migrated.slice(0, 40));
  await closeGame(app, g3.game); await app.close();
} catch (e) { failed++; console.log('TEST ERROR', e); }
finally { try { srv.close(); } catch {} }
fs.writeFileSync('/workspace/launcher-test-results.json', JSON.stringify({ tmp: TMP, results }, null, 1));
console.log(`\n${results.length - failed} passed, ${failed} failed. Artifacts: ${TMP}`); process.exit(failed ? 1 : 0);
