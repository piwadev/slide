// Drift scoring. Points accrue per second from angle x speed; a chain survives short gaps between corners (grace), multiplier grows with
// chain links / duration / perfect drifting, and a crash or spin loses everything not yet banked.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class DriftScorer {
  constructor(cb = {}) { this.cb = cb; this.total = 0; this.reset(); this.stats = { bestCombo: 0, bestAngle: 0, longest: 0, nearMiss: 0, bestMult: 1, bestChain: 0, tandemPts: 0, drifts: 0, banked: 0, crashes: 0, km: 0 }; this.queue = []; }
  reset() { Object.assign(this, { active: false, pts: 0, mult: 1, dur: 0, chain: 0, grace: 0, dir: 0, angle: 0, bonusMult: 0, perfectT: 0, flow: true, longTier: 0, lastCrash: -9, peakAngle: 0, driftTotal: 0 }); }
  say(text, kind = 'info', pts = 0) { this.queue.push({ text, kind, pts }); }
  get live() { return this.active || this.grace > 0; }
  get combo() { return Math.round(this.pts); }
  // st: {speed (km/h), angle (deg, abs), sign (+1 left-slide), offroad, tandem (0..1), dt}
  update(dt, st) {
    const S = this.stats, ang = st.angle, spd = st.speed; this.angle = ang;
    const drifting = ang >= 17 && spd >= 32 && !st.crashed;
    if (this.bonusMult > 0) this.bonusMult = Math.max(0, this.bonusMult - dt * 0.12);
    if (drifting) {
      if (!this.active) { // start / re-enter
        if (this.grace > 0) { this.chain++; S.bestChain = Math.max(S.bestChain, this.chain); if (this.chain >= 2) this.say(`CHAIN x${this.chain}`, 'chain'); }
        else { this.chain = 1; this.pts = 0; this.perfectT = 0; this.flow = true; this.longTier = 0; }
        this.active = true; this.grace = 0; this.dur = 0; this.dir = st.sign; this.peakAngle = 0;
      } else if (st.sign !== this.dir && ang > 22 && this.dur > 0.5) { // transition
        this.dir = st.sign; this.chain++; S.bestChain = Math.max(S.bestChain, this.chain); const b = 250 * this.mult; this.pts += b; this.bonusMult = Math.min(2, this.bonusMult + 0.3); this.say('TRANSITION', 'bonus', Math.round(b)); this.cb.onBonus && this.cb.onBonus('transition');
      }
      this.dur += dt; this.peakAngle = Math.max(this.peakAngle, ang); S.bestAngle = Math.max(S.bestAngle, ang); S.longest = Math.max(S.longest, this.dur);
      const aF = Math.pow(clamp(ang / 45, 0.2, 1.7), 1.15); const sF = clamp(spd, 20, 220);
      this.mult = clamp(1 + (this.chain - 1) * 0.6 + Math.min(2.5, this.dur * 0.25) + this.bonusMult + (this.perfectT > 3 ? 1 : 0) + (this.perfectT > 8 ? 1 : 0), 1, 10);
      let rate = aF * sF * 4.2 * (st.offroad ? 0.4 : 1);
      if (st.tandem > 0) { const tp = rate * 0.7 * st.tandem * this.mult * dt; this.pts += tp; S.tandemPts += tp; this.tandemGain = (this.tandemGain || 0) + tp; }
      this.pts += rate * this.mult * dt;
      // perfect drift: steady 30-65deg at speed
      if (ang > 30 && ang < 68 && spd > 55) this.perfectT += dt; else this.perfectT = Math.max(0, this.perfectT - dt * 0.5);
      if (spd < 38) this.flow = false;
      for (const [t, bn, nm] of [[4, 400, 'LONG DRIFT'], [8, 1000, 'EPIC DRIFT'], [14, 2500, 'MARATHON']]) if (this.dur >= t && this.longTier < t) { this.longTier = t; const b = bn * this.mult; this.pts += b; this.say(nm + ` ${t}s`, 'bonus', Math.round(b)); this.cb.onBonus && this.cb.onBonus('long'); }
      S.bestMult = Math.max(S.bestMult, this.mult);
    } else if (this.active) { this.active = false; this.grace = 1.5; }
    else if (this.grace > 0) { this.grace -= dt; this.mult = Math.max(1, this.mult - dt * 0.4); if (this.grace <= 0) this.bank(); }
    if (this.live) S.bestCombo = Math.max(S.bestCombo, this.pts);
    S.km += st.speed / 3600 * dt;
  }
  bank() {
    if (this.pts < 5) { this.reset(); return 0; }
    let p = this.pts, bonus = 0; if (this.chain >= 4 && this.flow) { bonus = p * 0.25; p += bonus; this.say('PERFECT COMBO +25%', 'perfect', Math.round(bonus)); }
    p = Math.round(p); this.total += p; this.stats.banked += p; this.stats.drifts++; this.stats.bestCombo = Math.max(this.stats.bestCombo, p);
    this.cb.onBank && this.cb.onBank(p, { chain: this.chain, dur: this.dur, perfect: bonus > 0 }); const c = this.chain; this.reset(); return c ? p : 0;
  }
  crash(heavy = true) {
    if (!this.live || this.pts < 5) { this.reset(); return; } const lost = Math.round(this.pts); this.stats.crashes++; this.say('COMBO LOST', 'fail', -lost); this.cb.onLose && this.cb.onLose(lost); this.reset();
  }
  nearMiss(dist) { const b = Math.round((120 + (1.6 - dist) * 120) * (this.live ? this.mult : 1)); this.stats.nearMiss++; this.bonusMult = Math.min(2, this.bonusMult + 0.25); if (this.live) this.pts += b; else { this.total += b; } this.say('NEAR MISS', 'bonus', b); this.cb.onBonus && this.cb.onBonus('near'); }
  zone() { if (!this.active) return; const b = Math.round(250 * this.mult); this.pts += b; this.say('CLIPPING POINT', 'bonus', b); this.cb.onBonus && this.cb.onBonus('zone'); }
  // end of session: bank anything pending
  finish() { if (this.live) { this.grace = 0; this.active = false; this.bank(); } }
}
