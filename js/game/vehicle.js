// Arcade-sim vehicle model: bicycle model with per-axle slip-angle tyre curves, friction ellipse (power oversteer, handbrake),
// longitudinal weight transfer, torque curve + gearbox, countersteer assist. Pure maths (no DOM / three) so it can be tested in node.
import { computeStats } from '../data/parts.js';
const G = 9.81, RHO = 1.2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// tyre lateral curve: rises to 1 at slip x=1, then falls to `slide`
function tyreCurve(x, slide) { x = Math.abs(x); return x < 1 ? Math.sin(x * Math.PI / 2) : slide + (1 - slide) / Math.pow(x, 1.25); }

export class Vehicle {
  constructor(car, cfg) { this.car = car; this.setCfg(cfg); this.reset(0, 0, 0); }
  setCfg(cfg) {
    const c = this.car, s = this.stats = computeStats(c, cfg); this.cfg = cfg; this.tune = cfg.tune;
    this.mass = s.weight + 75; this.L = c.wb; this.a = this.L * (1 - c.front); this.b = this.L * c.front; // a: CG->front axle, b: CG->rear axle
    this.h = 0.5; this.Iz = this.mass * (c.L * c.L + c.W * c.W) / 12 * 1.15;
    this.R = c.wr; const wP = s.power * 745.7;
    const rpmPeak = s.redline * 0.78; this.Tmax = wP * 0.9 / (rpmPeak * Math.PI / 30) * 1.35;
    this.gears = c.gears; this.final = c.final * s.final; this.rGear = -3.2; this.redline = s.redline; this.idle = c.idle;
    this.turbo = /t$|tt$|rotary/.test(c.sound.type) || cfg.perf.turbo > 0; this.lag = (cfg.perf.turbo > 0 ? s.lag : 0.35) + 0.15 - s.response;
    this.maxSteer = s.steer * Math.PI / 180; this.shiftTime = 0.17 * s.shift;
    this.mu = s.grip; this.driftBias = s.driftBias; this.slideTire = s.slide || 1; this.lock = s.lock;
    this.brakeMax = 1.0 * s.brake * this.mass * G * 1.0; this.awd = c.drive === 'AWD';
    this.cdA = 0.5 * RHO * c.cd * 2.0 * (c.W > 1.8 ? 1.05 : 1);
  }
  reset(x, z, yaw) {
    Object.assign(this, { x, z, yaw, vx: 0, vz: 0, r: 0, steer: 0, steerIn: 0, throttle: 0, brake: 0, hb: 0, gear: 1, rpm: this.idle, spin: 0, boost: 0, shiftT: 0, clutch: 0, ax: 0, ay: 0, u: 0, v: 0, beta: 0, speed: 0, slipF: 0, slipR: 0, spinning: false, locked: false, rev: false, damage: 0, offroad: 0, surf: 1, dtick: 0, kick: 0, manual: false, absSpeed: 0, fwdSpeed: 0, roll: 0, pitch: 0, squat: 0, blowoff: 0, backfire: 0 });
  }
  // inputs: {steer -1..1 (+left?), throttle 0..1, brake 0..1, hb 0..1, kick bool, shiftUp, shiftDown}
  step(dt, inp, env = {}) {
    const c = this.car, s = this.stats, m = this.mass;
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    // local velocity (forward u, left v)
    let u = this.vx * sinY + this.vz * cosY, v = this.vx * cosY - this.vz * sinY;
    this.u = u; this.v = v; const speed = Math.hypot(u, v); this.speed = speed;
    const surf = env.grip === undefined ? 1 : env.grip; this.surf = surf; const drag = env.drag || 0;
    // ---------- driver inputs
    let thr = clamp(inp.throttle || 0, 0, 1), brk = clamp(inp.brake || 0, 0, 1), hb = clamp(inp.hb || 0, 0, 1);
    let reverse = false;
    if (brk > 0.05 && u < 1.2 && thr < 0.05) { reverse = true; thr = brk; brk = 0; }
    else if (thr > 0.05 && u < -1.5 && brk < 0.05) { brk = thr; thr = 0; }
    this.rev = reverse; this.throttle = thr; this.brake = brk; this.hb = hb;
    // steering: speed sensitive + countersteer assist
    const spdKmh = speed * 3.6;
    const sens = 0.5 + (this.tune.sens - 0.5) * 0.8;
    const lim = this.maxSteer * (1 / (1 + Math.pow(spdKmh / (150 + this.stats.steer * 3), 2) * 0.6));
    const betaF0 = Math.atan2(v + this.a * this.r, Math.max(2, Math.abs(u))) * Math.sign(u || 1);
    this.bf = (this.bf || 0) + (betaF0 - (this.bf || 0)) * Math.min(1, dt * 14); const betaF = this.bf;
    const assist = clamp(this.tune.assist * 1.1 + 0.15, 0, 1.2);
    const sliding = clamp((Math.abs(betaF) - 0.1) / 0.3, 0, 1) * clamp((speed - 4) / 6, 0, 1);
    let target = (inp.steer || 0) * lim * (0.65 + sens * 0.7);
    target += assist * betaF * (0.6 + 0.4 * sliding) * (speed > 3 ? 1 : 0) * 0.85;
    target = clamp(target, -this.maxSteer, this.maxSteer);
    const rate = (Math.abs(target) > Math.abs(this.steer) ? 5.2 : 7.5) * (0.6 + sens * 0.6);
    this.steer += clamp(target - this.steer, -rate * dt, rate * dt);
    const dl = this.steer;
    // ---------- engine / gearbox
    const wheelRpm = (Math.max(Math.abs(u), speed * 0.9) + this.spin) / this.R * 30 / Math.PI;
    const ratio = reverse ? Math.abs(this.rGear) : this.gears[this.gear - 1];
    let rpm = clamp(wheelRpm * ratio * this.final, this.idle, this.redline * 1.02);
    if (this.clutch > 0) rpm = Math.max(rpm, this.redline * 0.7);
    if (this.shiftT > 0) { this.shiftT -= dt; }
    else if (!reverse) {
      if (!this.manual) {
        const up = this.redline * (thr > 0.7 ? 0.935 : 0.72), dn = this.redline * (thr > 0.7 ? 0.5 : 0.36);
        if (rpm > up && this.gear < this.gears.length) { this.gear++; this.shiftT = this.shiftTime; this.blowoff = 1; }
        else if (rpm < dn && this.gear > 1) { this.gear--; this.shiftT = this.shiftTime * 0.6; }
      } else {
        if (inp.shiftUp && this.gear < this.gears.length) { this.gear++; this.shiftT = this.shiftTime; }
        if (inp.shiftDown && this.gear > 1) { this.gear--; this.shiftT = this.shiftTime * 0.6; }
      }
    }
    if (inp.kick) this.kick = 0.38; if (this.kick > 0) this.kick -= dt;
    this.clutch = this.kick > 0 ? this.kick : 0;
    const x = rpm / this.redline;
    const curve = 0.55 + 0.45 * Math.sin(Math.PI * clamp(Math.pow(x, 0.85), 0, 1)) * (x < 1 ? 1 : 0.6) + (x < 0.15 ? -0.25 : 0);
    this.boost += ((thr * sstep(0.28, 0.62, x)) - this.boost) * Math.min(1, dt / Math.max(0.08, this.lag * 0.8));
    const tq = this.Tmax * Math.max(0.08, curve) * (this.turbo ? 0.66 + 0.34 * this.boost : 1) * (rpm >= this.redline * 1.0 ? 0 : 1);
    if (this.turbo && this.boost > 0.6 && thr < 0.2) this.blowoff = 1; this.blowoff = Math.max(0, this.blowoff - dt * 2.5);
    this.backfire = (thr < 0.1 && x > 0.55 && this.u > 4) ? clamp(this.backfire + dt * 4, 0, 1) : Math.max(0, this.backfire - dt * 6);
    this.rpm += (rpm - this.rpm) * Math.min(1, dt * 18);
    let Fdrive = (this.shiftT > 0 ? 0 : tq * thr * ratio * this.final * 0.86 / this.R) * (reverse ? -0.8 : 1);
    if (this.clutch > 0) Fdrive = Math.max(Fdrive, 0) * 0 + this.Tmax * 1.0 * ratio * this.final * 0.86 / this.R * 0.9 * (thr > 0.2 ? 1 : 0.3) * (reverse ? -1 : 1);
    // ---------- weight transfer & axle loads
    const Wt = m * G; const ax = this.ax;
    let FzF = Wt * this.b / this.L - m * ax * this.h / this.L, FzR = Wt * this.a / this.L + m * ax * this.h / this.L;
    const aero = (s.aero || 0) * 0.5 * speed * speed * 0.6; FzR += aero * 0.55; FzF += aero * 0.45;
    FzF = Math.max(FzF, 0.15 * Wt); FzR = Math.max(FzR, 0.15 * Wt);
    // ---------- tyre forces
    const gb = this.stats.gripBal || 0;
    const muF = this.mu * surf * (1 - gb * 0.4) * 0.98, muR = this.mu * surf * (1 + gb * 0.4);
    const sgn = u >= 0 ? 1 : -1; const ua = Math.max(Math.abs(u), 0.5);
    const alF = Math.atan2(v + this.a * this.r, ua) * sgn - dl * (u >= 0 ? 1 : -1) * 1; // slip angle front
    const alR = Math.atan2(v - this.b * this.r, ua) * sgn;
    this.slipF = alF; this.slipR = alR;
    const peakF = 0.17 + 0.03 * (this.stats.tireId === 'slick' ? -1 : 0), peakR = 0.16;
    const slideF = 0.86, slideR = clamp(0.9 - (this.driftBias - 1) * 0.3 - 0.06 * (this.slideTire - 1) * 0 , 0.6, 0.97) * (1 / Math.pow(this.slideTire, 0.35));
    // longitudinal demands
    const bias = this.tune.brakeBias; const brakeF = brk * this.brakeMax * (0.3 + bias * 0.8), brakeR = brk * this.brakeMax * (1.3 - (0.3 + bias * 0.8));
    const driveShareF = this.awd ? 0.35 : 0;
    let FxF = -Math.sign(u || 1) * brakeF * 0.55 + Fdrive * driveShareF, FxR = -Math.sign(u || 1) * brakeR * 0.45 + Fdrive * (1 - driveShareF);
    if (Math.abs(u) < 0.3) { FxF *= Math.abs(u) / 0.3 * (brk > 0 ? 1 : 1); }
    // handbrake: rear tyres lock
    let muRh = muR; if (hb > 0) { FxR += -Math.sign(u || 1) * hb * FzR * muR * 1.15 * clamp(Math.abs(u) / 2, 0, 1); muRh = muR * (1 - 0.5 * hb); }
    // diff lock: more lock = rear force shared -> keeps rear spinning in slides (tail-happy)
    const FmaxF = muF * FzF, FmaxR = muRh * FzR;
    const exceedR = Math.max(0, Math.abs(FxR) - FmaxR * 0.8), exceedF = Math.max(0, Math.abs(FxF) - FmaxF * 0.95);
    FxF = clamp(FxF, -FmaxF, FmaxF); FxR = clamp(FxR, -FmaxR * (hb > 0.2 ? 1 : 0.88), FmaxR * (hb > 0.2 ? 1 : 0.88));
    const kF = Math.sqrt(Math.max(0.0, 1 - Math.pow(FxF / FmaxF, 2))), kR = Math.sqrt(Math.max(0.0, 1 - Math.pow(FxR / FmaxR, 2)));
    const lockBoost = 1 + this.lock * 0.12; // locked diff: more consistent rear bite in the slide
    let FyF = -FmaxF * tyreCurve(alF / peakF, slideF) * Math.sign(alF) * Math.max(0.3, kF);
    let FyR = -FmaxR * tyreCurve(alR / peakR, slideR) * Math.sign(alR) * Math.max(0.46, kR) * lockBoost;
    // low speed: damp lateral (avoid singularity)
    const lowS = clamp(Math.abs(u) / 3, 0, 1);
    FyF *= 0.25 + 0.75 * lowS; FyR *= 0.25 + 0.75 * lowS;
    // spin (rear wheel overspeed) for rpm/smoke
    this.spin += (exceedR / (m * 0.1)) * dt * (reverse ? 0 : 1); this.spin = Math.max(0, this.spin - (this.spin * 3.5 + 0.5) * dt) + 0; this.spin = Math.min(this.spin, 40);
    if (hb > 0.2 && Math.abs(u) > 3) this.spin = Math.max(this.spin, 0);
    this.spinning = exceedR > 0 || hb > 0.2 && speed > 4;
    // ---------- resultant in car frame
    const cd = Math.cos(dl), sd = Math.sin(dl);
    const fxCar = FxF * cd - FyF * sd + FxR;
    const fyCar = FxF * sd + FyF * cd + FyR;
    const dragF = -(this.cdA * speed * u + 0.015 * m * G * Math.sign(u) * Math.min(1, Math.abs(u)) + drag * m * u * 0.5 * Math.abs(u) * 0.02 + (env.off ? 1 : 0) * m * 1.4 * u);
    // yaw
    const bAbs = Math.abs(this.beta), over = Math.max(0, bAbs - 0.78) / 0.5;
    const Mz = this.a * (FxF * sd + FyF * cd) - this.b * FyR - (this.tune.assist * 0.8 + 0.2) * over * this.Iz * 3.2 * Math.sign(this.r) * Math.min(1, Math.abs(this.r) / 1.2) * (speed > 6 ? 1 : 0);
    // integrate in body frame
    const du = (fxCar + dragF) / m + v * this.r;  // dU/dt = F/m + v r
    const dv = fyCar / m - u * this.r;
    const dr = Mz / this.Iz - this.r * (0.9 + (speed < 5 ? 3 : 0)) * 0.5 * 0; // damping added below
    this.ax = clamp(fxCar / m, -14, 14) * 0.5 + this.ax * 0.5; this.ay = fyCar / m;
    u += du * dt; v += dv * dt; this.r += (Mz / this.Iz) * dt;
    // yaw damping (aero + tyre scrub), stronger at low speed
    this.r -= this.r * (0.6 + clamp(1 - speed / 4, 0, 1) * 6) * dt;
    if (speed < 0.4 && thr < 0.05 && brk > 0.05) { u *= 0.9; v *= 0.9; }
    if (speed < 0.15 && thr < 0.05 && !hb) { u = 0; v = 0; this.r = 0; }
    // back to world
    this.vx = u * sinY + v * cosY; this.vz = u * cosY - v * sinY;
    this.yaw += this.r * dt; this.x += this.vx * dt; this.z += this.vz * dt;
    // outputs
    this.beta = speed > 1.5 ? Math.atan2(v, Math.abs(u) + 0.001) * Math.sign(u || 1) : 0; // body slip angle (+ = velocity left of heading)
    this.fwdSpeed = u;
    this.roll += (clamp(-this.ay * 0.0055, -0.1, 0.1) - this.roll) * Math.min(1, dt * 9) * (1 / (this.stats.roll || 1)) * 0.9 + 0;
    this.pitch += (clamp(-this.ax * 0.004, -0.06, 0.06) - this.pitch) * Math.min(1, dt * 8);
    this.slideAmt = clamp((Math.abs(alR) - peakR * 0.8) / peakR, 0, 2); // tyre saturation for smoke/audio
    this.slipFront = clamp((Math.abs(alF) - peakF) / peakF, 0, 2);
    return this;
  }
}
