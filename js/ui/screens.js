// Menu shell + screens: DRIVE (home), GARAGE, CAREER, EVENTS, SHOP, PROFILE; settings, pause, results and level-up overlays.
import { $, $$, el, fmt, money, esc, fmtTime, stars, clamp } from './dom.js';
import { CARS, carById, CLASSES } from '../data/cars.js';
import { MAPS, MAP_IDS, TODS } from '../data/maps.js';
import { EVENTS, TIERS, MODE_NAMES, eventById, ACHIEVEMENTS } from '../data/events.js';
import { statBars, defaultCfg } from '../data/parts.js';
import { xpForLevel } from '../core/progress.js';
import { buildInfo, storage } from '../core/save.js';
import { audio } from '../audio.js';
import { GarageUI } from './garageUI.js';

const MAP_GRAD = { tokyo: 'linear-gradient(135deg,#ff2d95,#3a0f66 60%,#06122a)', arena: 'linear-gradient(135deg,#ffb000,#5a3300 60%,#120a00)', industrial: 'linear-gradient(135deg,#aab4c0,#3b4452 60%,#14181e)', mountain: 'linear-gradient(135deg,#ff8a3d,#6a2d52 55%,#101528)', harbor: 'linear-gradient(135deg,#3fb6c9,#2b4a6e 55%,#2a1710)', desert: 'linear-gradient(135deg,#f2b560,#b2602a 60%,#3a1a0e)' };
const NAV = [['drive', 'Drive'], ['garage', 'Garage'], ['career', 'Career'], ['events', 'Events'], ['shop', 'Shop'], ['profile', 'Profile']];
const DIFFS = { easy: ['Easy', 0.6, 1.0], normal: ['Normal', 1, 1], hard: ['Hard', 1.8, 0.95], insane: ['Insane', 3, 0.9] };

