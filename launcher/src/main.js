// SLIDE Launcher — Electron main process.
const { app, BrowserWindow, protocol, net, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

const P = require('./paths');
app.setPath('userData', P.userData);
const log = require('./log');
const settings = require('./settings');
const saves = require('./saves');
const updater = require('./updater');

const TEST = !!process.env.SLIDE_TEST;
protocol.registerSchemesAsPrivileged([{ scheme: 'slide', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
updater.init(app.getVersion(), process.resourcesPath || path.join(__dirname, '..', 'resources'));
if (!app.isPackaged && fs.existsSync(path.join(__dirname, '..', 'resources', 'bundled'))) updater.init(app.getVersion(), path.join(__dirname, '..', 'resources'));

let win = null, gameWin = null, latest = null, busy = false, currentDir = null;
let status = { state: 'idle', message: '' };
const send = (ch, payload) => { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); };
const setStatus = s => { status = s; send('l:status', status); };
const refreshCurrent = () => { currentDir = updater.installedInfo().dir; };
const pickPath = (kind, opts) => { // dialogs, with env overrides so the app can be driven by automated tests
  if (process.env.SLIDE_TEST_PATH) return process.env.SLIDE_TEST_PATH;
  return null;
};
const confirm = async (message, detail) => {
  if (TEST) return true;
  const r = await dialog.showMessageBox(win, { type: 'question', buttons: ['Continue', 'Cancel'], defaultId: 1, cancelId: 1, title: 'SLIDE', message, detail, noLink: true });
  return r.response === 0;
};
const ts = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/^(\d{8})(\d{6})$/, '$1-$2');

// ------------------------------------------------------------------ game window
function openGame() {
  if (gameWin) { gameWin.focus(); return { ok: true }; }
  refreshCurrent(); if (!currentDir) return { ok: false, error: 'The game is not installed yet.' };
  gameWin = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 500, backgroundColor: '#0b0b0d', title: 'SLIDE', autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload-game.js'), backgroundThrottling: false, contextIsolation: true, sandbox: true },
  });
  const gw = gameWin; gw.once('ready-to-show', () => gw.show());
  gw.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  gw.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('slide://')) e.preventDefault(); });
  gw.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') gw.setFullScreen(!gw.isFullScreen());
    if (input.key === 'F12' && (TEST || process.env.SLIDE_DEBUG)) gw.webContents.toggleDevTools();
  });
  if (TEST) gw.webContents.on('console-message', (_e, level, message) => { if (level >= 2) log.warn('[game console]', message); });
  gw.loadURL('slide://game/index.html');
  if (win && !win.isDestroyed()) { if (settings.get().closeLauncherOnPlay) win.hide(); else win.minimize(); }
  gw.on('closed', async () => {
    gameWin = null; saves.backupNow('save');
    const s = settings.get(); if (s.autoCloud && s.cloudDir) { try { const f = saves.cloudBackup(s.cloudDir); log.info('auto cloud backup', f); } catch (e) { log.warn('auto cloud backup failed', e); } }
    if (win && !win.isDestroyed()) { win.show(); win.focus(); send('l:state-changed'); } else app.quit();
  });
  send('l:state-changed'); return { ok: true };
}

