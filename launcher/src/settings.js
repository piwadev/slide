const fs = require('fs');
const path = require('path');
const P = require('./paths');
const DEFAULTS = { autoCheck: true, autoInstall: true, closeLauncherOnPlay: false, cloudDir: '', autoCloud: false, apiUrl: '' };
let cur = null;
function get() {
  if (!cur) { try { cur = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(P.settingsFile, 'utf8')) }; } catch { cur = { ...DEFAULTS }; } }
  return cur;
}
function set(patch) {
  const s = get(); for (const k of Object.keys(DEFAULTS)) if (k in patch) s[k] = typeof DEFAULTS[k] === typeof patch[k] ? patch[k] : s[k];
  fs.mkdirSync(path.dirname(P.settingsFile), { recursive: true }); fs.writeFileSync(P.settingsFile, JSON.stringify(s, null, 2)); return s;
}
module.exports = { get, set, DEFAULTS };