export class UI {
  constructor(app) { this.app = app; this.P = app.profile; this.menu = $('#menu'); this.layer = $('#layer'); this.tab = 'drive'; this.sel = { map: this.P.save.settings.lastMap || 'tokyo', mode: 'free', tod: 'auto', diff: 'normal', laps: 3, ev: null }; this.garageUI = new GarageUI(this); this.P.on(() => this.refreshPills());
    this.menu.addEventListener('click', e => this.click(e)); this.layer.addEventListener('click', e => this.layerClick(e)); document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('.btn,.nav button,.item,.chip,.mapcard'); if (b && b !== this._hov) { this._hov = b; audio.hover(); } });
  }
  // ---------------------------------------------------------------- shell
  showMenu(tab) {
    this.menu.classList.remove('hidden'); this.app.hud.root.classList.add('hidden'); this.layer.innerHTML = ''; this.tab = tab || this.tab;
    this.menu.innerHTML = `<div class="vig"></div>
      <div class="topbar"><div class="logo">SLIDE<small>STREET DRIFT</small></div>
        <div class="hud-pills"><div class="pill cash"><i>CASH</i><b id="pCash"></b></div><div class="pill dp"><i>DRIFT PTS</i><b id="pDP"></b></div>
          <div id="pcard" title="Profile"><div class="lvl" id="pLvl"><b></b></div><div><div class="pc-name" id="pName"></div><div class="pc-sub" id="pSub"></div></div></div>
          <button class="iconbtn" data-a="settings" title="Settings">⚙</button></div></div>
      <div class="nav">${NAV.map(([k, l]) => `<button data-nav="${k}">${l}${k === 'career' ? '' : ''}</button>`).join('')}</div><div id="screen"></div>`;
    this.refreshPills(); this.go(this.tab);
  }
  refreshPills() {
    const s = this.P.save; const c = $('#pCash'); if (!c) return; c.textContent = money(s.cash); $('#pDP').textContent = fmt(s.dp); $('#pName').textContent = s.name; $('#pSub').textContent = `LEVEL ${s.level} · ${fmt(s.xp)}/${fmt(xpForLevel(s.level))} XP`; const l = $('#pLvl'); l.style.setProperty('--p', Math.round(s.xp / xpForLevel(s.level) * 100)); l.firstChild.textContent = s.level;
  }
  refresh() { this.refreshPills(); if ($('#screen')) this.go(this.tab); }
  go(tab) {
    if (this.tab === 'garage' && tab !== 'garage') this.garageUI.close(); this.tab = tab; $$('.nav button', this.menu).forEach(b => b.classList.toggle('on', b.dataset.nav === tab));
    const root = $('#screen'); root.innerHTML = ''; const g = this.app.garage; g.active || g.enter({ quality: this.P.save.settings.quality });
    const car = this.P.car; if (!g.model || g.car !== car || tab !== 'garage') { g.setCar(car, this.P.cfg); }
    if (tab !== 'garage') { g.go('menu'); g.setOffset(tab === 'drive' ? 0.2 : 0.2); }
    this['s_' + tab](root);
  }
  // ---------------------------------------------------------------- DRIVE
  s_drive(root) {
    const P = this.P, s = P.save, car = P.car, cfg = P.cfg, bars = statBars(car, cfg); const m = this.sel.map;
    const dly = s.daily.items; const lg = P.loginReward(); const claimed = s.daily.loginClaimed;
    root.innerHTML = `<div class="screen home">
        <div style="display:flex;gap:12px;align-items:center"><button class="btn pri big" data-a="drive">DRIVE</button><div style="color:var(--mt);font:600 13px/1.4 'Barlow Condensed';letter-spacing:.14em;text-transform:uppercase">Free roam on<br><b style="color:#fff;font-size:17px">${MAPS[m].name}</b></div></div>
        <div class="panel carcard"><div class="carname">${esc(car.make)} ${esc(car.name)}</div><div class="carmeta"><span class="tag or">${CLASSES[car.cls]}</span><span class="tag">${car.drive}</span><span class="tag">${Math.round(P.save.owned[car.id] ? bars.Power * 8 + 100 : 0)} hp</span><span class="tag">${car.year}</span></div>
          <div class="sbars">${Object.entries(bars).map(([k, v]) => `<div class="sb"><span>${k}</span><div class="bar"><i style="width:${v}%"></i></div><em>${Math.round(v)}</em></div>`).join('')}</div>
          <div style="display:flex;gap:8px;margin-top:12px"><button class="btn sm" data-nav="garage">Customise</button><button class="btn sm" data-a="nextcar">Switch car ›</button></div></div>
        <div class="panel card"><div class="maps">${MAP_IDS.map(id => { const mp = MAPS[id], lock = !P.mapOpen(id); return `<button class="mapcard ${m === id ? 'on' : ''} ${lock ? 'lock' : ''}" style="--g:${MAP_GRAD[id]}" data-map="${id}"><span>${mp.short}</span><small>${lock ? 'LEVEL ' + mp.level : mp.name}</small>${lock ? '<span class="lk">🔒</span>' : ''}</button>`; }).join('')}</div>
          <div class="modes" style="margin-top:10px">${['auto', ...TODS].map(t => `<button class="chip ${this.sel.tod === t ? 'on' : ''}" data-tod="${t}">${t === 'auto' ? 'Default' : t}</button>`).join('')}</div></div></div>
      <div class="screen side"><div class="panel card daily"><h2 class="t">Daily challenges<small>resets in ${this.resetIn()}</small></h2>${dly.map((d, i) => `<div class="dly ${d.done ? 'done' : ''}"><b>${esc(d.text)}</b>${d.claimed ? '<small>CLAIMED</small>' : d.done ? `<button class="btn sm pri" data-claim="${i}">Claim</button>` : `<small>${money(d.reward.cash)}</small>`}<div class="bar"><i style="width:${Math.round(d.progress / d.target * 100)}%"></i></div></div>`).join('')}
          <button class="btn sm ${claimed ? 'off' : 'pri'}" data-a="login">${claimed ? 'Daily reward claimed ✓' : `Daily reward · Day ${lg.day} · ${money(lg.cash)}`}</button></div>
        <div class="panel card"><h2 class="t">Recently unlocked</h2><div class="rec">${s.recent.slice(0, 5).map(r => `<div><span class="k">${{ car: 'CAR', map: 'MAP', part: 'PART', perf: 'TUNE', ach: 'TROPHY' }[r.kind]}</span>${esc(r.name)}</div>`).join('') || '<div style="color:var(--mt)">Level up to unlock cars, parts and maps.</div>'}</div></div></div>`;
  }
  resetIn() { const n = new Date(); const t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const m = Math.floor((t - n) / 60000); return `${Math.floor(m / 60)}h ${m % 60}m`; }
  // ---------------------------------------------------------------- GARAGE
  s_garage(root) { this.garageUI.open(root); }
  // ---------------------------------------------------------------- CAREER
  s_career(root) {
    const P = this.P, s = P.save; const total = EVENTS.length * 3, got = EVENTS.reduce((a, e) => a + ((s.events[e.id] || {}).stars || 0), 0);
    const sel = this.sel.ev ? eventById[this.sel.ev] : (EVENTS.find(e => !(s.events[e.id] || {}).stars && P.eventOpen(e)) || EVENTS[0]); this.sel.ev = sel.id;
    root.innerHTML = `<div class="screen wide"><div class="panel col-main"><h2 class="t">Career<small>${got}/${total} ★ · ${s.stats.eventsWon}/${EVENTS.length} won</small></h2>
      ${TIERS.map(t => `<div class="tier" style="--c:${t.color}"><h3 style="color:${t.color}">${t.name}<span class="tag" style="margin-left:4px">Lv ${t.lvl}+</span></h3>${EVENTS.filter(e => e.tier === t.id).map(e => { const r = s.events[e.id] || { stars: 0 }, open = P.eventOpen(e); return `<button class="ev ${sel.id === e.id ? 'on' : ''} ${open ? '' : 'lock'}" data-ev="${e.id}"><div class="n" style="--mc:${MAPS[e.map].color}">${e.n}</div><div><b>${esc(e.name)}</b><small>${MAPS[e.map].name} · ${MODE_NAMES[e.mode]}</small></div><div class="st">${open ? '★'.repeat(r.stars) + '<span class="dim">' + '★'.repeat(3 - r.stars) + '</span>' : '🔒 Lv ' + e.lvl}</div></button>`; }).join('')}</div>`).join('')}</div>
      <div class="panel col-side detail">${this.eventDetail(sel)}</div></div>`;
  }
  eventDetail(e) {
    const P = this.P, r = P.save.events[e.id] || { stars: 0, best: 0 }, open = P.eventOpen(e), mp = MAPS[e.map];
    const goal = e.mode === 'timeattack' ? `${e.laps} lap${e.laps > 1 ? 's' : ''}` : `${fmt(e.target)} pts`;
    const thr = e.mode === 'timeattack' ? 'Beat par time for 3★' : `★ ${fmt(e.stars[0])}   ★★ ${fmt(e.stars[1])}   ★★★ ${fmt(e.stars[2])}`;
    return `<div class="tag or">${MODE_NAMES[e.mode]}</div><h1 style="margin-top:8px">${esc(e.name)}</h1><div style="color:var(--mt);font:600 13px 'Barlow Condensed';letter-spacing:.16em;text-transform:uppercase">${mp.name} · ${TIERS[e.tier - 1].name} tier</div><p>${esc(e.desc)}</p>
      <div class="kv"><div><small>Goal</small><b>${goal}</b></div><div><small>Time</small><b>${e.time ? e.time + 's' : '—'}</b></div><div><small>Reward</small><b style="color:#9dff9d">${money(e.reward.cash)}</b></div><div><small>XP / DP</small><b>${e.reward.xp} / ${e.reward.dp}</b></div></div>
      <div style="color:var(--mt);font-size:13px;margin-bottom:6px">${thr}</div><div style="font-size:26px;color:var(--ac2);letter-spacing:4px;margin-bottom:12px">${'★'.repeat(r.stars)}<span class="dim">${'★'.repeat(3 - r.stars)}</span></div>
      <button class="btn pri big" style="width:100%;padding:14px" data-a="startev" ${open ? '' : 'disabled'}>${open ? 'Start event' : 'Reach level ' + e.lvl}</button>
      <h2 class="t" style="margin-top:22px">Leaderboard<small>${mp.short}</small></h2>${this.lbTable(e.map, e.mode === 'timeattack' ? 'timeattack' : e.mode)}`;
  }
  lbTable(mapId, mode) {
    const rows = this.P.leaderboard(mapId, mode); return `<table class="lb">${rows.map(r => `<tr class="${r.me ? 'me' : ''}"><td>${r.rank}</td><td>${esc(r.name)} <small style="color:var(--mt)">${esc(carById[r.car] ? carById[r.car].name : '')}</small></td><td>${mode === 'timeattack' ? fmtTime(r.v) : fmt(r.v)}</td></tr>`).join('')}</table>`;
  }
  // ---------------------------------------------------------------- EVENTS (quick play)
  s_events(root) {
    const P = this.P, S = this.sel; const mp = MAPS[S.map];
    root.innerHTML = `<div class="screen wide"><div class="panel col-main"><h2 class="t">Events<small>quick play · any mode, any map</small></h2>
      <div class="lbl">Mode</div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">${[['free', 'Free Roam', 'Cruise, explore, discover spots and chase combos.'], ['challenge', 'Drift Challenge', 'Score a target before time runs out.'], ['timeattack', 'Time Attack', 'Race the gates. Best lap is saved.'], ['tandem', 'Tandem Drift', 'Chase an AI lead car and score on proximity.']].map(([k, n, d]) => `<button class="item ${S.mode === k ? 'on' : ''}" data-mode="${k}" style="min-height:92px"><b style="font-size:18px">${n}</b><small style="text-transform:none;font:500 13px Barlow;letter-spacing:0;color:#aab0bb">${d}</small></button>`).join('')}</div>
      <div class="lbl">Map</div><div class="maps" style="grid-template-columns:repeat(3,1fr)">${MAP_IDS.map(id => { const m = MAPS[id], lock = !P.mapOpen(id); return `<button class="mapcard ${S.map === id ? 'on' : ''} ${lock ? 'lock' : ''}" style="--g:${MAP_GRAD[id]};height:92px" data-map="${id}"><span>${m.short}</span><small>${lock ? 'LEVEL ' + m.level : m.name}</small>${lock ? '<span class="lk">🔒</span>' : ''}</button>`; }).join('')}</div>
      <div class="lbl">Time of day</div><div class="modes">${['auto', ...TODS].map(t => `<button class="chip ${S.tod === t ? 'on' : ''}" data-tod="${t}">${t === 'auto' ? 'Default (' + mp.tod + ')' : t}</button>`).join('')}</div>
      ${S.mode === 'challenge' || S.mode === 'tandem' ? `<div class="lbl">Difficulty</div><div class="modes">${Object.entries(DIFFS).map(([k, v]) => `<button class="chip ${S.diff === k ? 'on' : ''}" data-diff="${k}">${v[0]}</button>`).join('')}</div>` : ''}
      ${S.mode === 'timeattack' ? `<div class="lbl">Laps</div><div class="modes">${[1, 2, 3, 5].map(n => `<button class="chip ${S.laps === n ? 'on' : ''}" data-laps="${n}">${n}</button>`).join('')}</div>` : ''}
      <div style="margin-top:20px"><button class="btn pri big" data-a="startquick" ${P.mapOpen(S.map) ? '' : 'disabled'}>${P.mapOpen(S.map) ? 'Start' : 'Locked'}</button></div></div>
      <div class="panel col-side detail"><div class="tag or">${MODE_NAMES[S.mode]}</div><h1 style="margin-top:8px">${mp.name}</h1><p>${esc(mp.desc)}</p>
        <div class="kv"><div><small>Personal best</small><b>${S.mode === 'timeattack' ? fmtTime(P.save.records.lap[S.map]) : fmt(P.save.records.score[S.map + ':' + S.mode] || 0)}</b></div><div><small>Discoveries</small><b>${(P.save.discovered[S.map] || []).length}/${mp.discover}</b></div></div>
        <h2 class="t" style="margin-top:14px">Leaderboard</h2>${S.mode === 'free' ? '<div style="color:var(--mt);font-size:14px">Free roam is unranked — try Drift Challenge, Time Attack or Tandem.</div>' : this.lbTable(S.map, S.mode)}</div></div>`;
  }
  quickEvent() {
    const S = this.sel, mp = MAPS[S.map]; const d = DIFFS[S.diff]; const lvl = this.P.save.level; if (S.mode === 'free') return null;
    if (S.mode === 'timeattack') return { id: null, n: 0, tier: 2, map: S.map, mode: 'timeattack', laps: S.laps, pace: 0.85 + lvl * 0.004 };
    const base = (4500 + mp.level * 1600) * d[1]; const target = Math.round(base / 250) * 250; return { id: null, n: 0, tier: 1 + Math.min(5, Math.floor(lvl / 5)), map: S.map, mode: S.mode, target, time: S.mode === 'tandem' ? 120 : 100, stars: [target, Math.round(target * 1.7), Math.round(target * 2.6)] };
  }
  // ---------------------------------------------------------------- SHOP
  s_shop(root) {
    const P = this.P, s = P.save; const order = [...CARS].sort((a, b) => a.price - b.price);
    root.innerHTML = `<div class="screen wide"><div class="panel col-main"><h2 class="t">Showroom<small>${Object.keys(s.owned).length}/${CARS.length} owned</small></h2><div class="shopgrid">${order.map(c => { const own = P.ownsCar(c.id), lock = s.level < c.level, can = P.canBuyCar(c); return `<div class="cc"><div class="sil" style="--c:${c.color}"></div><div class="mk">${esc(c.make)} · ${c.year}</div><h4>${esc(c.name)}</h4><div class="row2"><span class="tag or">${CLASSES[c.cls]}</span><span class="tag">${c.drive}</span><span class="tag">${c.hp} hp</span><span class="tag">${c.weight} kg</span></div><div style="color:var(--mt);font-size:13px;min-height:34px">${esc(c.desc)}</div><div class="row2"><b style="font:800 22px 'Barlow Condensed';color:${own ? 'var(--ok)' : lock ? 'var(--bad)' : '#9dff9d'}">${own ? 'OWNED' : lock ? '🔒 LEVEL ' + c.level : money(c.price)}</b>${own ? `<button class="btn sm" data-drive-car="${c.id}">Use</button>` : `<button class="btn sm ${can.ok ? 'pri' : 'off'}" data-buycar="${c.id}">Buy</button>`}</div></div>`; }).join('')}</div></div>
      <div class="panel col-side"><h2 class="t">Your wallet</h2><div class="kv"><div><small>Cash</small><b style="color:#9dff9d">${money(s.cash)}</b></div><div><small>Drift points</small><b style="color:var(--ac2)">${fmt(s.dp)}</b></div></div>
        <p style="color:#aeb3bd;font-size:14px;line-height:1.5">Earn cash and Drift Points by banking drift combos, winning career events and completing daily challenges. Cosmetic parts are bought once and fit every car. Performance upgrades are installed per car in the Garage.</p>
        <h2 class="t" style="margin-top:18px">Garage</h2><div class="carlist">${Object.keys(s.owned).map(id => { const c = carById[id]; return `<button class="crow ${s.selected === id ? 'on' : ''}" data-drive-car="${id}"><b>${esc(c.name)}</b><small>${esc(c.make)} · ${c.hp} hp</small><span class="r">${s.selected === id ? 'SELECTED' : 'Select'}</span></button>`; }).join('')}</div></div></div>`;
  }
  // ---------------------------------------------------------------- PROFILE
  s_profile(root) {
    const P = this.P, s = P.save, st = s.stats; const got = Object.keys(s.achievements).length;
    const cell = (k, v) => `<div><small>${k}</small><b>${v}</b></div>`;
    root.innerHTML = `<div class="screen wide"><div class="panel col-main"><div style="display:flex;align-items:center;gap:16px;margin-bottom:14px"><div class="lvl" style="width:72px;height:72px;font-size:32px;--p:${Math.round(s.xp / xpForLevel(s.level) * 100)}"><b>${s.level}</b></div><div style="flex:1"><input type="text" id="nameIn" maxlength="14" value="${esc(s.name)}" style="font-size:24px;max-width:260px"><div class="pc-sub" style="margin-top:6px">${fmt(s.xp)} / ${fmt(xpForLevel(s.level))} XP to level ${s.level + 1}</div></div></div>
      <h2 class="t">Lifetime stats</h2><div class="stat-grid">${cell('Total score', fmt(st.totalScore))}${cell('Best combo', fmt(st.bestCombo))}${cell('Best angle', Math.round(st.bestAngle) + '°')}${cell('Longest drift', st.longest.toFixed(1) + 's')}${cell('Top speed', Math.round(st.topSpeed) + ' km/h')}${cell('Distance', st.km.toFixed(1) + ' km')}${cell('Near misses', fmt(st.nearMiss))}${cell('Best multiplier', 'x' + st.bestMult.toFixed(1))}${cell('Events won', st.eventsWon + '/' + EVENTS.length)}${cell('Drifts banked', fmt(st.drifts))}${cell('Tandem points', fmt(st.tandemPts))}${cell('Crashes', fmt(st.crashes))}${cell('Play time', Math.round(st.playTime / 60) + ' min')}${cell('Locations found', st.discovered)}</div>
      <h2 class="t" style="margin-top:20px">Achievements<small>${got}/${ACHIEVEMENTS.length}</small></h2><div class="ach">${ACHIEVEMENTS.map(a => `<div class="${s.achievements[a.id] ? 'got' : ''}"><b>${s.achievements[a.id] ? '🏆 ' : '🔒 '}${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`).join('')}</div></div>
      <div class="panel col-side"><h2 class="t">Personal records</h2><div class="kv">${MAP_IDS.map(id => `<div><small>${MAPS[id].short} · best lap</small><b>${fmtTime(s.records.lap[id])}</b></div>`).join('')}</div>
        <h2 class="t" style="margin-top:16px">Best scores</h2><div class="kv">${MAP_IDS.map(id => `<div><small>${MAPS[id].short} · challenge</small><b>${fmt(s.records.score[id + ':challenge'] || 0)}</b></div>`).join('')}</div>
        <h2 class="t" style="margin-top:16px">Leaderboard<small>${MAPS[this.sel.map].short} · challenge</small></h2>${this.lbTable(this.sel.map, 'challenge')}</div></div>`;
    const n = $('#nameIn'); n.onchange = () => { s.name = (n.value.trim() || 'DRIVER').toUpperCase().slice(0, 14); P.touch(); this.refreshPills(); };
  }
  // ---------------------------------------------------------------- clicks
  click(e) {
    const t = e.target.closest('[data-nav],[data-a],[data-map],[data-tod],[data-mode],[data-diff],[data-laps],[data-ev],[data-claim],[data-buycar],[data-drive-car],#pcard'); if (!t) return; const d = t.dataset; audio.init(); audio.click();
    if (t.id === 'pcard') { this.go('profile'); return; }
    if (d.nav) { this.go(d.nav); return; }
    if (d.map) { if (!this.P.mapOpen(d.map)) { audio.error(); this.toast(`Reach level ${MAPS[d.map].level} to unlock ${MAPS[d.map].name}`, 'err'); return; } this.sel.map = d.map; this.P.save.settings.lastMap = d.map; this.go(this.tab); return; }
    if (d.tod) { this.sel.tod = d.tod; this.go(this.tab); return; } if (d.mode) { this.sel.mode = d.mode; this.go('events'); return; } if (d.diff) { this.sel.diff = d.diff; this.go('events'); return; } if (d.laps) { this.sel.laps = +d.laps; this.go('events'); return; }
    if (d.ev) { this.sel.ev = d.ev; this.go('career'); return; }
    if (d.claim !== undefined) { const r = this.P.claimDaily(+d.claim); if (r) { audio.cash(); this.toast(`+${money(r.cash)}  +${r.xp} XP  +${r.dp} DP`, 'ok'); this.afterLevels(r.levelUps); this.go('drive'); } return; }
    if (d.buycar) { const r = this.P.buyCar(d.buycar); if (r.ok) { audio.cash(); this.toast('Car purchased!', 'ok'); this.go('shop'); this.app.garage.setCar(this.P.car, this.P.cfg); } else { audio.error(); this.toast(r.err, 'err'); } return; }
    if (d.driveCar) { this.P.select(d.driveCar); this.go(this.tab); return; }
    if (d.a === 'settings') { this.settings(); return; }
    if (d.a === 'drive') { this.app.startGame({ mapId: this.sel.map, mode: 'free', tod: this.sel.tod === 'auto' ? undefined : this.sel.tod }); return; }
    if (d.a === 'nextcar') { const ids = Object.keys(this.P.save.owned); this.P.select(ids[(ids.indexOf(this.P.save.selected) + 1) % ids.length]); this.go('drive'); return; }
    if (d.a === 'login') { const r = this.P.claimLogin(); if (r) { audio.cash(); audio.levelUp(); this.toast(`Daily reward: ${money(r.cash)} · ${r.dp} DP · ${r.xp} XP`, 'ok'); this.go('drive'); } return; }
    if (d.a === 'startev') { const ev = eventById[this.sel.ev]; this.app.startGame({ mapId: ev.map, mode: ev.mode, event: ev, tod: this.sel.tod === 'auto' ? undefined : this.sel.tod }); return; }
    if (d.a === 'startquick') { this.app.startGame({ mapId: this.sel.map, mode: this.sel.mode, event: this.quickEvent(), tod: this.sel.tod === 'auto' ? undefined : this.sel.tod }); return; }
  }
  // ---------------------------------------------------------------- overlays
  toast(text, kind = '') { const t = el(`<div class="toast ${kind}">${esc(text)}</div>`); $('#toasts').appendChild(t); setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = 0; }, 2400); setTimeout(() => t.remove(), 2900); }
  modal(html, cls = '') { this.layer.innerHTML = `<div class="scrim"><div class="panel modal ${cls}">${html}</div></div>`; return this.layer.firstChild; }
  closeModal() { this.layer.innerHTML = ''; }
  layerClick(e) { const t = e.target.closest('[data-m]'); if (!t) return; audio.click(); const a = t.dataset.m; const f = this._mh && this._mh[a]; if (f) f(t); }
  confirm(text, yes) { this.modal(`<h1 style="font-size:26px">Confirm</h1><p style="color:#c8ccd4;font-size:16px">${esc(text)}</p><div class="btnrow"><button class="btn" data-m="no">Cancel</button><button class="btn pri" data-m="yes">Confirm</button></div>`); this._mh = { no: () => this.closeModal(), yes: () => { this.closeModal(); yes(); } }; }
  afterLevels(lv) { if (lv && lv.length) { audio.levelUp(); const d = el(`<div class="lvlup"><div>LEVEL ${lv[lv.length - 1]}<small>NEW CARS, PARTS & MAPS MAY BE UNLOCKED</small></div></div>`); document.body.appendChild(d); setTimeout(() => d.remove(), 2300); } }
  settings(inGame) {
    const s = this.P.save.settings; const opt = (k, list) => `<select data-set="${k}">${list.map(([v, l]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    this.modal(`<h1>Settings</h1>
      <div class="setrow"><span>Graphics</span>${opt('quality', [['low', 'Low (fast)'], ['medium', 'Medium'], ['high', 'High']])}</div>
      <div class="setrow"><span>Master volume</span><input type="range" min="0" max="1" step="0.05" value="${s.master}" data-set="master"></div>
      <div class="setrow"><span>Music</span>${opt('music', [[true, 'On'], [false, 'Off']])}</div>
      <div class="setrow"><span>Transmission</span>${opt('manual', [[false, 'Automatic'], [true, 'Manual (Q / E)']])}</div>
      <div class="setrow"><span>Units</span>${opt('units', [['kmh', 'km/h'], ['mph', 'mph']])}</div>
      <div class="setrow"><span>Steering</span><input type="range" min="0" max="1" step="0.05" value="${s.sens}" data-set="sens"></div>
      <div class="setrow"><span>Default camera</span>${opt('cam', [[0, 'Chase'], [1, 'Far chase'], [2, 'Hood'], [3, 'Cockpit'], [4, 'Orbit']])}</div>
      <div class="lbl">Controls</div><div class="keys"><span><kbd>W</kbd><kbd>↑</kbd></span>Throttle<span><kbd>S</kbd><kbd>↓</kbd></span>Brake / reverse<span><kbd>A</kbd><kbd>D</kbd></span>Steer<span><kbd>Space</kbd></span>Handbrake<span><kbd>Shift</kbd></span>Clutch kick<span><kbd>C</kbd></span>Camera · <kbd>R</kbd> reset car · <kbd>Esc</kbd> pause<span>Gamepad</span>Left stick · RT/LT · A handbrake · B clutch kick · Y camera</div>
      <div style="margin-top:14px;color:var(--mt);font-size:12px">Version ${esc(buildInfo.version || '1.0.0')}${storage.native ? ' · save file: ' + esc(buildInfo.savePath || 'AppData/Slide/saves') : ' · browser save'}</div>
      <div class="btnrow"><button class="btn pri" data-m="close">Done</button></div>`);
    const root = this.layer; root.oninput = root.onchange = (e) => { const t = e.target; if (!t.dataset.set) return; let v = t.type === 'range' ? parseFloat(t.value) : t.value; if (v === 'true') v = true; if (v === 'false') v = false; if (t.dataset.set === 'cam') v = +v; s[t.dataset.set] = v; this.P.touch(); if (t.dataset.set === 'master') audio.setVolume(v); if (t.dataset.set === 'quality') this.app.stage.setQuality(v), this.app.garage.active && this.app.garage.enter({ quality: v }); if (t.dataset.set === 'music') { v ? audio.startMusic('menu') : audio.stopMusic(); audio.musicOn = v; } };
    this._mh = { close: () => { this.closeModal(); this.layer.oninput = this.layer.onchange = null; if (inGame) this.pauseMenu(); } };
  }
  pauseMenu() {
    this.modal(`<h1>Paused</h1><div style="color:var(--mt);margin-bottom:12px;font:600 14px 'Barlow Condensed';letter-spacing:.14em;text-transform:uppercase">${esc(this.app.game.map.name)} · ${esc(MODE_NAMES[this.app.game.mode])}</div><div class="btnrow" style="flex-direction:column"><button class="btn pri" data-m="resume">Resume</button><button class="btn" data-m="restart">Restart</button><button class="btn" data-m="cam">Change camera</button><button class="btn" data-m="settings">Settings</button><button class="btn" data-m="quit">${this.app.game.mode === 'free' ? 'Exit to menu (bank points)' : 'Quit event'}</button></div>`);
    this._mh = { resume: () => this.app.resume(), restart: () => { this.closeModal(); this.app.restart(); }, cam: () => { this.app.game.cycleCam(); }, settings: () => this.settings(true), quit: () => { this.closeModal(); this.app.quitToMenu(true); } };
  }
  results(res) {
    const o = res.out, mode = res.mode; const ev = res.eventId ? eventById[res.eventId] : null; const won = res.stars > 0 || mode === 'free';
    const title = mode === 'free' ? 'Session complete' : res.stars > 0 ? 'Event complete' : 'Event failed';
    const stat = mode === 'timeattack' ? `<div class="big">${fmtTime(res.bestLap)}</div><div style="color:var(--mt)">Best lap · par ${fmtTime(res.par)}</div>` : `<div class="big">${fmt(res.score)}</div><div style="color:var(--mt)">Total drift points${res.target ? ' · target ' + fmt(res.target) : ''}</div>`;
    this.modal(`<div class="res" style="text-align:center"><h1>${title}</h1>${ev ? `<div style="color:var(--mt);font:600 14px 'Barlow Condensed';letter-spacing:.16em;text-transform:uppercase">${esc(ev.name)}</div>` : ''}${mode !== 'free' ? `<div class="stars">${'★'.repeat(res.stars)}<span class="dim">${'★'.repeat(3 - res.stars)}</span></div>` : ''}${stat}
      <div class="rgrid"><div class="g"><small>Cash</small><b>+${money(o.cash)}</b></div><div><small>XP</small><b>+${fmt(o.xp)}</b></div><div><small>Drift points</small><b>+${fmt(o.dp)}</b></div><div><small>Best combo</small><b>${fmt(res.stats.bestCombo)}</b></div><div><small>Best angle</small><b>${Math.round(res.stats.bestAngle)}°</b></div><div><small>Near misses</small><b>${res.stats.nearMiss}</b></div></div>
      ${o.event ? `<div class="recs"><span>${o.firstWin ? 'First clear bonus' : 'Event reward'}: ${money(o.event.cash)} · ${o.event.xp} XP · ${o.event.dp} DP</span></div>` : ''}
      ${o.records.length || o.achievements.length || o.daily.length || o.levelUps.length ? `<div class="recs">${o.levelUps.map(l => `<span>Level up! You reached level ${l}</span>`).join('')}${o.records.map(r => `<span>🏁 ${esc(r)}</span>`).join('')}${o.achievements.map(a => `<span>🏆 ${esc(a.name)}</span>`).join('')}${o.daily.map(d => `<span>✔ Daily done: ${esc(d.text)}</span>`).join('')}</div>` : ''}
      <div class="btnrow"><button class="btn pri" data-m="again">${mode === 'free' ? 'Keep driving' : 'Retry'}</button>${ev && res.stars > 0 && eventById['e' + (ev.n + 1)] ? '<button class="btn" data-m="next">Next event</button>' : ''}<button class="btn" data-m="menu">Menu</button></div></div>`, '');
    if (o.levelUps.length) this.afterLevels(o.levelUps); audio.stopMusic();
    const nx = ev && eventById['e' + (ev.n + 1)];
    this._mh = { again: () => { this.closeModal(); this.app.restart(); }, menu: () => { this.closeModal(); this.app.quitToMenu(false); }, next: () => { this.closeModal(); this.app.startGame({ mapId: nx.map, mode: nx.mode, event: nx }); } };
  }
}
