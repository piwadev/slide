// Admin command set (owner-only; the console UI gates access with the PBKDF2 verifier). Commands act on the Profile and ask the app to launch things.
import { CARS, carById } from '../data/cars.js';
import { PERF, PERF_KEYS } from '../data/parts.js';
import { MAPS, MAP_IDS } from '../data/maps.js';
import { EVENTS, eventById } from '../data/events.js';
import { CATALOG, itemKey, MAX_LEVEL } from './progress.js';

const num = (s, d = 0) => { const n = Number(String(s).replace(/[,_k]/gi, m => (m.toLowerCase() === 'k' ? '000' : ''))); return Number.isFinite(n) ? n : d; };
export const COMMANDS = {
  help: { usage: 'help', run: () => ({ ok: true, lines: Object.entries(COMMANDS).map(([k, c]) => `${k.padEnd(11)} ${c.usage}`) }) },
  money: { usage: 'money <amount>  (negative removes)', run: (p, a) => { const n = num(a[0], NaN); if (isNaN(n)) return err('amount?'); p.addCash(n); return ok(`cash ${n >= 0 ? '+' : ''}${n.toLocaleString()} -> $${p.save.cash.toLocaleString()}`); } },
  dp: { usage: 'dp <amount>', run: (p, a) => { const n = num(a[0], NaN); if (isNaN(n)) return err('amount?'); p.addDP(n); return ok(`Drift Points -> ${p.save.dp.toLocaleString()}`); } },
  xp: { usage: 'xp <amount>', run: (p, a, app) => { const n = num(a[0], NaN); if (isNaN(n)) return err('amount?'); const l = p.addXP(n); return ok(`xp +${n} -> level ${p.level}${l.length ? ' (level up!)' : ''}`); } },
  level: { usage: 'level <1-' + MAX_LEVEL + '>', run: (p, a) => { const n = num(a[0], NaN); if (isNaN(n)) return err('level?'); p.setLevel(n); return ok('level ' + p.level); } },
  unlockall: { usage: 'unlockall  (cars, parts, maps, events)', run: (p) => { unlockCars(p); unlockParts(p); unlockMaps(p); p.save.admin.allEvents = true; p.touch(); return ok('everything unlocked (cars, parts, maps, events)'); } },
  unlockcars: { usage: 'unlockcars  (adds every car to the garage)', run: (p) => { unlockCars(p); return ok(`garage: ${Object.keys(p.save.owned).length} cars`); } },
  unlockparts: { usage: 'unlockparts  (all cosmetics; max level gates removed)', run: (p) => { unlockParts(p); return ok('all cosmetic parts unlocked'); } },
  unlockmaps: { usage: 'unlockmaps', run: (p) => { unlockMaps(p); return ok('all maps unlocked'); } },
  maxcar: { usage: 'maxcar [carId]  (all performance upgrades to max)', run: (p, a) => { const id = a[0] || p.save.selected; if (!p.save.owned[id]) { if (!carById[id]) return err('unknown car'); p.save.owned[id] = { cfg: null, bought: Date.now() }; p.save.owned[id].cfg = p.fixCfg(carById[id], null); } const cfg = p.save.owned[id].cfg; for (const k of PERF_KEYS) cfg.perf[k] = PERF[k].lv.length - 1; p.touch(); return ok(`${id} fully upgraded`); } },
  givecar: { usage: 'givecar <carId>', run: (p, a) => { const c = carById[a[0]]; if (!c) return err('cars: ' + CARS.map(c => c.id).join(' ')); if (!p.save.owned[c.id]) p.save.owned[c.id] = { cfg: p.fixCfg(c, null), bought: Date.now() }; p.touch(); return ok('added ' + c.name); } },
  event: { usage: 'event <n|id>  (jump straight into a career event)', run: (p, a, app) => { const k = a[0]; const ev = eventById[k] || eventById['e' + k]; if (!ev) return err(`events: 1-${EVENTS.length}`); p.save.admin.allEvents = true; app.launchEvent && setTimeout(() => app.launchEvent(ev.id, true), 80); return ok(`launching ${ev.name}…`, true); } },
  complete: { usage: 'complete <n|all>  (mark events as 3-star)', run: (p, a) => { const list = a[0] === 'all' ? EVENTS : [eventById[a[0]] || eventById['e' + a[0]]].filter(Boolean); if (!list.length) return err('event?'); for (const e of list) p.save.events[e.id] = { stars: 3, best: e.target || 0, wins: 1 }; p.touch(); return ok(`${list.length} event(s) completed`); } },
  drive: { usage: 'drive <map> [mode] [day|dusk|night]  (free roam on any map)', run: (p, a, app) => { if (!MAPS[a[0]]) return err('maps: ' + MAP_IDS.join(' ')); p.save.maps[a[0]] = 1; app.launchQuick && setTimeout(() => app.launchQuick({ mapId: a[0], mode: a[1] || 'free', tod: a[2] }), 80); return ok('launching…', true); } },
  daily: { usage: 'daily  (re-roll today\'s daily challenges)', run: (p) => { p.save.daily.date = 0; p.ensureDaily(); return ok('new dailies'); } },
  debug: { usage: 'debug [on|off]  (fps / physics overlay)', run: (p, a, app) => { p.save.admin.debug = a[0] ? a[0] === 'on' : !p.save.admin.debug; p.touch(); app.setDebug && app.setDebug(p.save.admin.debug); return ok('debug ' + (p.save.admin.debug ? 'on' : 'off')); } },
  status: { usage: 'status', run: (p) => ok(`level ${p.level}  xp ${p.save.xp}/${p.xpNeed}  cash $${p.save.cash.toLocaleString()}  DP ${p.save.dp}  cars ${Object.keys(p.save.owned).length}  wins ${p.save.stats.eventsWon}`) },
  reset: { usage: 'reset confirm  (wipes the save!)', run: (p, a) => a[0] === 'confirm' ? { ok: true, reset: true, lines: ['wiping save…'] } : err('type: reset confirm') },
  clear: { usage: 'clear', run: () => ({ ok: true, clear: true, lines: [] }) },
  lock: { usage: 'lock', run: () => ({ ok: true, lock: true, lines: [] }) },
};
const ok = (t, nochange) => ({ ok: true, lines: [t], changed: !nochange }); const err = (t) => ({ ok: false, error: t });
function unlockCars(p) { for (const c of CARS) if (!p.save.owned[c.id]) p.save.owned[c.id] = { cfg: p.fixCfg(c, null), bought: Date.now() }; p.touch(); }
function unlockParts(p) { for (const [k, cat] of Object.entries(CATALOG)) for (const it of cat.list) p.save.unlocked[itemKey(k, it.id)] = 1; p.touch(); }
function unlockMaps(p) { for (const id of MAP_IDS) p.save.maps[id] = 1; p.touch(); }
export function runAdmin(line, profile, app) {
  const parts = line.trim().split(/\s+/); const cmd = (parts.shift() || '').toLowerCase(); const c = COMMANDS[cmd]; if (!c) return err(`unknown command "${cmd}" — try help`);
  try { return c.run(profile, parts, app); } catch (e) { return err(String(e.message || e)); }
}
// level gates are bypassed for admin "unlockall": parts/cars checks in the UI use profile.level; the admin raises it too when needed.
