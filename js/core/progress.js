// Player profile: versioned save, economy (cash / XP / Drift Points), unlocks, garage ownership, daily challenges, achievements,
// career results and local leaderboards. Everything the UI shows about "you" lives here.
import { storage } from './save.js';
import { CARS, carById } from '../data/cars.js';
import { PART_CATS, WHEEL_DESIGNS, TIRES, FINISHES, LIVERIES, STICKERS, HEADLIGHTS, UNDERGLOW, FLAMES, PERF, PERF_KEYS, defaultCfg } from '../data/parts.js';
import { MAPS, MAP_IDS } from '../data/maps.js';
import { EVENTS, eventById, DAILY_POOL, ACHIEVEMENTS, TIERS } from '../data/events.js';

export const SAVE_VERSION = 2;
// cosmetic catalogue keyed by unlock category
export const CATALOG = {};
for (const [k, c] of Object.entries(PART_CATS)) CATALOG[k] = { label: c.label, list: c.items };
Object.assign(CATALOG, { wheel: { label: 'Wheel Design', list: WHEEL_DESIGNS }, tire: { label: 'Tyres', list: TIRES }, finish: { label: 'Paint Finish', list: FINISHES }, livery: { label: 'Livery', list: LIVERIES }, sticker: { label: 'Sticker', list: STICKERS }, head: { label: 'Headlights', list: HEADLIGHTS }, glow: { label: 'Underglow', list: UNDERGLOW }, flames: { label: 'Flames', list: FLAMES } });
export const xpForLevel = (l) => Math.round(200 + 60 * Math.pow(l, 1.45));
export const MAX_LEVEL = 60;
const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const RIVALS = ['KAZE', 'Takumi F.', 'MikaDrift', 'Haru_86', 'Ryo Nakamura', 'NightOwl', 'Sakura-R', 'TougeKing', 'Drift.Mom', 'Ken Kuroda', 'Yuki S.', 'Apex_Dan'];
export const itemKey = (cat, id) => cat + ':' + id;

