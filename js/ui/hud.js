// In-game HUD (DOM) + mini-map (canvas). Reads Game.hud each frame; only touches the DOM when a value changed.
import { $, fmt, fmtTime, clamp } from './dom.js';

export class HUD {
  constructor(root) {
    this.root = root; root.innerHTML = `
      <div class="hud-top">
        <div class="hud-left"><div class="hud-timer" id="hTimer"></div><div class="hud-sub" id="hSub"></div><div class="hud-bar" id="hGoal"><i></i></div><div class="hud-best" id="hBest"></div></div>
        <div class="hud-score"><div class="hud-pts" id="hPts">0</div><div class="hud-mult" id="hMult"><b>x1.0</b><span id="hChain"></span></div><div class="hud-dur" id="hDur"><i></i></div><div class="hud-tan" id="hTan"><span>TANDEM</span><i></i></div></div>
        <div class="hud-right"><div class="hud-total" id="hTotal"></div><div class="hud-cam" id="hCam"></div></div>
      </div>
      <div class="hud-feed" id="hFeed"></div>
      <div class="hud-count" id="hCount"></div>
      <div class="hud-angle" id="hAngle"><div class="aval"><b id="hAng">0</b><small>°</small></div><div class="atrack"><i id="hAngBar"></i><u></u></div></div>
      <div class="hud-dash"><div class="map"><canvas id="hMap" width="220" height="220"></canvas></div><div class="speedo"><div class="rpm" id="hRpm"></div><div class="sline"><b id="hSpd">0</b><small id="hUnit">km/h</small><em id="hGear">N</em></div><div class="boost" id="hBoost"><i></i></div></div></div>
      <div class="hud-hint" id="hHint"><span><kbd>W</kbd><kbd>S</kbd> gas/brake</span><span><kbd>A</kbd><kbd>D</kbd> steer</span><span><kbd>Space</kbd> handbrake</span><span><kbd>Shift</kbd> clutch kick</span><span><kbd>C</kbd> camera</span><span><kbd>R</kbd> reset</span><span><kbd>Esc</kbd> pause</span></div>
      <div class="hud-dbg" id="hDbg"></div>`;
    this.q = {}; for (const id of ['hTimer', 'hSub', 'hGoal', 'hBest', 'hPts', 'hMult', 'hChain', 'hDur', 'hTan', 'hTotal', 'hCam', 'hFeed', 'hCount', 'hAngle', 'hAng', 'hAngBar', 'hMap', 'hRpm', 'hSpd', 'hUnit', 'hGear', 'hBoost', 'hHint', 'hDbg']) this.q[id] = $('#' + id, root);
    const rp = this.q.hRpm; rp.innerHTML = Array.from({ length: 24 }, (_, i) => `<s class="${i > 17 ? 'r' : i > 12 ? 'y' : ''}"></s>`).join(''); this.rpmEls = [...rp.children]; this.last = {}; this.mm = null; this.hintT = 14; this.feed = [];
    this.ctx = this.q.hMap.getContext('2d'); this.zoomWide = false;
  }
  set(k, v, fn) { if (this.last[k] !== v) { this.last[k] = v; fn(v); } }
  text(id, v) { this.set(id, v, x => { this.q[id].textContent = x; }); }
  attachMap(world, mapColor) {
    this.world = world; const p = world.path, b = p.bounds; const pad = 60; let x0 = b.x0 - pad, x1 = b.x1 + pad, z0 = b.z0 - pad, z1 = b.z1 + pad; if (world.bounds) { x0 = Math.min(x0, world.bounds.x0 - 20); x1 = Math.max(x1, world.bounds.x1 + 20); z0 = Math.min(z0, world.bounds.z0 - 20); z1 = Math.max(z1, world.bounds.z1 + 20); }
    const S = Math.min(2, 2048 / Math.max(x1 - x0, z1 - z0)); const cv = document.createElement('canvas'); cv.width = Math.ceil((x1 - x0) * S); cv.height = Math.ceil((z1 - z0) * S); const c = cv.getContext('2d'); c.fillStyle = 'rgba(8,9,12,0.0)'; c.fillRect(0, 0, cv.width, cv.height);
    const T = (x, z) => [(x - x0) * S, (z - z0) * S];
    if (world.bounds) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; const a = T(world.bounds.x0, world.bounds.z0), d = T(world.bounds.x1, world.bounds.z1); c.strokeRect(a[0], a[1], d[0] - a[0], d[1] - a[1]); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(a[0], a[1], d[0] - a[0], d[1] - a[1]); }
    c.lineJoin = c.lineCap = 'round'; c.beginPath(); p.pts.forEach((q, i) => { const [x, y] = T(q.x, q.z); i ? c.lineTo(x, y) : c.moveTo(x, y); }); if (p.closed) c.closePath();
    c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineWidth = (world.halfW * 2 + 5) * S; c.stroke(); c.strokeStyle = 'rgba(210,214,224,0.9)'; c.lineWidth = (world.halfW * 2) * S; c.stroke(); c.strokeStyle = 'rgba(40,43,52,0.95)'; c.lineWidth = (world.halfW * 2 - 2.5) * S; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.beginPath(); world.segs.forEach((s, i) => { if (i % 3) return; const a = T(s[0], s[1]), d = T(s[2], s[3]); c.moveTo(a[0], a[1]); c.lineTo(d[0], d[1]); }); c.globalAlpha = 0.3; c.stroke(); c.globalAlpha = 1;
    this.mm = { cv, x0, z0, S }; this.markers = world.zones.map(z => ({ x: z.x, z: z.z })); this.hintT = 14; this.q.hHint.style.opacity = 1;
  }
  toast(t) {
    const d = document.createElement('div'); d.className = 'ft ' + t.kind; d.innerHTML = `<b>${t.text}</b>${t.pts ? `<i>${t.pts > 0 ? '+' : ''}${fmt(t.pts)}</i>` : ''}`; this.q.hFeed.appendChild(d); while (this.q.hFeed.children.length > 5) this.q.hFeed.firstChild.remove(); setTimeout(() => d.classList.add('out'), t.kind === 'bank' ? 2200 : 1700); setTimeout(() => d.remove(), t.kind === 'bank' ? 2700 : 2200);
  }
  update(g, dt, units) {
    const h = g.hud; if (!h || !h.phase) return; const mph = units === 'mph'; this.hintT -= dt; if (this.hintT < 0 && this.q.hHint.style.opacity !== '0') this.q.hHint.style.opacity = 0;
    for (const t of g.toasts.splice(0)) this.toast(t);
    const live = h.live; this.set('live', live, v => this.q.hPts.parentElement.classList.toggle('live', v)); this.set('act', h.active, v => this.q.hPts.parentElement.classList.toggle('active', v));
    this.text('hPts', live ? fmt(h.pts) : (h.total ? fmt(h.total) : '0')); this.set('ptsmode', live, v => { this.q.hPts.classList.toggle('dim', !v); });
    const mult = Math.round(h.mult * 10) / 10; this.set('mult', mult, v => { this.q.hMult.firstChild.textContent = 'x' + v.toFixed(1); this.q.hMult.classList.toggle('hot', v >= 4); this.q.hMult.classList.toggle('mad', v >= 7); }); this.q.hMult.style.opacity = live ? 1 : 0.0;
    this.text('hChain', h.chain > 1 && live ? `CHAIN ${h.chain}` : ''); const durBar = this.q.hDur.firstChild; durBar.style.transform = `scaleX(${live ? clamp(h.active ? (h.dur % 4) / 4 : h.grace / 1.5, 0, 1) : 0})`; this.q.hDur.classList.toggle('grace', !h.active && live);
    this.set('tan', h.tandem > 0.02, v => { this.q.hTan.style.display = v ? 'flex' : 'none'; }); if (h.tandem > 0.02) this.q.hTan.lastChild.style.transform = `scaleX(${h.tandem})`;
    this.text('hTotal', live ? `BANKED  ${fmt(h.total)}` : (h.total ? 'BANKED' : '')); this.text('hCam', h.camName ? h.camName.toUpperCase() + ' CAM' : '');
    // left block by mode
    const m = h.mode; let timer = '', sub = '', goal = -1, best = `BEST COMBO ${fmt(h.best)}`;
    if (m === 'challenge' || m === 'tandem') { timer = fmtTime(h.timeLeft).replace(/^0:/, ''); sub = `TARGET ${fmt(h.target)}  ·  SCORE ${fmt(h.total)}`; goal = clamp(h.total / h.target, 0, 1); this.q.hTimer.classList.toggle('warn', h.timeLeft < 10); if (m === 'tandem') sub += `  ·  GAP ${Math.round(h.leadDist)}m`; }
    else if (m === 'timeattack') { timer = fmtTime(h.lapT); sub = `LAP ${h.lap}/${h.laps}  ·  BEST ${fmtTime(h.bestLap)}  ·  PAR ${fmtTime(h.par)}`; }
    else { timer = fmtTime(h.time); sub = 'FREE ROAM'; }
    this.text('hTimer', timer); this.text('hSub', sub); this.text('hBest', best); this.set('goal', goal >= 0, v => { this.q.hGoal.style.display = v ? 'block' : 'none'; }); if (goal >= 0) this.q.hGoal.firstChild.style.transform = `scaleX(${goal})`;
    // angle
    const ang = Math.round(h.angle); this.text('hAng', ang); this.q.hAngBar.style.transform = `scaleX(${clamp(h.angle / 90, 0, 1)})`; this.set('angc', h.angle >= 17, v => this.q.hAngle.classList.toggle('on', v));
    // speed
    const spd = Math.round(h.speed * (mph ? 0.621 : 1)); this.text('hSpd', spd); this.text('hUnit', mph ? 'mph' : 'km/h'); this.text('hGear', h.gear);
    const lit = Math.round(h.rpm01 * 24); this.set('rpm', lit, v => this.rpmEls.forEach((e, i) => e.classList.toggle('on', i < v))); this.q.hRpm.classList.toggle('flash', h.rpm01 > 0.97);
    if (h.boost >= 0) { this.q.hBoost.style.display = 'block'; this.q.hBoost.firstChild.style.transform = `scaleX(${clamp(h.boost, 0, 1)})`; } else this.q.hBoost.style.display = 'none';
    // countdown
    const cd = h.phase === 'countdown' ? Math.ceil(h.cd - 0.4) : -1; this.set('cd', cd, v => { this.q.hCount.textContent = v > 0 ? v : ''; this.q.hCount.classList.remove('pop'); void this.q.hCount.offsetWidth; if (v > 0) this.q.hCount.classList.add('pop'); });
    // debug
    this.q.hDbg.style.display = g.app.debug ? 'block' : 'none'; if (g.app.debug) this.q.hDbg.textContent = `fps ${h.fps.toFixed(0)}  rpm ${h.rpm.toFixed(0)}  beta ${(g.veh.beta * 57.3).toFixed(0)}°  slideR ${g.veh.slideAmt.toFixed(2)}  yawrate ${g.veh.r.toFixed(2)}  grip ${g.veh.surf}  dmg ${h.dmg.toFixed(2)}`;
    this.drawMap(g, h);
  }
  drawMap(g, h) {
    if (!this.mm) return; const c = this.ctx, W = 220, cx = W / 2, cy = W * 0.6, k = this.zoomWide ? 0.3 : 1.0, { cv, x0, z0, S } = this.mm; c.clearRect(0, 0, W, W);
    c.save(); c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, 7); c.clip(); c.fillStyle = 'rgba(10,11,14,0.78)'; c.fillRect(0, 0, W, W);
    const yaw = h.yaw, ca = Math.cos(yaw), sa = Math.sin(yaw), px = h.px, pz = h.pz; const a = -ca * k, b = -sa * k, cc = sa * k, d = -ca * k; const e = cx - (a * px + cc * pz), f = cy - (b * px + d * pz);
    c.setTransform(a / S, b / S, cc / S, d / S, a * x0 + cc * z0 + e, b * x0 + d * z0 + f); c.drawImage(cv, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0);
    const T = (x, z) => [a * x + cc * z + e, b * x + d * z + f];
    c.fillStyle = 'rgba(255,170,0,0.9)'; for (const m of this.markers) { const [x, y] = T(m.x, m.z); c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
    if (g.traffic) { c.fillStyle = '#8fd0ff'; for (const t of g.traffic.cars) { const [x, y] = T(t.x, t.z); c.fillRect(x - 2, y - 2, 4, 4); } }
    if (g.lead) { const [x, y] = T(g.lead.x, g.lead.z); c.fillStyle = '#ff3b6b'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); }
    if (g.mode === 'timeattack' && g.gates) { const gt = g.gates[g.gi % g.gates.length]; const [x, y] = T(gt.x, gt.z); c.strokeStyle = '#ffd24a'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 7, 0, 7); c.stroke(); }
    c.fillStyle = '#ff8a1a'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx, cy - 9); c.lineTo(cx + 6, cy + 7); c.lineTo(cx, cy + 3); c.lineTo(cx - 6, cy + 7); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, 7); c.stroke();
    // north tick
    const nx = W / 2 + Math.sin(-yaw) * 0, ny = 0; c.fillStyle = 'rgba(255,255,255,0.7)'; c.font = '700 12px Barlow Condensed'; const na = yaw; c.fillText('N', W / 2 - Math.sin(na) * 98 - 4, W / 2 + Math.cos(na) * 98 + 4);
  }
}
