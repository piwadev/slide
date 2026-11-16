// Driving session: world + car + physics + effects + camera + scoring + game modes. One instance per run (free roam / challenge / time attack / tandem).
import * as THREE from 'three';
import { carById, CARS } from '../data/cars.js';
import { defaultCfg, computeStats, itemOf, TIRES, PART_CATS } from '../data/parts.js';
import { MAPS } from '../data/maps.js';
import { makeCarModel, ensureCarAssets } from '../render/glbCar.js';
import { buildMap } from '../render/maps.js';
import { lightFor, makeSky, makeEnv } from '../render/sky.js';
import { FX } from '../render/fx.js';
import { QUALITY, sunLight } from '../render/stage.js';
import { Vehicle } from './vehicle.js';
import { DriftScorer } from './drift.js';
import { Collider, resolveCar } from './collision.js';
import { Traffic, LeadCar } from './traffic.js';
import { audio } from '../audio.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const LEADS = { 1: 'ae86', 2: 'jzx100', 3: 's15', 4: 'fd3s', 5: 'r34', 6: 'a80' };
export const CAM_NAMES = ['Chase', 'Far', 'Hood', 'Cockpit', 'Orbit'];
const SMOKE_TINT = { day: [0.92, 0.92, 0.94], dusk: [0.6, 0.42, 0.36], night: [0.17, 0.18, 0.26] };

