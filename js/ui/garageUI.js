// GARAGE screen: live-preview customisation (body, wheels, paint, vinyls, lights, performance, tune) with try-before-you-buy.
import { $, $$, el, fmt, money, esc, clamp } from './dom.js';
import { carById } from '../data/cars.js';
import { PART_CATS, WHEEL_DESIGNS, TIRES, FINISHES, LIVERIES, STICKERS, STICKER_SLOTS, HEADLIGHTS, UNDERGLOW, FLAMES, PLATES, PERF, PERF_KEYS, statBars, defaultCfg } from '../data/parts.js';
import { CATALOG } from '../core/progress.js';
import { audio } from '../audio.js';

const PAINTS = ['#e9ecef', '#101114', '#c8102e', '#ff5a1f', '#ffb000', '#f2e600', '#59c93b', '#00a68f', '#19c8ff', '#1f5fe0', '#2b2f87', '#7b3fe4', '#ff4fa3', '#8a8f98', '#b9a27a', '#6b3a1e', '#0f3d2b', '#3b0a12', '#d7c9a7', '#5c6b73', '#ff8fb1', '#a3ff3c', '#ff2d2d', '#c0c6cf'];
const WHEEL_COLS = ['#1a1a1c', '#e9ecef', '#c9ccd1', '#c9a227', '#b0703b', '#c8102e', '#1f5fe0', '#ff7a1a', '#00a68f', '#7b3fe4', '#ff4fa3', '#444a52'];
const W_FINISH = [['gloss', 'Gloss'], ['satin', 'Satin'], ['matte', 'Matte'], ['chrome', 'Chrome'], ['bronze', 'Bronze']];
const TABS = [['body', 'Body'], ['wheels', 'Wheels'], ['paint', 'Paint'], ['vinyl', 'Vinyls'], ['lights', 'Lights'], ['perf', 'Perf'], ['tune', 'Tune']];
const BODY_CATS = ['fbumper', 'rbumper', 'skirts', 'widebody', 'spoiler', 'hood', 'fenders', 'mirrors'];
const clone = (o) => JSON.parse(JSON.stringify(o));

