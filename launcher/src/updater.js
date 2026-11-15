// Game updater: GitHub Releases -> manifest.json -> verified zip -> versioned folder -> switch "current" (previous kept for rollback).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const P = require('./paths');
const log = require('./log');
const settings = require('./settings');
const { net } = require('electron'); // Chromium network stack: uses the OS certificate store and proxy settings (better than Node's fetch on Windows)

const DEFAULT_API = 'https://api.github.com/repos/piwadev/slide/releases/latest';
const RELEASES_PAGE = 'https://github.com/piwadev/slide/releases';
let LAUNCHER_VERSION = '0.0.0'; let RESOURCES = '';
function init(launcherVersion, resourcesPath) { LAUNCHER_VERSION = launcherVersion; RESOURCES = resourcesPath; }

// ---------------------------------------------------------------- helpers
const apiUrl = () => process.env.SLIDE_API || settings.get().apiUrl || DEFAULT_API;
const parseVer = v => String(v || '0').replace(/^v/i, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
function cmpVer(a, b) { const x = parseVer(a), y = parseVer(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; } return 0; }
const readState = () => { try { return JSON.parse(fs.readFileSync(P.stateFile, 'utf8')); } catch { return { current: null, previous: null }; } };
function writeState(s) { fs.mkdirSync(path.dirname(P.stateFile), { recursive: true }); const t = P.stateFile + '.tmp'; fs.writeFileSync(t, JSON.stringify(s, null, 2)); fs.renameSync(t, P.stateFile); }
const versionDir = v => path.join(P.gameDir, v);
const isInstalled = v => !!v && fs.existsSync(path.join(versionDir(v), 'index.html'));

function installedInfo() {
  const s = readState(); const cur = isInstalled(s.current) ? s.current : null;
  return { current: cur, previous: isInstalled(s.previous) ? s.previous : null, dir: cur ? versionDir(cur) : null, all: listVersions() };
}
function listVersions() { try { return fs.readdirSync(P.gameDir).filter(d => !d.endsWith('.tmp') && isInstalled(d)); } catch { return []; } }

async function http(url, opts = {}) { // small retry: GitHub's CDN occasionally answers 4xx/5xx or resets right after a release is created
  let err;
  for (let i = 0; i < 3; i++) {
    try { return await http1(url, opts); } catch (e) { err = e; if (/ HTTP (404|403)/.test(e.message)) break; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
  }
  throw err;
}
async function http1(url, opts = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeout || 20000);
  const init = { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Slide-Launcher/' + LAUNCHER_VERSION, Accept: opts.accept || 'application/vnd.github+json' } };
  try {
    let r;
    // Node's fetch first (one connection per host). Chromium's net.fetch is the fallback (OS certificate store / proxy settings):
    // on its own it can coalesce api.github.com + github.com onto one HTTP/2 connection and get a bogus 400 from GitHub.
    try { r = await fetch(url, init); } catch (e) { if (ctl.signal.aborted) throw e; log.warn('node fetch failed, trying chromium net stack:', e.cause && e.cause.message || e.message); r = await net.fetch(url, init); }
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${new URL(url).host}${r.status === 403 ? ' (GitHub rate limit?)' : ''}`);
    return r;
  } catch (e) { throw new Error(e && e.cause && e.cause.message ? `${e.message} (${e.cause.message})` : (e.message || String(e))); }
  finally { clearTimeout(t); }
}

// ---------------------------------------------------------------- check
const REPO_URL = 'https://github.com/piwadev/slide';
// The unauthenticated REST API is limited to 60 requests/hour per IP. If it fails (rate limit, API outage) fall back to the
// plain download URLs, which are not rate limited: releases/latest/download/manifest.json (same data, notes included).
async function latestRelease() {
  try { return await (await http(apiUrl())).json(); }
  catch (e) {
    if (process.env.SLIDE_API || settings.get().apiUrl) throw e;
    log.warn('releases API failed, using manifest fallback:', e.message);
    const manifest = await (await http(REPO_URL + '/releases/latest/download/manifest.json', { accept: 'application/octet-stream' })).json();
    const tag = 'v' + manifest.version, dl = f => `${REPO_URL}/releases/download/${tag}/${f}`;
    return { tag_name: tag, name: tag, published_at: manifest.released, html_url: `${REPO_URL}/releases/tag/${tag}`, body: manifest.notes || '',
      assets: [{ name: 'manifest.json', browser_download_url: REPO_URL + '/releases/latest/download/manifest.json' }, { name: manifest.game.file, browser_download_url: dl(manifest.game.file), size: manifest.game.size }] };
  }
}
async function checkLatest() {
  const rel = await latestRelease();
  const assets = rel.assets || []; const byName = n => assets.find(a => a.name === n);
  const mAsset = byName('manifest.json'); if (!mAsset) throw new Error('Release ' + rel.tag_name + ' has no manifest.json');
  const manifest = await (await http(mAsset.browser_download_url, { accept: 'application/octet-stream' })).json();
  const gAsset = byName(manifest.game && manifest.game.file); if (!gAsset) throw new Error('Release asset ' + (manifest.game && manifest.game.file) + ' missing');
  const out = {
    version: manifest.version, tag: rel.tag_name, notes: rel.body || manifest.notes || '', name: rel.name || rel.tag_name, published: rel.published_at, url: rel.html_url || RELEASES_PAGE,
    game: { url: gAsset.browser_download_url, sha256: String(manifest.game.sha256 || '').toLowerCase(), size: manifest.game.size || gAsset.size },
    minLauncher: manifest.minLauncher || '0.0.0', launcher: null,
  };
  if (manifest.launcher && manifest.launcher.version) {
    const l = manifest.launcher, la = byName(l.file); const url = l.url || (la && la.browser_download_url);
    if (url) out.launcher = { version: l.version, url, sha256: String(l.sha256 || '').toLowerCase(), size: l.size || (la && la.size) || 0 };
  }
  out.updateAvailable = cmpVer(out.version, installedInfo().current || '0') > 0;
  out.launcherUpdate = !!(out.launcher && cmpVer(out.launcher.version, LAUNCHER_VERSION) > 0);
  out.needsNewerLauncher = cmpVer(out.minLauncher, LAUNCHER_VERSION) > 0;
  return out;
}

// ---------------------------------------------------------------- download + verify
async function download(url, dest, expectedSha, onProgress) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = await http(url, { accept: 'application/octet-stream', timeout: 60000 });
  const total = Number(r.headers.get('content-length')) || 0; const hash = crypto.createHash('sha256'); const out = fs.createWriteStream(dest + '.part');
  let got = 0, t0 = Date.now(), lastEmit = 0;
  try {
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      hash.update(value); got += value.length; if (!out.write(value)) await new Promise(res => out.once('drain', res));
      const now = Date.now(); if (onProgress && now - lastEmit > 100) { lastEmit = now; onProgress({ phase: 'download', got, total, speed: got / Math.max(0.2, (now - t0) / 1000) }); }
    }
    await new Promise((res, rej) => { out.end(err => (err ? rej(err) : res())); });
  } catch (e) { out.destroy(); try { fs.unlinkSync(dest + '.part'); } catch { /* ignore */ } throw e; }
  onProgress && onProgress({ phase: 'download', got, total: total || got, speed: 0 });
  const sha = hash.digest('hex');
  if (expectedSha && sha !== expectedSha) { try { fs.unlinkSync(dest + '.part'); } catch { /* ignore */ } throw new Error(`Checksum mismatch (expected ${expectedSha.slice(0, 12)}…, got ${sha.slice(0, 12)}…). The download was discarded.`); }
  fs.renameSync(dest + '.part', dest); return sha;
}

function extractZip(zipFile, destDir, onProgress) {
  const zip = new AdmZip(zipFile), entries = zip.getEntries(), root = path.resolve(destDir);
  fs.rmSync(destDir, { recursive: true, force: true }); fs.mkdirSync(destDir, { recursive: true });
  let i = 0;
  for (const e of entries) {
    const target = path.resolve(root, e.entryName);
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error('Unsafe path in archive: ' + e.entryName); // zip-slip guard
    if (e.isDirectory) fs.mkdirSync(target, { recursive: true });
    else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, e.getData()); }
    if (onProgress && (++i % 20 === 0 || i === entries.length)) onProgress({ phase: 'extract', got: i, total: entries.length });
  }
}

function activate(version) {
  const s = readState();
  if (s.current && s.current !== version) s.previous = s.current;
  s.current = version; writeState(s);
  // keep only current + previous
  for (const v of listVersions()) if (v !== s.current && v !== s.previous) { try { fs.rmSync(versionDir(v), { recursive: true, force: true }); log.info('pruned old version', v); } catch (e) { log.warn('prune failed', e); } }
  return s;
}

async function installFromZip(zipFile, version, onProgress) {
  const tmp = versionDir(version) + '.tmp';
  extractZip(zipFile, tmp, onProgress);
  let v; try { v = JSON.parse(fs.readFileSync(path.join(tmp, 'version.json'), 'utf8')).version; } catch { /* missing */ }
  if (!fs.existsSync(path.join(tmp, 'index.html')) || v !== version) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error(`Downloaded game package is invalid (expected version ${version}${v ? ', found ' + v : ''}).`); }
  fs.rmSync(versionDir(version), { recursive: true, force: true }); fs.renameSync(tmp, versionDir(version));
  return activate(version);
}

async function install(latest, onProgress) {
  const zipFile = path.join(P.downloadsDir, `slide-game-${latest.version}.zip`);
  await download(latest.game.url, zipFile, latest.game.sha256, onProgress);
  onProgress && onProgress({ phase: 'extract', got: 0, total: 1 });
  await installFromZip(zipFile, latest.version, onProgress);
  try { fs.unlinkSync(zipFile); } catch { /* ignore */ }
  log.info('installed game', latest.version); return installedInfo();
}

// first run / offline: install the game version bundled inside the launcher
async function seedBundled(onProgress) {
  if (!RESOURCES || process.env.SLIDE_NO_BUNDLE) return null;
  const dir = path.join(RESOURCES, 'bundled'); const meta = path.join(dir, 'bundled.json'); if (!fs.existsSync(meta)) return null;
  const b = JSON.parse(fs.readFileSync(meta, 'utf8')); const cur = installedInfo().current;
  if (cur && cmpVer(cur, b.version) >= 0) return null;
  const zipFile = path.join(dir, b.file); const sha = crypto.createHash('sha256').update(fs.readFileSync(zipFile)).digest('hex');
  if (b.sha256 && sha !== b.sha256) throw new Error('Bundled game package is corrupted');
  await installFromZip(zipFile, b.version, onProgress); log.info('seeded bundled game', b.version); return installedInfo();
}

function rollback() {
  const s = readState(); if (!isInstalled(s.previous)) throw new Error('No previous version is installed.');
  const cur = s.current; s.current = s.previous; s.previous = cur; writeState(s); return installedInfo();
}

// ---------------------------------------------------------------- launcher self-update
async function downloadLauncher(l, onProgress) {
  const f = path.join(P.downloadsDir, `SLIDE-Launcher-Setup-${l.version}.exe`);
  await download(l.url, f, l.sha256, onProgress); return f;
}

module.exports = { init, checkLatest, install, seedBundled, rollback, installedInfo, downloadLauncher, cmpVer, readState, RELEASES_PAGE, apiUrl };