export class Game {
  constructor(app) { this.app = app; this.stage = app.stage; this.input = app.input; this.profile = app.profile; this.running = false; this.hud = {}; this.toasts = []; }
  async start(o) {
    { const lid = LEADS[(o.event && o.event.tier) || 2] || 's15'; await ensureCarAssets([o.carId, ...(o.mode === 'tandem' ? [lid === o.carId ? 'ae86' : lid] : [])]); }
    this.o = o; this.mapId = o.mapId; this.map = MAPS[o.mapId]; this.tod = o.tod || this.map.tod; this.mode = o.mode || 'free'; this.event = o.event || null; this.stage.setQuality(o.quality || 'high'); const Q = this.stage.q;
    const L = this.L = lightFor(null, this.tod); const scene = this.scene = new THREE.Scene();
    this.sky = makeSky(L); scene.add(this.sky); scene.fog = new THREE.FogExp2(new THREE.Color(L.fog), L.fogD * (this.mapId === 'mountain' ? 0.8 : 1));
    scene.add(new THREE.HemisphereLight(new THREE.Color(L.hemiSky), new THREE.Color(L.hemiGnd), L.hemiInt));
    this.sun = sunLight(L, Q.shadow); scene.add(this.sun, this.sun.target);
    this.world = buildMap(this.mapId, { tod: this.tod, quality: o.quality });
    scene.add(this.world.group);
    scene.environment = this.envTex = makeEnv(this.stage.renderer, L);
    this.fx = new FX(scene, o.quality || 'high'); this.fx.setTint(...(SMOKE_TINT[this.tod] || [1, 1, 1]));
    // player
    const car = this.car = carById[o.carId]; const cfg = this.cfg = o.cfg || defaultCfg(car);
    this.model = makeCarModel(car, cfg, { low: o.quality === 'low' }); this.model.root.rotation.order = 'YXZ'; scene.add(this.model.root);
    this.veh = new Vehicle(car, cfg); this.stats = this.veh.stats; this.manual = !!o.manual; this.veh.manual = this.manual;
    this.addLights();
    const sp = this.world.spawn; this.spawnYaw = Math.atan2(sp.tx, sp.tz); this.veh.reset(sp.x, sp.z, this.spawnYaw); this.veh.x = sp.x; this.veh.z = sp.z;
    this.collider = new Collider(this.world); this.dyn = [];
    // traffic
    this.traffic = null; if (this.world.traffic && this.mode !== 'tandem' && this.mode !== 'timeattack') this.traffic = new Traffic(this.world, scene, Q.traffic);
    // lead car
    this.lead = null; if (this.mode === 'tandem') { const lid = LEADS[(this.event && this.event.tier) || 2] || 's15'; const lc = carById[lid === car.id ? 'ae86' : lid]; const lcfg = defaultCfg(lc); lcfg.livery = { id: ['samurai', 'racing', 'flames', 'sakura', 'oni'][(this.event ? this.event.tier : 1) % 5], c1: '#ffffff', c2: '#e63946', c3: '#111' }; lcfg.paint.color = ['#d94a2b', '#2a6fdb', '#f2c230', '#9b3df0', '#23b878', '#e8e8ec'][(this.event ? this.event.n : 0) % 6]; lcfg.parts.spoiler = 'drift'; lcfg.parts.widebody = 'mild'; lcfg.look.glow = ['#ff1d3d', '#00f0ff', '#a24bff'][(this.event ? this.event.n : 0) % 3]; lcfg.wheels.camR = -4; lcfg.wheels.camF = -3; lcfg.wheels.design = 'te6';
      const lm = makeCarModel(lc, lcfg, { low: true }); lm.root.rotation.order = 'YXZ'; scene.add(lm.root); this.lead = new LeadCar(this.world, lm, this.fx); this.leadCar = lc; }
    // scoring
    this.scorer = new DriftScorer({ onBank: (p, i) => this.onBank(p, i), onLose: l => { audio.fail(); this.shake(0.4); }, onBonus: k => audio.combo() });
    this.runStats = this.scorer.stats; this.time = 0; this.phase = 'countdown'; this.cd = 3.4; this.paused = false; this.finished = false; this.lastCrash = -9; this.cashEarned = 0;
    this.camMode = this.profile.save.settings.cam || 0; this.camYaw = this.spawnYaw; this.camPos = new THREE.Vector3(); this.cam = new THREE.PerspectiveCamera(62, this.stage.aspect || 1.6, 0.1, 2200); this.camInit = false; this.shakeAmp = 0; this.orbit = { th: 0.6, ph: 0.25, d: 7 };
    this.zoneCd = new Map(); this.disc = new Set(this.profile.save.discovered[this.mapId] || []); this.newDisc = 0; this.markers = new THREE.Group(); scene.add(this.markers); this.buildZoneMarkers();
    this.setupMode(); this.prev = { blow: 0, gear: 1, hit: 0 };
    this.wheelPhase = 0; this.heave = 0; this.heaveV = 0; this.smokeAcc = [0, 0, 0, 0]; this.fpsT = 0; this.fps = 60; this.frames = 0; this.slopeCache = { gx: 0, gz: 0, t: 0 };
    audio.init(); audio.setEngine(car.sound.type, { turbo: this.veh.turbo, exhaust: cfg.perf.exhaust }); audio.engineGain(0.5); audio.stopMusic(); if (this.profile.save.settings.music) audio.startMusic('drive');
    this.stage.use(scene, this.cam, { exposure: L.exposure, bloom: L.bloom }); this.running = true; this.updateCamera(1 / 60, true); this.sync();
    window.__slide = Object.assign(window.__slide || {}, { game: this });
  }
  addLights() {
    const m = this.model, L = this.L, c = this.car; const on = L.night > 0.1; this.heads = [];
    for (const sx of [-0.6, 0.6]) { const s = new THREE.SpotLight(new THREE.Color(this.cfg.look.head), on ? 90 : 0, 60, 0.5, 0.75, 1.3); s.position.set(sx, 0.7, c.L / 2 - 0.4); const t = new THREE.Object3D(); t.position.set(sx * 0.7, -0.2, c.L / 2 + 22); m.root.add(s, t); s.target = t; this.heads.push(s); }
    if (this.cfg.look.glow && this.cfg.look.glow !== 'off') { const g = this.cfg.look.glow === 'rainbow' ? '#ff00aa' : this.cfg.look.glow; this.glowLight = new THREE.PointLight(new THREE.Color(g), 18, 7, 1.6); this.glowLight.position.set(0, 0.35, 0); m.root.add(this.glowLight); }
  }
  buildZoneMarkers() {
    if (!this.world.zones.length) return; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const g = x.createRadialGradient(64, 64, 20, 64, 64, 62); g.addColorStop(0, 'rgba(255,170,0,0)'); g.addColorStop(0.7, 'rgba(255,170,0,0.0)'); g.addColorStop(0.82, 'rgba(255,190,40,0.9)'); g.addColorStop(0.9, 'rgba(255,170,0,0.25)'); g.addColorStop(1, 'rgba(255,170,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv); this.zoneMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.9 });
    for (const z of this.world.zones) { const m = new THREE.Mesh(new THREE.PlaneGeometry(z.r * 2, z.r * 2), this.zoneMat); m.rotation.x = -Math.PI / 2; m.position.set(z.x, this.world.heightAt(z.x, z.z) + 0.07, z.z); m.renderOrder = 2; this.markers.add(m); z.mesh = m; }
  }
  // ---------------------------------------------------------------- modes
  setupMode() {
    const e = this.event, W = this.world, mp = this.map; const m = this.mode;
    this.target = 0; this.timeLimit = 0; this.laps = 0; this.gates = []; this.stars = [0, 0, 0];
    if (m === 'challenge' || m === 'tandem') { this.target = e ? e.target : 8000; this.timeLimit = e ? e.time : 120; this.stars = e ? e.stars : [this.target, this.target * 1.7, this.target * 2.6]; }
    if (m === 'timeattack') {
      this.laps = e ? e.laps : 3; const pace = mp.pace * (e ? e.pace : 0.9); const len = W.path.length; this.par = (W.pointToPoint ? 1 : this.laps) * len / pace; this.parLap = len / pace; this.stars = [this.parLap * 1.3, this.parLap * 1.12, this.parLap]; this.lap = 1; this.lapT = 0; this.lapTimes = []; this.bestLapRun = 0; this.gi = 1;
      const n = clamp(Math.round(len / 130), 6, 14); const end = W.pointToPoint ? len - 14 : len; for (let i = 0; i < n; i++) { const s = W.pointToPoint ? 6 + (end - 6) * (i + 1) / n : (i * len / n); const q = W.path.at(s); this.gates.push({ s, x: q.x, z: q.z, y: q.y, tx: q.tx, tz: q.tz }); }
      if (W.pointToPoint) this.gates.unshift({ s: 0, ...W.path.at(0) }); // index 0 = start
      this.gateR = Math.max(W.halfW + 5, 12); this.buildBeacon();
    }
    if (m === 'free') { this.timeLimit = 0; }
    this.leadDist = 99;
  }
  buildBeacon() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(this.gateR * 0.95, this.gateR * 0.95, 70, 28, 1, true), mat); this.beacon.renderOrder = 4; this.markers.add(this.beacon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(this.gateR * 0.95, 0.22, 8, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd060, toneMapped: false })); this.beacon.add(ring); ring.position.y = -34.7;
    this.placeBeacon();
  }
  placeBeacon() { const g = this.gates[this.gi % this.gates.length]; if (!g || !this.beacon) return; this.beacon.position.set(g.x, g.y + 35, g.z); }
  toast(text, kind = 'info', pts = 0) { this.toasts.push({ text, kind, pts, t: performance.now() }); }
  onBank(p, info) { audio.bank(); const cash = Math.round(p * 0.2); this.cashEarned += cash; this.toast(`+${p.toLocaleString()}`, 'bank', p); this.lastBank = { p, t: this.time, info }; }
  shake(a) { this.shakeAmp = Math.max(this.shakeAmp, a); }
  // ---------------------------------------------------------------- per frame
  update(dtReal) {
    if (!this.running) return; const dt = Math.min(dtReal, 1 / 20);
    this.frames++; this.fpsT += dtReal; if (this.fpsT >= 0.5) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    const acts = this.input.actions();
    for (const a of acts) { if (a === 'pause') this.app.pause && this.app.pause(); else if (a === 'cam') this.cycleCam(); else if (a === 'reset' && this.phase === 'run') this.respawn(); else if (a === 'up') this.manualShift = 1; else if (a === 'down') this.manualShift = -1; else if (a === 'map') this.hud.bigmap = !this.hud.bigmap; }
    if (this.paused) { audio.engineGain(0); this.render(dt); return; }
    audio.engineGain(0.5);
    // countdown
    if (this.phase === 'countdown') { const before = Math.ceil(this.cd); this.cd -= dt; if (Math.ceil(this.cd) !== before && this.cd > 0) audio.tone(520, 0.12, 'square', 0.12); if (this.cd <= 0) { this.phase = 'run'; audio.tone(1040, 0.35, 'square', 0.15); this.toast('GO!', 'go'); } }
    let ctl = this.input.read(dt, this.profile.save.settings.sens);
    if (this.phase !== 'run' || this.finished) ctl = { steer: 0, throttle: 0, brake: this.phase === 'finished' ? 0.5 : 1, hb: this.phase === 'countdown' ? 0 : 0, kick: false };
    if (this.phase === 'countdown') { ctl.throttle = 0; ctl.brake = 0; }
    ctl.shiftUp = this.manualShift === 1; ctl.shiftDown = this.manualShift === -1; this.manualShift = 0;
    const steps = Math.max(1, Math.ceil(dt / (1 / 100))); const h = dt / steps;
    for (let i = 0; i < steps; i++) this.physics(h, ctl);
    this.time += this.phase === 'run' ? dt : 0;
    this.afterPhysics(dt, ctl);
    this.modeLogic(dt);
    this.visuals(dt, ctl);
    this.updateCamera(dt);
    this.render(dt);
  }
  physics(dt, ctl) {
    const v = this.veh, W = this.world; const env = W.surface(v.x, v.z); v.offroad = env.off ? 1 : 0;
    if (W.sloped !== false) { const sl = this.slopeCache; if (this.frames !== sl.f) { sl.f = this.frames; const k = 1.5; sl.gx = (W.heightAt(v.x + k, v.z) - W.heightAt(v.x - k, v.z)) / (2 * k); sl.gz = (W.heightAt(v.x, v.z + k) - W.heightAt(v.x, v.z - k)) / (2 * k); } v.vx -= clamp(sl.gx, -0.25, 0.25) * 9.81 * 0.8 * dt; v.vz -= clamp(sl.gz, -0.25, 0.25) * 9.81 * 0.8 * dt; }
    v.step(dt, ctl, env);
    // collisions
    if (this.phase !== 'countdown') {
      this.dyn = this.traffic ? this.traffic.circles() : []; const hit = resolveCar(v, this.car, this.collider, this.dyn);
      if (hit && hit.speed > 0.8) this.onHit(hit);
    }
  }
  onHit(h) {
    if (this.time - this.lastCrash < 0.15) return; const sp = h.speed;
    if (sp > 2.2) { this.lastCrash = this.time; this.crashed = 0.5; audio.crash(sp / 12); this.shake(clamp(sp / 18, 0.15, 1)); this.input.rumble(sp / 14, 200); this.veh.damage = clamp((this.veh.damage || 0) + sp / 120, 0, 1);
      for (let i = 0; i < Math.min(14, sp * 1.5); i++) this.fx.spark(h.x, 0.5, h.z, (h.nx + (Math.random() - 0.5)) * 4, 1.5, (h.nz + (Math.random() - 0.5)) * 4);
      // dent
      const sy = Math.sin(this.veh.yaw), cy = Math.cos(this.veh.yaw); const dx = h.x - this.veh.x, dz = h.z - this.veh.z; this.model.deform(new THREE.Vector3(dx * cy - dz * sy, 0.5, dx * sy + dz * cy), clamp(sp / 60, 0, 0.12));
      if (sp > 4.5 || !h.wall) { this.scorer.crash(); } if (h.ref) { h.ref.hit = 3; }
      this.profile.stat('crashes', 1); } else if (sp > 1.0) { audio.tone(160, 0.1, 'sawtooth', 0.05); if (this.scorer.live && h.wall) this.scorer.pts *= 0.97; }
  }
  afterPhysics(dt, ctl) {
    const v = this.veh, sc = this.scorer, W = this.world;
    this.crashed = Math.max(0, (this.crashed || 0) - dt);
    // scoring inputs
    const angle = Math.abs(v.beta) * 180 / Math.PI, speedK = v.speed * 3.6; let tandem = 0;
    if (this.lead) { const d = Math.hypot(this.lead.x - v.x, this.lead.z - v.z); this.leadDist = d; tandem = d < 20 ? clamp(1 - (d - 4) / 16, 0, 1) * (Math.abs(this.lead.slip) > 0.2 ? 1 : 0.4) : 0; }
    if (this.phase === 'run' && !this.finished) {
      // spin detection
      if (sc.live && v.u < 1.0 && v.speed > 6) { sc.crash(); this.toast('SPIN OUT', 'fail'); this.shake(0.3); }
      sc.update(dt, { speed: speedK, angle: v.u > 2 ? angle : 0, sign: Math.sign(v.beta), offroad: v.offroad, tandem, crashed: this.crashed > 0.01 });
      this.runStats.topSpeed = Math.max(this.runStats.topSpeed || 0, speedK);
      // near misses
      if (this.traffic) for (const c of this.traffic.cars) { const d = Math.hypot(c.x - v.x, c.z - v.z); if (d < 5) { c.minD = Math.min(c.minD || 99, d); c.nearT = 1; } else if (c.nearT) { c.nearT = 0; const gap = c.minD - 1.85; c.minD = 99; if (gap > 0.15 && gap < 1.6 && speedK > 55 && this.time - (c.counted || -9) > 3) { c.counted = this.time; sc.nearMiss(gap); } } }
      // zones
      if (sc.active) for (const z of W.zones) { if (Math.hypot(z.x - v.x, z.z - v.z) < z.r && (this.zoneCd.get(z) || -99) < this.time - 8) { this.zoneCd.set(z, this.time); sc.zone(); } }
      // discoveries
      for (const d of W.discoveries) if (!this.disc.has(d.id) && Math.hypot(d.x - v.x, d.z - v.z) < d.r) { this.disc.add(d.id); this.newDisc++; this.profile.discover(this.mapId, d); this.toast(`DISCOVERED  ${d.name}  +${d.xp} XP`, 'discover'); audio.confirm(); }
    }
    for (const q of sc.queue.splice(0)) this.toast(q.text, q.kind, q.pts);
    this.scorer.stats.km = this.scorer.stats.km;
    // out of bounds recovery
    if (!W.open) { const n = W.path.nearest(v.x, v.z, 6); if (!n || n.dist > (W.wideOffroad ? 260 : 150)) { if (this.phase === 'run') { this.toast('BACK ON TRACK', 'info'); this.respawn(); } } }
    // point-to-point wrap (free roam / challenge)
    if (W.pointToPoint && this.mode !== 'timeattack') { const n = W.path.nearest(v.x, v.z, 4); if (n && n.s > W.path.length - 18) { sc.crash(); this.respawn(true); this.toast('BACK TO THE TOP', 'info'); } }
  }
  respawn(toStart = false) {
    const v = this.veh, W = this.world; let q;
    if (toStart) { const s = W.spawn; v.reset(s.x, s.z, this.spawnYaw); this.fx.clearSkids(); } else { const n = W.path.nearest(v.x, v.z, 6); const s = n ? n.s : 0; q = W.path.at(clamp(s, 4, W.path.length - 6)); const keep = 0; v.reset(q.x, q.z, Math.atan2(q.tx, q.tz)); }
    this.scorer.crash(); this.camInit = false; this.model.resetDamage(); v.damage = 0; audio.tone(300, 0.15, 'triangle', 0.1);
  }
  modeLogic(dt) {
    if (this.phase !== 'run' || this.finished) return; const v = this.veh, W = this.world, m = this.mode;
    if (m === 'challenge' || m === 'tandem') { const left = this.timeLimit - this.time; if (left < 10 && Math.ceil(left) !== this.lastTick) { this.lastTick = Math.ceil(left); if (left > 0) audio.tick(); } if (left <= 0) this.finish(); }
    if (m === 'tandem' && this.lead) { const sc = this.scorer; const n = W.path.nearest(v.x, v.z, 4); const ln = this.lead; if (this.time > 0) { this.lead.update(dt, n ? n.s : 0, this.leadDist, this.time > 1.2); } }
    if (m === 'timeattack') {
      this.lapT += dt; const g = this.gates[this.gi % this.gates.length]; const d = Math.hypot(g.x - v.x, g.z - v.z);
      if (d < this.gateR) { audio.tone(900, 0.1, 'triangle', 0.14); const last = this.gi === this.gates.length - 1 && W.pointToPoint || (!W.pointToPoint && this.gi % this.gates.length === 0 && this.gi > 0);
        if (W.pointToPoint) { if (this.gi === this.gates.length - 1) { this.completeLap(); } else this.gi++; }
        else { if (this.gi % this.gates.length === 0) this.completeLap(); else { this.gi++; if (this.gi === this.gates.length) this.gi = 0; } }
        this.placeBeacon(); }
    }
    if (m === 'free' || m === 'challenge') { /* lead absent */ }
  }
  completeLap() {
    const t = this.lapT; this.lapTimes.push(t); const best = !this.bestLapRun || t < this.bestLapRun; if (best) this.bestLapRun = t; this.toast(`LAP ${this.lapTimes.length}  ${fmtTime(t)}${best ? '  BEST' : ''}`, best ? 'perfect' : 'info'); audio.levelUp();
    this.lapT = 0; this.gi = this.world.pointToPoint ? 1 : 1; if (this.lapTimes.length >= this.laps) { this.finish(); return; }
    if (this.world.pointToPoint) { const s = this.world.spawn; this.veh.reset(s.x, s.z, this.spawnYaw); this.fx.clearSkids(); this.camInit = false; }
    this.placeBeacon();
  }
  // ---------------------------------------------------------------- visuals
  visuals(dt, ctl) {
    const v = this.veh, m = this.model, c = this.car, W = this.world, G = m.geom, sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    // ground-following pose
    const hC = W.heightAt(v.x, v.z); const hF = W.heightAt(v.x + sy * c.wb * 0.5, v.z + cy * c.wb * 0.5), hR = W.heightAt(v.x - sy * c.wb * 0.5, v.z - cy * c.wb * 0.5);
    const hL = W.heightAt(v.x + cy * c.track * 0.5, v.z - sy * c.track * 0.5), hRr = W.heightAt(v.x - cy * c.track * 0.5, v.z + sy * c.track * 0.5);
    const pitchT = Math.atan2(hF - hR, c.wb), rollT = Math.atan2(hL - hRr, c.track); this.gp = lerp(this.gp || 0, pitchT, Math.min(1, dt * 12)); this.gr = lerp(this.gr || 0, rollT, Math.min(1, dt * 12));
    // heave spring (bumps from kerbs/offroad + accel)
    const rough = (v.offroad ? 1 : 0) * Math.min(1, v.speed / 12) * 0.012 + (v.hb > 0 ? 0 : 0); const k = 160, dmp = 15; this.heaveV += (-k * this.heave - dmp * this.heaveV + (Math.random() - 0.5) * rough * 900) * dt; this.heave += this.heaveV * dt; this.heave = clamp(this.heave, -0.05, 0.05);
    m.root.position.set(v.x, hC, v.z); m.root.rotation.set(-this.gp, v.yaw, this.gr, 'YXZ');
    // body roll/pitch/heave (wheels stay planted -> visible suspension travel in the arches)
    const stiff = 1 / (v.stats.roll || 1); m.body.rotation.z = -v.roll * 1.9 * stiff; m.body.rotation.x = v.pitch * 1.6; m.body.position.y = m.baseY + this.heave + v.squat * 0 - Math.abs(v.roll) * 0.04;
    // wheels: steer, spin, travel
    m.setWheelSteer(clamp(v.steer * 1, -0.8, 0.8)); const whRot = v.fwdSpeed * dt + (v.hb > 0.5 ? -v.fwdSpeed * dt * 0.8 : 0); m.spinWheels(whRot);
    const lateral = -v.roll, longi = v.pitch; for (let i = 0; i < m.wheels.length; i++) { const w = m.wheels[i]; const sx = w.left ? -1 : 1; const comp = clamp((sx * v.roll * 1.9 * stiff * 0.9 + (w.front ? 1 : -1) * v.pitch * 1.6 * 1.0) * 0.5, -0.06, 0.06); w.pivot.position.y = c.wr + comp * 0 + this.heave * 0.0; w.comp = comp; }
    m.setBrake(ctl.brake > 0.1 || this.phase === 'finished'); m.tick(dt, this.time);
    // body lean visual: wheels stay at ground, but we also offset the wheel pivots vertically against the body tilt so tyres never clip the arch
    // lights
    if (this.L.night > 0.1) { const f = this.heads; for (const s of f) s.intensity = this.cfg.look.head ? 90 : 0; }
    if (this.glowLight) { this.glowLight.position.y = 0.35; if (this.cfg.look.glow === 'rainbow') this.glowLight.color.setHSL((this.time * 0.2) % 1, 1, 0.5); }
    // skid marks + smoke
    const sl = clamp(v.slideAmt, 0, 2), spd = v.speed; const stats = v.stats; const smokeK = stats.smoke || 1;
    const tint = this.world.id === 'desert' ? [0.9, 0.76, 0.52] : (v.offroad && this.world.id !== 'harbor' ? [0.55, 0.5, 0.42] : null);
    const rearInt = clamp((sl - 0.25) * 0.9 + (v.hb > 0.3 && spd > 4 ? 0.7 : 0) + (v.spin > 3 ? Math.min(0.6, v.spin / 25) : 0) + (v.clutch > 0 ? 0.4 : 0), 0, 1.4) * (spd > 3 ? 1 : 0);
    const frontInt = clamp((v.slipFront - 0.5) * 0.7 + (ctl.brake > 0.8 && spd > 12 && !v.rev ? 0.3 : 0), 0, 1) * (spd > 4 ? 1 : 0);
    const vd = Math.hypot(v.vx, v.vz) || 1; const nx = v.vz / vd, nz = -v.vx / vd; const tw = 0.22;
    for (let i = 0; i < 4; i++) { const w = m.wheels[i], front = i < 2; const sx = w.left ? -1 : 1; const wz = front ? G.wzF : G.wzR, lx = sx * (c.track / 2); const wx = v.x + sy * wz + cy * lx, wzp = v.z + cy * wz - sy * lx; const inten = front ? frontInt : rearInt;
      this.fx.skid(i, wx, hC, wzp, tw, v.offroad ? 0 : inten * 0.85, nx, nz);
      if (inten > 0.05) { this.smokeAcc[i] += dt * (front ? 10 + 20 * inten : 16 + 40 * inten) * Math.min(smokeK, 2.4) * this.fx.q; while (this.smokeAcc[i] > 1) { this.smokeAcc[i] -= 1; this.fx.smokePuff(wx, hC, wzp, v.vx, v.vz, 0.8 + inten * 0.7, clamp(inten * 0.4, 0.1, 0.5), tint); } } }
    // flames / pops
    const fl = this.cfg.look.flames; if (fl !== 'none' && (v.backfire > 0.5 || (fl !== 'pops' && v.throttle > 0.9 && v.rpm > v.redline * 0.92))) { if (Math.random() < dt * 22) { const ex = [-0.45, 0.45][Math.random() < 0.5 ? 0 : 1]; const lz = -c.L / 2; this.fx.flame(v.x + sy * lz + cy * ex, hC + 0.35, v.z + cy * lz - sy * ex, -sy, -cy, fl !== 'pops', fl === 'blue'); } }
    if (v.backfire > 0.5 && Math.random() < dt * 9) audio.pop(0.6 + this.cfg.perf.exhaust * 0.1);
    this.fx.update(dt);
    // traffic
    if (this.traffic) this.traffic.update(dt); if (this.world.anim) for (const a of this.world.anim) a(dt, this.time);
    if (this.zoneMat) { this.zoneMat.opacity = 0.55 + 0.4 * Math.sin(this.time * 4); }
    // sun follows car
    this.sun.position.set(v.x + this.L.sunDir[0] * 80, hC + this.L.sunDir[1] * 80, v.z + this.L.sunDir[2] * 80); this.sun.target.position.set(v.x, hC, v.z); this.sun.target.updateMatrixWorld();
    this.sky.position.copy(this.cam.position);
    // audio
    const thrA = v.rev ? v.throttle : v.throttle; audio.updateEngine(v.rpm, v.redline, this.phase === 'run' ? Math.max(thrA, v.clutch > 0 ? 1 : 0) : 0.0, v.boost, v.speed, dt);
    audio.squeal(clamp(Math.max(rearInt, frontInt * 0.7), 0, 1) * (v.offroad ? 0.3 : 1), clamp(spd / 40, 0, 1)); audio.rumble(v.offroad ? Math.min(1, spd / 25) : 0);
    if (v.blowoff > 0.9 && this.prev.blow <= 0.9 && v.turbo) audio.blowoff(); this.prev.blow = v.blowoff;
    if (v.gear !== this.prev.gear) { this.prev.gear = v.gear; this.shake(0.02); }
    // lead car visuals handled in own update
    if (this.lead) {} // positioned in modeLogic
  }
  // ---------------------------------------------------------------- camera
  cycleCam() { this.camMode = (this.camMode + 1) % CAM_NAMES.length; this.profile.save.settings.cam = this.camMode; this.toast(CAM_NAMES[this.camMode].toUpperCase() + ' CAM', 'info'); audio.click(); this.camInit = false; }
  updateCamera(dt, snap = false) {
    const v = this.veh, cam = this.cam, spd = v.speed, mode = this.camMode, kD = snap || !this.camInit ? 1 : 1;
    this.model.root.updateMatrixWorld(true); const hC = this.model.root.position.y;
    const velDir = spd > 5 ? Math.atan2(v.vx, v.vz) : v.yaw; const wantYaw = v.yaw + angDiff(v.yaw, velDir) * (mode === 1 ? 0.5 : 0.62);
    if (!this.camInit || snap) { this.camYaw = v.yaw; this.camInit = true; }
    this.camYaw += angDiff(this.camYaw, wantYaw) * (1 - Math.exp(-dt * (spd > 5 ? 4.2 : 2.5)));
    const look = this.input.look(); let fov = 62 + clamp(spd * 0.35, 0, 18); let pos, tgt; const sh = this.shakeAmp; this.shakeAmp = Math.max(0, this.shakeAmp - dt * 2.2);
    const cs = Math.sin(this.camYaw), cc = Math.cos(this.camYaw), p = new THREE.Vector3(v.x, hC, v.z); const lx = Math.sin(v.yaw), lz = Math.cos(v.yaw);
    if (mode === 0 || mode === 1) { const far = mode === 1; const d = (far ? 9.8 : 6.1) + spd * (far ? 0.04 : 0.028), hgt = (far ? 3.2 : 1.85) + spd * 0.004; pos = new THREE.Vector3(p.x - cs * d, p.y + hgt, p.z - cc * d); tgt = new THREE.Vector3(p.x + cs * 5.5, p.y + 1.0 + (far ? 0.5 : 0), p.z + cc * 5.5); if (look.dx || look.dy) { this.lookOff = (this.lookOff || 0) + look.dx * 0.004; } }
    else if (mode === 2) { const loc = new THREE.Vector3(0, this.model.geom.deckY(this.car.sA) + 0.62 - (this.model.drop || 0), this.model.geom.zOf(this.car.sA) + 0.35); pos = this.model.root.localToWorld(loc); const aim = v.yaw + angDiff(v.yaw, velDir) * 0.35; tgt = new THREE.Vector3(pos.x + Math.sin(aim) * 20, pos.y - 0.25, pos.z + Math.cos(aim) * 20); fov += 4; }
    else if (mode === 3) { const loc = new THREE.Vector3(-this.car.W * 0.2, Math.min(this.car.roofY - 0.2, 1.15) - (this.model.drop || 0), this.model.geom.zOf((this.car.sB + this.car.sA) * 0.55)); pos = this.model.root.localToWorld(loc); const aim = v.yaw + angDiff(v.yaw, velDir) * 0.45; tgt = new THREE.Vector3(pos.x + Math.sin(aim) * 20, pos.y - 0.05, pos.z + Math.cos(aim) * 20); fov += 8; }
    else { const o = this.orbit; o.th += (look.dx * 0.006) + (this.input.mouse.down ? 0 : dt * 0.12); o.ph = clamp(o.ph + look.dy * 0.004, 0.04, 1.3); o.d = clamp(o.d + look.wheel * 0.8, 3.5, 16); pos = new THREE.Vector3(p.x + Math.sin(o.th + v.yaw) * Math.cos(o.ph) * o.d, p.y + 0.6 + Math.sin(o.ph) * o.d, p.z + Math.cos(o.th + v.yaw) * Math.cos(o.ph) * o.d); tgt = new THREE.Vector3(p.x, p.y + 0.8, p.z); fov = 55; }
    if (this.phase === 'countdown') { const k = clamp(this.cd / 3.4, 0, 1); const a = this.camYaw + Math.PI + k * 1.6; const d = 6 + k * 2.5; pos = new THREE.Vector3(p.x + Math.sin(a) * d, p.y + 1.1 + k * 0.9, p.z + Math.cos(a) * d); tgt = new THREE.Vector3(p.x, p.y + 0.6, p.z); fov = 50; }
    if (sh > 0) { pos.x += (Math.random() - 0.5) * sh * 0.35; pos.y += (Math.random() - 0.5) * sh * 0.25; pos.z += (Math.random() - 0.5) * sh * 0.35; }
    if (spd > 38) { const k = (spd - 38) / 40; pos.x += (Math.random() - 0.5) * 0.015 * k; pos.y += (Math.random() - 0.5) * 0.015 * k; }
    // keep above terrain
    const gy = this.world.heightAt(pos.x, pos.z) + 0.4; if (pos.y < gy && mode < 2) pos.y = gy;
    if (snap || mode >= 2) cam.position.copy(pos); else cam.position.lerp(pos, 1 - Math.exp(-dt * 14));
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 3)); cam.updateProjectionMatrix(); cam.lookAt(tgt);
    if (mode === 2 || mode === 3) { cam.rotateZ(-this.model.body.rotation.z * 0.5); }
  }
  render(dt) { if (!this.noRender) this.stage.render(); this.syncHud(); }
  // ---------------------------------------------------------------- HUD data
  sync() { this.syncHud(); }
  syncHud() {
    const v = this.veh, sc = this.scorer, h = this.hud; h.speed = v.speed * 3.6; h.gear = v.rev ? 'R' : (v.speed < 0.5 && v.throttle < 0.05 ? 'N' : v.gear); h.rpm = v.rpm; h.redline = v.redline; h.rpm01 = clamp(v.rpm / v.redline, 0, 1.02); h.boost = v.turbo ? v.boost : -1; h.angle = sc.angle; h.pts = sc.combo; h.mult = sc.mult; h.dur = sc.dur; h.live = sc.live; h.active = sc.active; h.grace = sc.grace; h.chain = sc.chain; h.best = Math.round(sc.stats.bestCombo); h.total = sc.total; h.time = this.time; h.phase = this.phase; h.cd = this.cd; h.mode = this.mode; h.camName = CAM_NAMES[this.camMode]; h.paused = this.paused; h.fps = this.fps;
    h.timeLeft = this.timeLimit ? Math.max(0, this.timeLimit - this.time) : 0; h.target = this.target; h.leadDist = this.leadDist; h.tandem = this.lead ? clamp(1 - (this.leadDist - 4) / 16, 0, 1) : 0; h.dmg = v.damage || 0;
    if (this.mode === 'timeattack') { h.lap = Math.min(this.laps, this.lapTimes.length + 1); h.laps = this.laps; h.lapT = this.lapT; h.bestLap = this.bestLapRun; h.par = this.parLap; h.lastLap = this.lapTimes[this.lapTimes.length - 1] || 0; }
    h.stars = this.stars; h.cash = this.cashEarned; h.px = v.x; h.pz = v.z; h.yaw = v.yaw; h.manual = this.manual;
  }
  // ---------------------------------------------------------------- end
  finish() {
    if (this.finished) return; this.finished = true; this.phase = 'finished'; this.scorer.finish(); const sc = this.scorer;
    const score = Math.round(sc.total); let stars = 0; const tm = this.mode;
    if (tm === 'timeattack') { const t = (this.lapTimes.reduce((a, b) => a + b, 0)) / Math.max(1, this.lapTimes.length); stars = this.lapTimes.length < this.laps ? 0 : (t <= this.stars[2] ? 3 : t <= this.stars[1] ? 2 : t <= this.stars[0] ? 1 : 0); this.avgLap = t; }
    else if (tm === 'challenge' || tm === 'tandem') stars = score >= this.stars[2] ? 3 : score >= this.stars[1] ? 2 : score >= this.stars[0] ? 1 : 0;
    const res = { mode: tm, mapId: this.mapId, tod: this.tod, carId: this.car.id, eventId: this.event ? this.event.id : null, score, target: this.target, stars, time: this.time, lapTimes: this.lapTimes || [], bestLap: this.bestLapRun || 0, laps: this.laps, par: this.parLap || 0, stats: { ...sc.stats, topSpeed: this.runStats.topSpeed || 0 }, newDisc: this.newDisc };
    const out = this.profile.applyRun(res); res.out = out; res.starThresholds = this.stars; this.result = res; this.phase = 'finished'; audio.levelUp();
    this.app.onResult && this.app.onResult(res); return res;
  }
  quit() { if (!this.finished) { this.scorer.finish(); } this.dispose(); }
  dispose() {
    this.running = false; audio.stopEngine(); audio.squeal(0, 0); audio.rumble(0); audio.stopMusic();
    try { this.model.dispose(); if (this.lead) this.lead.model.dispose(); this.fx.dispose(); this.world.dispose(); if (this.traffic) this.traffic.dispose(); this.envTex && this.envTex.dispose(); this.sky.material.dispose(); } catch (e) { console.warn(e); }
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.scene = null;
  }
}
export function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; }
