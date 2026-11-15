const fs = require('fs');
const path = require('path');
const P = require('./paths');
let ready = false;
function line(level, args) {
  const s = `${new Date().toISOString()} [${level}] ${args.map(a => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
  try {
    if (!ready) { fs.mkdirSync(path.dirname(P.logFile), { recursive: true }); ready = true; try { if (fs.statSync(P.logFile).size > 512 * 1024) fs.renameSync(P.logFile, P.logFile + '.old'); } catch { /* new */ } }
    fs.appendFileSync(P.logFile, s);
  } catch { /* logging must never throw */ }
  (level === 'error' ? console.error : console.log)(s.trim());
}
module.exports = { info: (...a) => line('info', a), warn: (...a) => line('warn', a), error: (...a) => line('error', a) };