// ------------------------------------------------------------------ launcher window
function createWindow() {
  win = new BrowserWindow({
    width: 1040, height: 660, minWidth: 960, minHeight: 620, backgroundColor: '#09090b', title: 'SLIDE Launcher', autoHideMenuBar: true, show: false,
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#09090b', symbolColor: '#c7d3ea', height: 38 },
    webPreferences: { preload: path.join(__dirname, 'preload-launcher.js'), contextIsolation: true, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
  win.on('closed', () => { win = null; if (!gameWin) app.quit(); });
}

// ------------------------------------------------------------------ update logic
const progress = p => send('l:progress', p);
async function checkNow(manual) {
  if (busy) return latest;
  busy = true; setStatus({ state: 'checking', message: 'Checking for updates…' });
  try {
    latest = await updater.checkLatest();
    const inst = updater.installedInfo();
    if (latest.needsNewerLauncher) setStatus({ state: 'launcher-required', message: `This game version needs launcher ${latest.minLauncher} or newer.` });
    else if (latest.updateAvailable) setStatus({ state: 'update', message: `Update ${latest.version} is available.` });
    else setStatus({ state: 'uptodate', message: inst.current ? 'You are up to date.' : 'Nothing installed.' });
    return latest;
  } catch (e) {
    log.warn('update check failed', e.message || e);
    const inst = updater.installedInfo();
    setStatus({ state: 'offline', message: inst.current ? `Could not reach GitHub (${e.message}). You can still play version ${inst.current}.` : `Could not reach GitHub: ${e.message}` });
    return null;
  } finally { busy = false; }
}
async function installNow() {
  if (busy) return; if (gameWin) return { ok: false, error: 'Close the game before updating.' };
  if (!latest || !latest.updateAvailable) return { ok: false, error: 'No update available.' };
  busy = true; setStatus({ state: 'downloading', message: `Downloading ${latest.version}…` });
  try {
    await updater.install(latest, p => { progress(p); if (p.phase === 'extract') setStatus({ state: 'extracting', message: 'Installing…' }); });
    refreshCurrent(); latest.updateAvailable = false; setStatus({ state: 'uptodate', message: `Version ${latest.version} installed.` }); send('l:toast', { kind: 'good', text: `Updated to ${latest.version}` });
    return { ok: true };
  } catch (e) { log.error('install failed', e); setStatus({ state: 'error', message: 'Update failed: ' + (e.message || e) }); return { ok: false, error: String(e.message || e) }; }
  finally { busy = false; }
}
async function startup() {
  try {
    if (!updater.installedInfo().current) { setStatus({ state: 'extracting', message: 'Installing the bundled game…' }); await updater.seedBundled(progress); }
  } catch (e) { log.error('seed failed', e); }
  refreshCurrent(); send('l:state-changed');
  if (settings.get().autoCheck) { await checkNow(false); if (latest && latest.updateAvailable && !latest.needsNewerLauncher && settings.get().autoInstall) await installNow(); }
  else setStatus({ state: 'idle', message: '' });
  send('l:state-changed');
}

function fullState() {
  const inst = updater.installedInfo();
  return { launcherVersion: app.getVersion(), platform: process.platform, installed: inst, latest, status, busy, gameRunning: !!gameWin, settings: settings.get(), save: saves.info(), paths: { saves: P.savesDir, game: P.gameDir, log: P.logFile }, repoUrl: updater.RELEASES_PAGE };
}

function registerIpc() {
  const H = (ch, fn) => ipcMain.handle(ch, async (e, ...a) => { try { return await fn(...a); } catch (err) { log.error(ch, err); return { ok: false, error: String(err.message || err) }; } });
  H('l:state', () => fullState());
  H('l:check', async () => { await checkNow(true); return fullState(); });
  H('l:install', async () => { const r = await installNow(); return { ...r, state: fullState() }; });
  H('l:play', () => openGame());
  H('l:rollback', async () => { if (gameWin) return { ok: false, error: 'Close the game first.' }; if (!(await confirm('Switch back to the previous game version?', 'Your save is not affected.'))) return { ok: false, cancelled: true }; updater.rollback(); refreshCurrent(); if (latest) latest.updateAvailable = updater.cmpVer(latest.version, updater.installedInfo().current || '0') > 0; setStatus(latest && latest.updateAvailable ? { state: 'update', message: `Update ${latest.version} is available.` } : { state: 'uptodate', message: 'Rolled back.' }); return { ok: true, state: fullState() }; });
  H('l:openSaves', async () => { fs.mkdirSync(P.savesDir, { recursive: true }); const r = await shell.openPath(P.savesDir); return r ? { ok: false, error: r } : { ok: true }; });
  H('l:backupSave', async () => {
    let f = pickPath('save'); if (!f) { const r = await dialog.showSaveDialog(win, { title: 'Back up save', defaultPath: path.join(app.getPath('documents'), `Slide-save-${ts()}.json`), filters: [{ name: 'SLIDE save', extensions: ['json'] }] }); if (r.canceled) return { ok: false, cancelled: true }; f = r.filePath; }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, `Slide-save-${ts()}.json`);
    saves.exportTo(f); return { ok: true, file: f };
  });
  H('l:restoreSave', async () => {
    if (gameWin) return { ok: false, error: 'Close the game before restoring a save.' };
    let f = pickPath('open'); if (!f) { const r = await dialog.showOpenDialog(win, { title: 'Restore save', properties: ['openFile'], filters: [{ name: 'SLIDE save', extensions: ['json'] }] }); if (r.canceled || !r.filePaths[0]) return { ok: false, cancelled: true }; f = r.filePaths[0]; }
    const err = saves.validate(fs.readFileSync(f, 'utf8')); if (err) return { ok: false, error: 'That file is ' + err + '.' };
    if (!(await confirm('Replace your current save with this file?', 'Your current save is backed up automatically first (see the saves folder → backups).'))) return { ok: false, cancelled: true };
    saves.importFrom(f); send('l:state-changed'); return { ok: true, file: f };
  });
  H('l:cloudBackup', async () => { const f = saves.cloudBackup(settings.get().cloudDir); send('l:toast', { kind: 'good', text: 'Backed up to ' + f }); return { ok: true, file: f }; });
  H('l:cloudRestore', async () => {
    if (gameWin) return { ok: false, error: 'Close the game before restoring a save.' };
    const f = saves.cloudLatest(settings.get().cloudDir); if (!f) return { ok: false, error: 'No backup found in the cloud folder (Slide-save-latest.json).' };
    if (!(await confirm('Restore the latest cloud backup?', f + '\nYour current save is backed up first.'))) return { ok: false, cancelled: true };
    saves.importFrom(f); send('l:state-changed'); return { ok: true, file: f };
  });
  H('l:chooseCloudDir', async () => {
    let d = process.env.SLIDE_TEST_DIR || null; if (!d) { const r = await dialog.showOpenDialog(win, { title: 'Choose a cloud backup folder (e.g. inside Google Drive or OneDrive)', properties: ['openDirectory', 'createDirectory'] }); if (r.canceled || !r.filePaths[0]) return { ok: false, cancelled: true }; d = r.filePaths[0]; }
    settings.set({ cloudDir: d }); return { ok: true, dir: d, state: fullState() };
  });
  H('l:setSettings', p => { settings.set(p || {}); return fullState(); });
  H('l:openExternal', u => { if (/^https:\/\/(github\.com|api\.github\.com)\/piwadev\//.test(u) || /^https:\/\/github\.com\/?$/.test(u)) { shell.openExternal(u); return { ok: true }; } return { ok: false }; });
  H('l:openLogs', async () => { await shell.openPath(path.dirname(P.logFile)); return { ok: true }; });
  H('l:updateLauncher', async () => {
    if (!latest || !latest.launcherUpdate) return { ok: false, error: 'No launcher update.' };
    if (process.platform !== 'win32') { shell.openExternal(latest.url); return { ok: true, opened: true }; }
    busy = true; setStatus({ state: 'downloading', message: `Downloading launcher ${latest.launcher.version}…` });
    try { const f = await updater.downloadLauncher(latest.launcher, progress); spawn(f, ['--updated'], { detached: true, stdio: 'ignore' }).unref(); setTimeout(() => app.quit(), 400); return { ok: true }; }
    catch (e) { setStatus({ state: 'error', message: 'Launcher update failed: ' + e.message }); return { ok: false, error: e.message }; } finally { busy = false; }
  });
  // game bridge (synchronous, only for the game window)
  const fromGame = e => gameWin && e.sender === gameWin.webContents;
  ipcMain.on('slide:loadSave', e => { e.returnValue = fromGame(e) ? saves.load() : null; });
  ipcMain.on('slide:saveSync', (e, text, reason) => { try { e.returnValue = fromGame(e) ? saves.save(text, reason) : false; } catch (err) { log.error('save failed', err); e.returnValue = false; } });
  ipcMain.on('slide:resetSave', e => { e.returnValue = fromGame(e) ? saves.reset() : false; });
  ipcMain.on('slide:info', e => { e.returnValue = fromGame(e) ? saves.info() : null; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = win || gameWin; if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); } });
  app.whenReady().then(() => {
    protocol.handle('slide', req => {
      if (!currentDir) return new Response('Game not installed', { status: 404 });
      const u = new URL(req.url); let p = decodeURIComponent(u.pathname); if (p === '/' || p === '') p = '/index.html';
      const f = path.normalize(path.join(currentDir, p));
      if (f !== currentDir && !f.startsWith(currentDir + path.sep)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(f).toString());
    });
    registerIpc(); refreshCurrent(); createWindow();
    win.webContents.once('did-finish-load', () => startup());
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => app.quit());
}
