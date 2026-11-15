// Persistence layer. In the desktop launcher a preload bridge (window.slideNative) stores the save as a file in %APPDATA%/Slide/saves
// (never touched by updates, rotating backups). In a normal browser we fall back to localStorage.
const KEY = 'slide_save_v1';
const N = typeof window !== 'undefined' ? window.slideNative : null;
const ls = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(t) { try { localStorage.setItem(KEY, t); return true; } catch { return false; } },
  del() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};
export const storage = {
  native: !!N,
  load() {
    if (!N) return ls.get();
    let t = null; try { t = N.loadSave(); } catch { /* bridge error */ }
    if (t) return t;
    const old = ls.get(); if (old) { try { N.saveSync(old, 'migrated-from-localstorage'); } catch { /* ignore */ } return old; }
    return null;
  },
  save(text) { if (N) { try { return !!N.saveSync(text); } catch { return false; } } return ls.set(text); },
  remove() { if (N) { try { N.resetSave(); } catch { /* ignore */ } } ls.del(); },
  info() { return N && N.info ? N.info() : null; },
};
export const buildInfo = { version: '', savePath: '' };
fetch('version.json').then(r => (r.ok ? r.json() : null)).then(j => { if (j) buildInfo.version = j.version; }).catch(() => {});
try { const i = storage.info(); if (i) buildInfo.savePath = i.saveFile; } catch { /* ignore */ }