export class GarageUI {
  constructor(ui) { this.ui = ui; this.app = ui.app; this.P = ui.app.profile; this.tab = 'body'; this.sub = 'fbumper'; this.slot = 'door'; this.cam = 'hero'; }
  get carId() { return this.P.save.selected; }
  open(root) {
    this.root = root; this.car = carById[this.carId]; this.saved = this.P.cfgOf(this.carId); this.draft = clone(this.saved); this.dirty = false;
    this.app.garage.setCar(this.car, this.draft); this.app.garage.go('hero'); this.app.garage.setOffset(0.075);
    root.innerHTML = `<div class="screen garage-l"><div class="panel" style="padding:10px 14px"><div class="crow" style="padding:6px 8px;border:0;background:none;grid-template-columns:auto 1fr auto auto;align-items:center"><button class="btn sm ghost" data-a="prev">‹</button><div style="padding:0 8px"><b id="gName"></b><br><small id="gSub"></small></div><button class="btn sm ghost" data-a="next">›</button><button class="btn sm" data-a="sell" title="Sell this car">Sell</button></div></div>
      <div class="panel" style="flex:1"><div class="tabs">${TABS.map(([k, l]) => `<button class="tab" data-tab="${k}">${l}</button>`).join('')}</div><div class="gbody" id="gBody"></div></div></div>
      <div class="screen garage-r"><div class="panel card"><h2 class="t">Stats</h2><div id="gStats" class="sbars" style="grid-template-columns:1fr"></div><div id="gVal" style="margin-top:12px;font:600 12px 'Barlow Condensed';letter-spacing:.14em;color:var(--mt);text-transform:uppercase"></div></div>
        <div class="panel card"><h2 class="t">Camera</h2><div class="modes" id="gCams">${[['hero', 'Hero'], ['front', 'Front'], ['side', 'Side'], ['rear', 'Rear'], ['wheelF', 'Wheel F'], ['wheelR', 'Wheel R'], ['top', 'Top']].map(([k, l]) => `<button class="chip" data-cam="${k}">${l}</button>`).join('')}</div><div style="margin-top:12px"><button class="btn sm" data-a="rev" style="width:100%">🔊 Rev Engine</button></div></div></div>
      <div class="screen buybar panel" id="gBuy"></div>`;
    root.onclick = (e) => this.click(e); root.oninput = (e) => this.input(e); root.onchange = (e) => this.input(e, true);
    this.header(); this.renderTab(); this.stats(); this.buy();
  }
  close() { this.app.garage.setOffset(0); }
  header() { $('#gName', this.root).textContent = `${this.car.make} ${this.car.name}`; $('#gSub', this.root).textContent = `${this.car.year} · ${this.car.drive} · ${this.car.hp} hp · ${Object.keys(this.P.save.owned).indexOf(this.carId) + 1}/${Object.keys(this.P.save.owned).length} owned`; $$('.tab', this.root).forEach(t => t.classList.toggle('on', t.dataset.tab === this.tab)); $$('#gCams .chip', this.root).forEach(c => c.classList.toggle('on', c.dataset.cam === this.cam)); }
  refresh3D() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = 0; this.app.garage.refreshCar(this.draft); }); }
  // ---------------------------------------------------------------- ownership helpers
  unowned() {
    const d = this.draft, out = []; const chk = (cat, id) => { const it = CATALOG[cat].list.find(i => i.id === id); if (it && !this.P.hasItem(cat, id)) out.push({ cat, id, it }); };
    for (const k of BODY_CATS) chk(k, d.parts[k]); chk('wheel', d.wheels.design); chk('tire', d.wheels.tire); chk('finish', d.paint.finish); chk('livery', d.livery.id); for (const s of d.stickers) chk('sticker', s.id); chk('head', d.look.head); chk('glow', d.look.glow); chk('flames', d.look.flames);
    const seen = new Set(); return out.filter(o => { const k = o.cat + o.id; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  total() { const u = this.unowned(); let cash = 0, dp = 0, lock = null; for (const o of u) { cash += o.it.price; dp += o.it.dp || 0; if (this.P.save.level < (o.it.lvl || 1)) lock = lock || `${o.it.name} needs level ${o.it.lvl}`; } return { u, cash, dp, lock }; }
  buy() {
    const t = this.total(), s = this.P.save; const can = !t.lock && s.cash >= t.cash && s.dp >= t.dp; const changed = JSON.stringify(this.draft) !== JSON.stringify(this.saved);
    $('#gBuy', this.root).innerHTML = `<div class="tot">${t.u.length ? `${t.u.length} new part${t.u.length > 1 ? 's' : ''} <b>${money(t.cash)}${t.dp ? ` + ${t.dp} DP` : ''}</b>${t.lock ? `<span style="color:var(--bad);margin-left:14px">${esc(t.lock)}</span>` : (!can ? '<span style="color:var(--bad);margin-left:14px">Not enough funds</span>' : '')}` : (changed ? 'Unsaved changes' : 'Everything saved')}</div>
      <div style="display:flex;gap:10px"><button class="btn ${changed ? '' : 'off'}" data-a="revert">Revert</button><button class="btn pri ${changed && (t.u.length ? can : true) ? '' : 'off'}" data-a="save">${t.u.length ? 'Buy & Save' : 'Save'}</button></div>`;
  }
  stats() {
    const a = statBars(this.car, this.saved), b = statBars(this.car, this.draft); $('#gStats', this.root).innerHTML = Object.keys(b).map(k => { const d = b[k] - a[k]; return `<div class="sb"><span>${k}</span><div class="bar"><i style="width:${b[k]}%"></i>${d > 0.5 ? `<i class="up" style="position:relative;top:-6px;width:${Math.min(100 - a[k], d)}%;margin-left:${a[k]}%;height:6px"></i>` : ''}</div><em style="color:${d > 0.5 ? '#9dff9d' : d < -0.5 ? '#ff8a8a' : ''}">${Math.round(b[k])}</em></div>`; }).join('');
    $('#gVal', this.root).textContent = `Car value ${money(this.car.price + this.P.sellValue(this.carId) * 0)}  ·  Sells for ${money(this.P.sellValue(this.carId))}`;
  }
  change(refresh = true) { this.dirty = true; if (refresh) this.refresh3D(); this.stats(); this.buy(); }
  // ---------------------------------------------------------------- tabs
  renderTab() {
    const b = $('#gBody', this.root), d = this.draft; this.header(); let h = '';
    if (this.tab === 'body') { h += `<div class="sub">${BODY_CATS.map(k => `<button class="chip ${this.sub === k ? 'on' : ''}" data-sub="${k}">${PART_CATS[k].label}</button>`).join('')}</div>` + this.grid(this.sub, PART_CATS[this.sub].items, d.parts[this.sub], id => `data-set="parts.${this.sub}" data-v="${id}"`); }
    else if (this.tab === 'wheels') {
      h += `<div class="lbl">Design</div>` + this.grid('wheel', WHEEL_DESIGNS, d.wheels.design, id => `data-set="wheels.design" data-v="${id}"`);
      h += `<div class="lbl">Fitment</div>` + this.range('Size', 'wheels.size', 15, 22, 1, d.wheels.size, '"') + this.range('Offset F', 'wheels.offF', -20, 70, 1, d.wheels.offF, 'mm') + this.range('Offset R', 'wheels.offR', -20, 70, 1, d.wheels.offR, 'mm') + this.range('Camber F', 'wheels.camF', -14, 2, 0.5, d.wheels.camF, '°') + this.range('Camber R', 'wheels.camR', -14, 2, 0.5, d.wheels.camR, '°') + this.range('Width F', 'wheels.widthF', 0, 60, 1, d.wheels.widthF || 0, 'mm') + this.range('Width R', 'wheels.widthR', 0, 60, 1, d.wheels.widthR || 0, 'mm');
      h += `<div class="lbl">Colour & finish</div>` + this.swatches('wheels.color', WHEEL_COLS, d.wheels.color) + `<div class="sub">${W_FINISH.map(([k, l]) => `<button class="chip ${d.wheels.finish === k ? 'on' : ''}" data-set="wheels.finish" data-v="${k}">${l}</button>`).join('')}</div><div class="row"><span>Lip colour</span><input type="color" data-color="wheels.lip" value="${d.wheels.lip}"><em></em></div><div class="lbl">Brake calipers</div>` + this.swatches('wheels.brake', ['#c8102e', '#ffb000', '#1f5fe0', '#e9ecef', '#111114', '#59c93b', '#ff4fa3'], d.wheels.brake);
      h += `<div class="lbl">Tyres</div>` + this.grid('tire', TIRES, d.wheels.tire, id => `data-set="wheels.tire" data-v="${id}"`, it => `grip ${it.grip.toFixed(2)} · slide ${it.slide.toFixed(2)}`);
    }
    else if (this.tab === 'paint') {
      h += `<div class="lbl">Body colour</div>` + this.swatches('paint.color', PAINTS, d.paint.color, true) + `<div class="lbl">Finish</div>` + this.grid('finish', FINISHES, d.paint.finish, id => `data-set="paint.finish" data-v="${id}"`);
      h += `<div class="lbl">Two-tone</div><div class="sub"><button class="chip ${d.paint.two ? 'on' : ''}" data-toggle="paint.two">${d.paint.two ? 'On' : 'Off'}</button>${['roof', 'hood', 'spoiler'].map(m => `<button class="chip ${d.paint.twoMode === m ? 'on' : ''}" data-set="paint.twoMode" data-v="${m}">${m === 'roof' ? 'Roof & mirrors' : m === 'hood' ? 'Hood' : 'Wing'}</button>`).join('')}</div>` + (d.paint.two ? this.swatches('paint.color2', PAINTS, d.paint.color2, true) : '');
      h += `<div class="lbl">Licence plate</div><input type="text" maxlength="8" data-text="plate" value="${esc(d.plate)}" placeholder="PLATE"><div class="sub" style="margin-top:8px">${PLATES.map(p => `<button class="chip" data-set="plate" data-v="${p}">${p}</button>`).join('')}</div>`;
      h += `<div class="lbl">Window tint</div>` + this.range('Tint', 'look.tint', 0, 5, 1, d.look.tint, '');
    }
    else if (this.tab === 'vinyl') {
      h += `<div class="lbl">Livery</div>` + this.grid('livery', LIVERIES, d.livery.id, id => `data-set="livery.id" data-v="${id}"`);
      h += `<div class="row"><span>Colour 1</span><input type="color" data-color="livery.c1" value="${d.livery.c1}"><em></em></div><div class="row"><span>Colour 2</span><input type="color" data-color="livery.c2" value="${d.livery.c2}"><em></em></div><div class="row"><span>Colour 3</span><input type="color" data-color="livery.c3" value="${d.livery.c3}"><em></em></div>`;
      const cur = d.stickers.find(s => s.slot === this.slot);
      h += `<div class="lbl">Decals / stickers</div><div class="sub">${STICKER_SLOTS.map(s => `<button class="chip ${this.slot === s ? 'on' : ''}" data-slot="${s}">${s}${d.stickers.find(x => x.slot === s) ? ' ●' : ''}</button>`).join('')}</div>`;
      h += this.grid('sticker', [{ id: '', name: 'None', price: 0, lvl: 1 }, ...STICKERS], cur ? cur.id : '', id => `data-sticker="${id}"`);
      h += `<div class="row"><span>Colour</span><input type="color" data-stcolor value="${cur ? cur.color || '#ffffff' : '#ffffff'}"><em></em></div>`;
    }
    else if (this.tab === 'lights') {
      h += `<div class="lbl">Headlights</div>` + this.grid('head', HEADLIGHTS, d.look.head, id => `data-set="look.head" data-v="${id}"`, null, it => it.id) + `<div class="lbl">Underglow</div>` + this.grid('glow', UNDERGLOW, d.look.glow, id => `data-set="look.glow" data-v="${id}"`, null, it => (it.id === 'off' || it.id === 'rainbow' ? null : it.id)) + `<div class="lbl">Exhaust flames</div>` + this.grid('flames', FLAMES, d.look.flames, id => `data-set="look.flames" data-v="${id}"`);
    }
    else if (this.tab === 'perf') {
      const cfg = this.saved; h += PERF_KEYS.map(k => { const P = PERF[k], cur = cfg.perf[k], max = P.lv.length - 1, nx = P.lv[cur + 1], can = this.P.perfCan(this.carId, k); return `<div class="perf"><b>${P.label}</b><small>${P.desc} · <span style="color:#fff">${P.lv[cur].name}</span></small><div class="pips">${P.lv.slice(1).map((_, i) => `<s class="${i < cur ? 'on' : ''}"></s>`).join('')}</div>${cur >= max ? '<button class="btn sm off">Maxed</button>' : `<button class="btn sm ${can.ok ? 'pri' : ''}" data-perf="${k}" title="${esc(can.err || '')}">${nx.name}<br><span style="font-size:12px;letter-spacing:.08em">${money(nx.price)}${nx.dp ? ' + ' + nx.dp + ' DP' : ''}${can.ok ? '' : ' 🔒'}</span></button>`}</div>`; }).join('');
    }
    else if (this.tab === 'tune') {
      const t = d.tune; h += `<div class="lbl">Handling tune</div><p style="color:var(--mt);font-size:13px;margin:0 0 10px;line-height:1.4">Applied instantly. Grip balance shifts traction front↔rear (rear = more oversteer). Assist adds countersteer help. Brake bias moves braking forward/rear.</p>` + this.range('Grip balance', 'tune.gripBal', -1, 1, 0.05, t.gripBal, '', true) + this.range('Drift assist', 'tune.assist', 0, 1, 0.05, t.assist, '', true) + this.range('Brake bias', 'tune.brakeBias', 0, 1, 0.05, t.brakeBias, '', true) + this.range('Steer response', 'tune.sens', 0, 1, 0.05, t.sens, '', true) + `<button class="btn sm" data-a="tunereset" style="margin-top:8px">Reset tune</button>`;
    }
    b.innerHTML = h;
  }
  grid(cat, list, cur, attr, subFn, swFn) {
    return `<div class="grid">${list.map(it => { const owned = !it.price || this.P.hasItem(cat, it.id), lk = this.P.save.level < (it.lvl || 1); const sw = swFn ? swFn(it) : null; const price = owned ? '<span class="own">Owned</span>' : `<span class="pr">${money(it.price)}${it.dp ? ' +' + it.dp + 'DP' : ''}</span>`; return `<button class="item ${cur === it.id ? 'on' : ''} ${!owned && lk ? 'locked' : ''}" ${attr(it.id)}>${sw && sw.startsWith('#') ? `<span class="sw" style="background:${sw}"></span>` : ''}<b>${esc(it.name)}</b><small>${subFn ? subFn(it) + ' · ' : ''}${!owned && lk ? `🔒 Lv ${it.lvl}` : price}</small></button>`; }).join('')}</div>`;
  }
  swatches(path, cols, cur, custom) { return `<div class="swatches">${cols.map(c => `<button class="swt ${cur && cur.toLowerCase() === c ? 'on' : ''}" style="background:${c}" data-set="${path}" data-v="${c}"></button>`).join('')}${custom ? `<input type="color" data-color="${path}" value="${cur}" title="Custom colour">` : ''}</div>`; }
  range(label, path, min, max, step, val, unit, noPreview) { return `<div class="row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-range="${path}" ${noPreview ? 'data-live' : ''}><em>${typeof val === 'number' ? (Number.isInteger(step) ? val : val.toFixed(2)) : val}${unit}</em></div>`; }
  // ---------------------------------------------------------------- events
  setPath(path, v) { const ks = path.split('.'); let o = this.draft; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; }
  click(e) {
    const t = e.target.closest('[data-tab],[data-sub],[data-set],[data-toggle],[data-slot],[data-sticker],[data-perf],[data-a],[data-cam]'); if (!t) return; audio.click(); const d = t.dataset;
    if (d.tab) { this.tab = d.tab; this.header(); this.renderTab(); const cams = { wheels: 'wheelF', body: 'hero', paint: 'hero', vinyl: 'side', lights: 'front', perf: 'hero', tune: 'hero' }; this.setCam(cams[d.tab]); return; }
    if (d.sub) { this.sub = d.sub; this.renderTab(); this.setCam({ fbumper: 'front', rbumper: 'rear', skirts: 'side', widebody: 'hero', spoiler: 'rear', hood: 'front', fenders: 'side', mirrors: 'side' }[d.sub] || 'hero'); return; }
    if (d.cam) { this.setCam(d.cam); return; }
    if (d.set) { let v = d.v; this.setPath(d.set, v); this.afterSet(); return; }
    if (d.toggle) { const ks = d.toggle.split('.'); this.draft[ks[0]][ks[1]] = !this.draft[ks[0]][ks[1]]; this.afterSet(); return; }
    if (d.slot) { this.slot = d.slot; this.renderTab(); return; }
    if (d.sticker !== undefined) { const i = this.draft.stickers.findIndex(s => s.slot === this.slot); if (!d.sticker) { if (i >= 0) this.draft.stickers.splice(i, 1); } else if (i >= 0) this.draft.stickers[i].id = d.sticker; else this.draft.stickers.push({ id: d.sticker, slot: this.slot, color: '#ffffff' }); this.afterSet(); return; }
    if (d.perf) { const r = this.P.buyPerf(this.carId, d.perf); if (r.ok) { audio.cash(); this.draft.perf = clone(this.saved.perf); this.app.garage.refreshCar(this.draft); this.ui.toast('Upgrade installed', 'ok'); this.ui.refreshPills(); } else { audio.error(); this.ui.toast(r.err, 'err'); } this.renderTab(); this.stats(); this.buy(); return; }
    if (d.a) this.action(d.a);
  }
  afterSet() { this.renderTab(); this.change(); }
  setCam(c) { this.cam = c; this.app.garage.go(c); $$('#gCams .chip', this.root).forEach(x => x.classList.toggle('on', x.dataset.cam === c)); }
  input(e, commit) {
    const t = e.target, d = t.dataset;
    if (d.range) { const v = parseFloat(t.value); this.setPath(d.range, v); t.parentElement.querySelector('em').textContent = (Number.isInteger(parseFloat(t.step)) ? v : v.toFixed(2)) + (d.range.includes('cam') ? '°' : d.range.includes('off') || d.range.includes('width') ? 'mm' : d.range === 'wheels.size' ? '"' : ''); if (d.live !== undefined) { this.P.cfgOf(this.carId).tune[d.range.split('.')[1]] = v; this.saved.tune[d.range.split('.')[1]] = v; this.P.touch(); this.stats(); return; } this.change(); }
    else if (d.color) { this.setPath(d.color, t.value); if (commit || e.type === 'change') { this.afterSetSoft(); } else { this.change(); } }
    else if (d.stcolor !== undefined) { const s = this.draft.stickers.find(x => x.slot === this.slot); if (s) { s.color = t.value; this.change(); } }
    else if (d.text) { this.setPath(d.text, t.value.toUpperCase()); this.change(); }
  }
  afterSetSoft() { this.change(); }
  action(a) {
    if (a === 'prev' || a === 'next') { const ids = Object.keys(this.P.save.owned); const i = ids.indexOf(this.carId); this.P.select(ids[(i + (a === 'next' ? 1 : ids.length - 1)) % ids.length]); this.open(this.root); return; }
    if (a === 'revert') { this.draft = clone(this.saved); this.app.garage.refreshCar(this.draft); this.app.garage.cfg = this.draft; this.renderTab(); this.change(false); return; }
    if (a === 'tunereset') { const t = defaultCfg(this.car).tune; Object.assign(this.saved.tune, t); Object.assign(this.draft.tune, t); this.P.touch(); this.renderTab(); this.stats(); return; }
    if (a === 'rev') { this.app.rev(); return; }
    if (a === 'sell') { this.ui.confirm(`Sell ${this.car.name} for ${money(this.P.sellValue(this.carId))}?`, () => { const r = this.P.sellCar(this.carId); if (r.ok) { audio.cash(); this.ui.refreshPills(); this.open(this.root); } else this.ui.toast(r.err, 'err'); }); return; }
    if (a === 'save') {
      const t = this.total(); if (t.lock) { this.ui.toast(t.lock, 'err'); return; } if (this.P.save.cash < t.cash || this.P.save.dp < t.dp) { audio.error(); this.ui.toast('Not enough funds', 'err'); return; }
      for (const o of t.u) this.P.buyItem(o.cat, o.id);
      const dst = this.P.cfgOf(this.carId); const keepPerf = dst.perf; Object.assign(dst, clone(this.draft)); dst.perf = keepPerf; this.saved = dst; this.draft = clone(dst); this.app.garage.cfg = this.draft; this.P.touch(); audio.confirm(); if (t.u.length) audio.cash(); this.ui.toast(t.u.length ? 'Purchased & saved' : 'Build saved', 'ok'); this.ui.refreshPills(); this.renderTab(); this.stats(); this.buy();
    }
  }
}