function freshSave() {
  const car = carById.s13; const cfg = defaultCfg(car);
  return {
    v: SAVE_VERSION, name: 'DRIVER', created: Date.now(), level: 1, xp: 0, cash: 12000, dp: 20, selected: 's13', owned: { s13: { cfg, bought: Date.now() } }, unlocked: {}, maps: {},
    settings: { quality: 'high', master: 0.8, music: true, cam: 0, sens: 0.5, manual: false, units: 'kmh', tod: 'auto', hud: true, shake: true },
    stats: { totalScore: 0, drifts: 0, bestCombo: 0, bestAngle: 0, longest: 0, nearMiss: 0, km: 0, tandemPts: 0, eventsWon: 0, topSpeed: 0, crashes: 0, bestMult: 1, bestChain: 0, runs: 0, playTime: 0, discovered: 0, cashEarned: 0, cashSpent: 0 },
    records: { lap: {}, score: {} }, events: {}, daily: { date: 0, items: [], streak: 0, lastClaim: 0, loginClaimed: 0 }, achievements: {}, discovered: {}, recent: [], boards: {}, admin: { debug: false },
  };
}
export class Profile {
  constructor() { this.listeners = new Set(); this.save = this.load(); this.ensureDaily(); this.checkAchievements(); this.flush(); window.addEventListener('beforeunload', () => this.flush()); }
  load() {
    let s = null; try { const t = storage.load(); if (t) s = JSON.parse(t); } catch { s = null; }
    if (!s || typeof s !== 'object') return freshSave();
    const f = freshSave(); // migrate: deep-merge defaults for missing keys
    const merge = (d, t) => { for (const k of Object.keys(d)) { if (t[k] === undefined) t[k] = d[k]; else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && t[k] && typeof t[k] === 'object') merge(d[k], t[k]); } return t; };
    s = merge(f, s); if (!s.owned || !Object.keys(s.owned).length) s.owned = f.owned;
    for (const id of Object.keys(s.owned)) { if (!carById[id]) { delete s.owned[id]; continue; } s.owned[id].cfg = this.fixCfg(carById[id], s.owned[id].cfg); }
    if (!s.owned[s.selected]) s.selected = Object.keys(s.owned)[0]; s.v = SAVE_VERSION; return s;
  }
  fixCfg(car, cfg) { const d = defaultCfg(car); const m = (a, b) => { if (!b || typeof b !== 'object') return a; for (const k of Object.keys(a)) { if (b[k] === undefined) b[k] = a[k]; else if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) m(a[k], b[k]); } return b; }; return m(d, cfg || {}); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const f of this.listeners) f(this.save); this.dirty = true; clearTimeout(this._t); this._t = setTimeout(() => this.flush(), 400); }
  flush() { if (!this.dirty && this._init) return; this._init = true; this.dirty = false; storage.save(JSON.stringify(this.save)); }
  reset() { this.save = freshSave(); this.ensureDaily(); this.flush(); this.emit(); }
  get level() { return this.save.level; }
  // ------------------------------------------------------------- economy
  addCash(n) { this.save.cash = Math.max(0, Math.round(this.save.cash + n)); if (n > 0) this.save.stats.cashEarned += n; this.emit(); }
  addDP(n) { this.save.dp = Math.max(0, Math.round(this.save.dp + n)); this.emit(); }
  addXP(n) { const out = []; const s = this.save; s.xp += Math.round(n); while (s.level < MAX_LEVEL && s.xp >= xpForLevel(s.level)) { s.xp -= xpForLevel(s.level); s.level++; out.push(s.level); this.noteUnlocks(s.level); } if (s.level >= MAX_LEVEL) s.xp = Math.min(s.xp, xpForLevel(MAX_LEVEL) - 1); this.emit(); return out; }
  setLevel(l) { l = Math.max(1, Math.min(MAX_LEVEL, l | 0)); const up = l > this.save.level; const old = this.save.level; this.save.level = l; this.save.xp = 0; if (up) for (let i = old + 1; i <= l; i++) this.noteUnlocks(i); this.emit(); }
  noteUnlocks(lvl) {
    const add = (kind, name, extra = '') => { this.save.recent.unshift({ kind, name, lvl, extra, ts: Date.now() }); };
    for (const c of CARS) if (c.level === lvl) add('car', `${c.make} ${c.name}`);
    for (const [id, m] of Object.entries(MAPS)) if (m.level === lvl) add('map', m.name);
    for (const [k, cat] of Object.entries(CATALOG)) for (const it of cat.list) if (it.lvl === lvl && it.price > 0 && lvl > 1) add('part', `${it.name}`, cat.label);
    for (const k of PERF_KEYS) PERF[k].lv.forEach((l2, i) => { if (l2.lvl === lvl && i > 0 && lvl > 1) add('perf', `${PERF[k].label}: ${l2.name}`); });
    this.save.recent = this.save.recent.slice(0, 14);
  }
  get xpNeed() { return xpForLevel(this.save.level); }
  stat(k, n = 1) { this.save.stats[k] = (this.save.stats[k] || 0) + n; this.dirty = true; }
  // ------------------------------------------------------------- unlocks / ownership
  isFree(it) { return !it.price; }
  hasItem(cat, id) { const it = CATALOG[cat].list.find(i => i.id === id); if (!it) return false; return this.isFree(it) || !!this.save.unlocked[itemKey(cat, id)]; }
  canBuyItem(cat, it) { const s = this.save; if (s.level < (it.lvl || 1)) return { ok: false, err: `Reach level ${it.lvl}` }; if (s.cash < it.price) return { ok: false, err: 'Not enough cash' }; if (it.dp && s.dp < it.dp) return { ok: false, err: `Needs ${it.dp} Drift Points` }; return { ok: true }; }
  buyItem(cat, id) { const it = CATALOG[cat].list.find(i => i.id === id); if (!it) return { ok: false, err: 'Unknown item' }; if (this.hasItem(cat, id)) return { ok: true, owned: true }; const c = this.canBuyItem(cat, it); if (!c.ok) return c; this.save.cash -= it.price; this.save.stats.cashSpent += it.price; if (it.dp) this.save.dp -= it.dp; this.save.unlocked[itemKey(cat, id)] = 1; this.emit(); return { ok: true }; }
  ownsCar(id) { return !!this.save.owned[id]; }
  canBuyCar(c) { const s = this.save; if (s.level < c.level) return { ok: false, err: `Reach level ${c.level}` }; if (s.cash < c.price) return { ok: false, err: 'Not enough cash' }; return { ok: true }; }
  buyCar(id) { const c = carById[id]; if (!c) return { ok: false, err: 'Unknown car' }; if (this.ownsCar(id)) return { ok: true, owned: true }; const k = this.canBuyCar(c); if (!k.ok) return k; this.save.cash -= c.price; this.save.stats.cashSpent += c.price; this.save.owned[id] = { cfg: defaultCfg(c), bought: Date.now() }; this.save.selected = id; this.emit(); return { ok: true }; }
  sellValue(id) { const c = carById[id]; let v = c.price; const cfg = this.save.owned[id].cfg; for (const k of PERF_KEYS) for (let i = 1; i <= cfg.perf[k]; i++) v += PERF[k].lv[i].price; return Math.round(v * 0.55); }
  sellCar(id) { if (Object.keys(this.save.owned).length <= 1) return { ok: false, err: 'Keep at least one car' }; if (!this.ownsCar(id)) return { ok: false, err: 'Not owned' }; this.addCash(this.sellValue(id)); delete this.save.owned[id]; if (this.save.selected === id) this.save.selected = Object.keys(this.save.owned)[0]; this.emit(); return { ok: true }; }
  select(id) { if (this.ownsCar(id)) { this.save.selected = id; this.emit(); } }
  get car() { return carById[this.save.selected]; }
  get cfg() { return this.save.owned[this.save.selected].cfg; }
  cfgOf(id) { return this.save.owned[id] && this.save.owned[id].cfg; }
  touch() { this.emit(); }
  perfCan(carId, key) { const cfg = this.cfgOf(carId); const lv = PERF[key].lv; const cur = cfg.perf[key]; if (cur >= lv.length - 1) return { ok: false, err: 'Maxed', max: true }; const n = lv[cur + 1]; const s = this.save; if (s.level < n.lvl) return { ok: false, err: `Reach level ${n.lvl}` }; if (s.cash < n.price) return { ok: false, err: 'Not enough cash' }; if (n.dp && s.dp < n.dp) return { ok: false, err: `Needs ${n.dp} DP` }; return { ok: true }; }
  buyPerf(carId, key) { const c = this.perfCan(carId, key); if (!c.ok) return c; const cfg = this.cfgOf(carId); const n = PERF[key].lv[cfg.perf[key] + 1]; this.save.cash -= n.price; this.save.stats.cashSpent += n.price; if (n.dp) this.save.dp -= n.dp; cfg.perf[key]++; this.emit(); return { ok: true }; }
  mapOpen(id) { return this.save.level >= MAPS[id].level || !!this.save.maps[id]; }
  eventOpen(ev) { return this.save.level >= ev.lvl || !!this.save.admin.allEvents; }
  // ------------------------------------------------------------- daily
  ensureDaily() {
    const d = this.save.daily, t = today(); if (d.date === t && d.items.length) return;
    const prevDay = d.date; const rnd = mulberry(t ^ 0x5eed); const pool = DAILY_POOL.slice(); const items = []; const lvl = this.save.level;
    for (let i = 0; i < 3; i++) { const p = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; let target = p.base + p.per * lvl * (p.id === 'total' || p.id === 'combo' || p.id === 'tandem' ? 6 : 1); if (p.cap) target = Math.min(p.cap, target); target = p.id === 'near' || p.id === 'dist' || p.id === 'long' || p.id === 'chain' || p.id === 'mult' || p.id === 'angle' || p.id === 'event' ? Math.round(target) : Math.round(target / 100) * 100; items.push({ id: p.id, text: p.text.replace('{n}', target.toLocaleString()), target, progress: 0, done: false, claimed: false, stat: p.stat, max: !!p.max, reward: { cash: Math.round((1500 + lvl * 220) * (1 + i * 0.4) / 50) * 50, xp: 80 + lvl * 8 + i * 40, dp: 5 + i * 5 } }); }
    d.date = t; d.items = items; d.loginClaimed = 0;
    const yesterday = (() => { const y = new Date(); y.setDate(y.getDate() - 1); return y.getFullYear() * 10000 + (y.getMonth() + 1) * 100 + y.getDate(); })(); if (d.lastClaim !== yesterday && d.lastClaim !== t) d.streak = 0;
    this.emit();
  }
  loginReward() { const d = this.save.daily; const day = (d.streak % 7) + 1; return { day, cash: 1000 * day + 500, dp: day * 4, xp: 60 * day, big: day === 7 }; }
  claimLogin() { const d = this.save.daily; if (d.loginClaimed) return null; const r = this.loginReward(); d.loginClaimed = 1; d.lastClaim = today(); d.streak++; this.addCash(r.cash); this.addDP(r.dp); this.addXP(r.xp); return r; }
  dailyProgress(res) {
    const done = []; const s = res.stats;
    for (const it of this.save.daily.items) { if (it.done) continue; let v = 0; if (it.stat === 'score') v = res.score; else if (it.stat === 'events') v = res.eventId && res.stars > 0 ? 1 : 0; else v = s[it.stat] || 0; if (it.max) it.progress = Math.max(it.progress, v); else it.progress += v; if (it.progress >= it.target) { it.done = true; it.progress = it.target; done.push(it); } }
    return done;
  }
  claimDaily(i) { const it = this.save.daily.items[i]; if (!it || !it.done || it.claimed) return null; it.claimed = true; this.addCash(it.reward.cash); this.addDP(it.reward.dp); const lv = this.addXP(it.reward.xp); this.emit(); return { ...it.reward, levelUps: lv }; }
  // ------------------------------------------------------------- results
  discover(mapId, d) { const a = (this.save.discovered[mapId] = this.save.discovered[mapId] || []); if (!a.includes(d.id)) { a.push(d.id); this.save.stats.discovered++; this.addXP(d.xp); } }
  applyRun(res) {
    const s = this.save, st = s.stats, out = { cash: 0, xp: 0, dp: 0, levelUps: [], achievements: [], records: [], daily: [], event: null, firstWin: false };
    const rs = res.stats; st.runs++; st.totalScore += res.score; st.drifts += rs.drifts || 0; st.km += rs.km || 0; st.nearMiss += rs.nearMiss || 0; st.tandemPts += Math.round(rs.tandemPts || 0); st.playTime += res.time || 0;
    const mx = (k, v) => { if ((v || 0) > st[k]) { st[k] = v; return true; } return false; };
    if (mx('bestCombo', Math.round(rs.bestCombo))) out.records.push(`Best combo ${Math.round(rs.bestCombo).toLocaleString()}`); if (mx('bestAngle', Math.round(rs.bestAngle))) out.records.push(`Best angle ${Math.round(rs.bestAngle)}°`); if (mx('longest', +(rs.longest || 0).toFixed(1))) out.records.push(`Longest drift ${rs.longest.toFixed(1)}s`); mx('topSpeed', Math.round(rs.topSpeed)); mx('bestMult', +(rs.bestMult || 1).toFixed(1)); mx('bestChain', rs.bestChain);
    const key = `${res.mapId}:${res.mode}`;
    if (res.par) { s.records.par = s.records.par || {}; s.records.par[res.mapId] = res.par; }
    if (res.mode === 'timeattack') { if (res.bestLap && (!s.records.lap[res.mapId] || res.bestLap < s.records.lap[res.mapId])) { s.records.lap[res.mapId] = res.bestLap; out.records.push(`New best lap ${MAPS[res.mapId].name}`); } this.board(key, res.bestLap || 0, res.carId, true); }
    else { if (res.score > (s.records.score[key] || 0)) { s.records.score[key] = res.score; if (res.score > 0) out.records.push(`Record: ${MAPS[res.mapId].name}`); } this.board(key, res.score, res.carId, false); }
    // economy
    let cash = Math.round(res.score * 0.2), xp = Math.round(res.score / 30) + Math.round((rs.nearMiss || 0) * 3), dp = Math.round(res.score / 100);
    if (res.eventId) {
      const ev = eventById[res.eventId]; const prev = s.events[ev.id] || { stars: 0, best: 0, wins: 0 }; const mult = [0, 1, 1.25, 1.6][res.stars];
      if (res.stars > 0) { let k = 0; if (!prev.stars) { k = mult; out.firstWin = true; } else if (res.stars > prev.stars) k = mult - [0, 1, 1.25, 1.6][prev.stars] + 0.25; else k = 0.3;
        const r = { cash: Math.round(ev.reward.cash * k), xp: Math.round(ev.reward.xp * k), dp: Math.round(ev.reward.dp * k) }; cash += r.cash; xp += r.xp; dp += r.dp; out.event = r; if (!prev.stars) st.eventsWon++; }
      prev.stars = Math.max(prev.stars, res.stars); prev.best = res.mode === 'timeattack' ? (prev.best && res.bestLap ? Math.min(prev.best, res.bestLap) : (res.bestLap || prev.best)) : Math.max(prev.best, res.score); prev.wins = (prev.wins || 0) + (res.stars ? 1 : 0); s.events[ev.id] = prev;
    }
    out.cash = cash; out.xp = xp; out.dp = dp; this.addCash(cash); this.addDP(dp); out.levelUps = this.addXP(xp);
    out.daily = this.dailyProgress(res); this.checkAchievements(out.achievements); this.emit(); this.flush(); return out;
  }
  checkAchievements(list) {
    const st = this.save.stats; const flat = { ...st, discovered: st.discovered };
    for (const a of ACHIEVEMENTS) { if (this.save.achievements[a.id]) continue; let ok = false; try { ok = a.test(flat, this); } catch { ok = false; } if (a.id === 'tuner') ok = Object.entries(this.save.owned).some(([id, o]) => PERF_KEYS.every(k => o.cfg.perf[k] >= PERF[k].lv.length - 1)); if (ok) { this.save.achievements[a.id] = Date.now(); if (list) list.push(a); this.save.recent.unshift({ kind: 'ach', name: a.name, lvl: this.save.level, ts: Date.now() }); } }
    this.save.recent = this.save.recent.slice(0, 14);
  }
  // ------------------------------------------------------------- leaderboards (local + rival ghosts)
  board(key, val, carId, low) { if (!val) return; const b = (this.save.boards[key] = this.save.boards[key] || []); b.push({ v: val, car: carId, ts: Date.now() }); b.sort((x, y) => low ? x.v - y.v : y.v - x.v); this.save.boards[key] = b.slice(0, 10); }
  leaderboard(mapId, mode) {
    const key = `${mapId}:${mode}`; const mine = (this.save.boards[key] || []).map(e => ({ name: this.save.name, v: e.v, car: e.car, me: true }));
    const rnd = mulberry(hash(key)); const m = MAPS[mapId]; const rows = [];
    for (let i = 0; i < 9; i++) { const name = RIVALS[(hash(key) + i * 5) % RIVALS.length]; let v; if (mode === 'timeattack') { const lap = (this.save.records.par && this.save.records.par[mapId]) || 70; v = lap * (0.9 + i * 0.05 + rnd() * 0.02); } else { v = Math.round((16000 + m.level * 4200) * Math.pow(0.8, i) * (0.9 + rnd() * 0.2) / 50) * 50; } rows.push({ name, v, car: CARS[(hash(name) + i) % CARS.length].id, me: false }); }
    const all = rows.concat(mine); all.sort((a, b) => mode === 'timeattack' ? a.v - b.v : b.v - a.v); return all.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
  }
}
