// Save-file manager: atomic writes, rotating backups (last 5), export/import, optional cloud-folder backups.
const fs = require('fs');
const path = require('path');
const P = require('./paths');
const log = require('./log');

const KEEP = 5, MIN_BACKUP_GAP = 10 * 60 * 1000;
let lastBackup = 0;
const ts = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
const ensure = () => { fs.mkdirSync(P.backupsDir, { recursive: true }); };

function validate(text) {
  let j; try { j = JSON.parse(text); } catch { return 'not valid JSON'; }
  if (!j || typeof j !== 'object' || typeof j.v !== 'number' || !j.res || !Array.isArray(j.buildings)) return 'not a Kingdoms of War save';
  return null;
}
function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp'; fs.writeFileSync(tmp, text); fs.renameSync(tmp, file);
}
function prune(prefix, keep) {
  try {
    const fl = fs.readdirSync(P.backupsDir).filter(f => f.startsWith(prefix)).map(f => ({ f, t: fs.statSync(path.join(P.backupsDir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const x of fl.slice(keep)) fs.unlinkSync(path.join(P.backupsDir, x.f));
  } catch (e) { log.warn('prune failed', e); }
}
function backupNow(prefix = 'save', keep = KEEP) {
  if (!fs.existsSync(P.saveFile)) return null;
  ensure(); const dst = path.join(P.backupsDir, `${prefix}-${ts()}.json`);
  try { fs.copyFileSync(P.saveFile, dst); prune(prefix + '-', keep); return dst; } catch (e) { log.warn('backup failed', e); return null; }
}
function listBackups() {
  try { return fs.readdirSync(P.backupsDir).filter(f => f.endsWith('.json')).map(f => ({ file: path.join(P.backupsDir, f), name: f, time: fs.statSync(path.join(P.backupsDir, f)).mtimeMs })).sort((a, b) => b.time - a.time); } catch { return []; }
}
function load() {
  try { if (fs.existsSync(P.saveFile)) { const t = fs.readFileSync(P.saveFile, 'utf8'); if (!validate(t)) return t; log.warn('save file invalid, trying backups'); } } catch (e) { log.warn('save read failed', e); }
  for (const b of listBackups().filter(b => b.name.startsWith('save-'))) { try { const t = fs.readFileSync(b.file, 'utf8'); if (!validate(t)) { log.warn('recovered save from backup', b.name); return t; } } catch { /* next */ } }
  return null;
}
// Called from the running game (every ~10 s and on exit). `reason` marks special writes (migration).
function save(text, reason) {
  if (typeof text !== 'string' || text.length > 20e6) return false;
  const err = validate(text); if (err) { log.warn('refusing to write save:', err); return false; }
  const now = Date.now();
  if (reason) backupNow(reason.replace(/[^a-z-]/gi, ''), 3);
  else if (fs.existsSync(P.saveFile) && now - lastBackup > MIN_BACKUP_GAP) { backupNow('save'); lastBackup = now; }
  atomicWrite(P.saveFile, text); return true;
}
function reset() { backupNow('reset', 3); try { fs.unlinkSync(P.saveFile); } catch { /* none */ } return true; }
function info() {
  let size = 0, mtime = 0; try { const s = fs.statSync(P.saveFile); size = s.size; mtime = s.mtimeMs; } catch { /* no save */ }
  return { saveFile: P.saveFile, savesDir: P.savesDir, exists: size > 0, size, mtime, backups: listBackups().length };
}
// ---- export / import (launcher UI)
function exportTo(file) { const t = load(); if (!t) throw new Error('There is no save to export yet — play the game first.'); atomicWrite(file, t); return file; }
function importFrom(file) {
  const t = fs.readFileSync(file, 'utf8'); const err = validate(t); if (err) throw new Error('That file is ' + err + '.');
  backupNow('restore', 5); atomicWrite(P.saveFile, t); lastBackup = Date.now(); return true;
}
// ---- cloud-folder backup (any folder: Google Drive / OneDrive / Dropbox synced directory)
function cloudBackup(dir) {
  if (!dir) throw new Error('Choose a cloud backup folder first (Settings).');
  const t = load(); if (!t) throw new Error('There is no save to back up yet.');
  fs.mkdirSync(dir, { recursive: true });
  const name = `KingdomsOfWar-save-${ts()}.json`; atomicWrite(path.join(dir, name), t); atomicWrite(path.join(dir, 'KingdomsOfWar-save-latest.json'), t);
  try { const old = fs.readdirSync(dir).filter(f => /^KingdomsOfWar-save-\d{8}-\d{6}\.json$/.test(f)).sort().reverse(); for (const f of old.slice(10)) fs.unlinkSync(path.join(dir, f)); } catch { /* ignore */ }
  return path.join(dir, name);
}
function cloudLatest(dir) { const f = path.join(dir || '', 'KingdomsOfWar-save-latest.json'); return dir && fs.existsSync(f) ? f : null; }
module.exports = { load, save, reset, info, exportTo, importFrom, cloudBackup, cloudLatest, validate, backupNow, listBackups };
