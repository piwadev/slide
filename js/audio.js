// WebAudio synthesis: RPM-driven engine per car (distinct recipe per engine type), turbo spool + blow-off, exhaust pops, tyre squeal,
// wind, impacts, UI sounds and a tiny generative synthwave loop. No audio files.
export const ENGINES = {
  i4t:    { cyl: 4, saw: 1.0, sq: 0.35, sub: 0.2, lp: 2.4, drive: 2.2, lump: 0.05, rasp: 0.35, base: 70 },
  i4na:   { cyl: 4, saw: 0.8, sq: 0.55, sub: 0.1, lp: 3.4, drive: 1.6, lump: 0.03, rasp: 0.3, base: 85 },
  i6t:    { cyl: 6, saw: 1.0, sq: 0.25, sub: 0.35, lp: 2.0, drive: 2.0, lump: 0.02, rasp: 0.3, base: 60 },
  i6na:   { cyl: 6, saw: 0.85, sq: 0.5, sub: 0.2, lp: 3.8, drive: 1.5, lump: 0.015, rasp: 0.28, base: 65 },
  rotary: { cyl: 3, saw: 0.5, sq: 0.9, sub: 0.0, lp: 5.0, drive: 3.2, lump: 0.0, rasp: 0.6, base: 95, buzz: 1 },
  flat6:  { cyl: 6, saw: 0.9, sq: 0.35, sub: 0.45, lp: 2.6, drive: 2.4, lump: 0.12, rasp: 0.35, base: 55 },
  v8:     { cyl: 8, saw: 1.0, sq: 0.2, sub: 0.6, lp: 1.8, drive: 2.6, lump: 0.22, rasp: 0.3, base: 50 },
  v8big:  { cyl: 8, saw: 1.0, sq: 0.1, sub: 0.9, lp: 1.3, drive: 3.0, lump: 0.35, rasp: 0.25, base: 42 },
  v8sc:   { cyl: 8, saw: 1.0, sq: 0.2, sub: 0.7, lp: 1.7, drive: 2.8, lump: 0.2, rasp: 0.3, base: 48, whine: 1 },
  v10:    { cyl: 10, saw: 0.9, sq: 0.55, sub: 0.15, lp: 4.5, drive: 2.0, lump: 0.03, rasp: 0.4, base: 70 },
  v8flat: { cyl: 8, saw: 0.8, sq: 0.7, sub: 0.1, lp: 5.0, drive: 2.0, lump: 0.0, rasp: 0.45, base: 75 },
  v8tt:   { cyl: 8, saw: 1.0, sq: 0.35, sub: 0.4, lp: 2.8, drive: 2.5, lump: 0.1, rasp: 0.35, base: 58 },
};
export class AudioEngine {
  constructor() { this.ctx = null; this.vol = 0.8; this.musicOn = true; this.ready = false; this.engine = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx; this.master = c.createGain(); this.master.gain.value = this.vol; const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master); this.mus = c.createGain(); this.mus.gain.value = 0.22; this.mus.connect(this.master);
    // noise buffer
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
    this.buildStatic(); this.ready = true;
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.start(0, Math.random()); return s; }
  buildStatic() {
    const c = this.ctx;
    // tyre squeal
    this.sq = { src: this.noiseSrc(), bp: c.createBiquadFilter(), g: c.createGain(), bp2: c.createBiquadFilter() }; this.sq.bp.type = 'bandpass'; this.sq.bp.Q.value = 6; this.sq.bp.frequency.value = 1400; this.sq.bp2.type = 'bandpass'; this.sq.bp2.Q.value = 3; this.sq.bp2.frequency.value = 2600; this.sq.g.gain.value = 0;
    this.sq.src.connect(this.sq.bp); this.sq.src.connect(this.sq.bp2); this.sq.bp.connect(this.sq.g); this.sq.bp2.connect(this.sq.g); this.sq.g.connect(this.sfx);
    // wind
    this.wind = { src: this.noiseSrc(), lp: c.createBiquadFilter(), g: c.createGain() }; this.wind.lp.type = 'lowpass'; this.wind.lp.frequency.value = 500; this.wind.g.gain.value = 0; this.wind.src.connect(this.wind.lp); this.wind.lp.connect(this.wind.g); this.wind.g.connect(this.sfx);
    // gravel / offroad rumble
    this.rum = { src: this.noiseSrc(), lp: c.createBiquadFilter(), g: c.createGain() }; this.rum.lp.type = 'lowpass'; this.rum.lp.frequency.value = 260; this.rum.g.gain.value = 0; this.rum.src.connect(this.rum.lp); this.rum.lp.connect(this.rum.g); this.rum.g.connect(this.sfx);
    // turbo whistle
    this.tb = { o: c.createOscillator(), g: c.createGain() }; this.tb.o.type = 'sine'; this.tb.o.frequency.value = 3000; this.tb.g.gain.value = 0; this.tb.o.connect(this.tb.g); this.tb.g.connect(this.sfx); this.tb.o.start();
    // engine bus
    this.engBus = c.createGain(); this.engBus.gain.value = 0; this.engBus.connect(this.sfx);
  }
  // ---- engine
  setEngine(type, opts = {}) {
    if (!this.ready) return; const P = ENGINES[type] || ENGINES.i4t; this.P = P; this.turboOn = !!opts.turbo; this.exh = opts.exhaust || 0;
    this.stopEngine(); const c = this.ctx;
    const mk = (t) => { const o = c.createOscillator(); o.type = t; o.frequency.value = 40; const g = c.createGain(); g.gain.value = 0; o.connect(g); o.start(); return { o, g }; };
    const e = this.engine = { saw: mk('sawtooth'), sq: mk('square'), sub: mk('sawtooth'), oct: mk('triangle') };
    e.mix = c.createGain(); e.shaper = c.createWaveShaper(); e.lp = c.createBiquadFilter(); e.lp.type = 'lowpass'; e.lp.Q.value = 1.2; e.hp = c.createBiquadFilter(); e.hp.type = 'highpass'; e.hp.frequency.value = 35;
    const curve = new Float32Array(1024); const k = P.drive * 6; for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); } e.shaper.curve = curve;
    for (const n of ['saw', 'sq', 'sub', 'oct']) e[n].g.connect(e.mix); e.mix.connect(e.shaper); e.shaper.connect(e.hp); e.hp.connect(e.lp); e.lp.connect(this.engBus);
    // intake/rasp noise
    e.noise = { src: this.noiseSrc(), bp: c.createBiquadFilter(), g: c.createGain() }; e.noise.bp.type = 'bandpass'; e.noise.bp.Q.value = 0.9; e.noise.g.gain.value = 0; e.noise.src.connect(e.noise.bp); e.noise.bp.connect(e.noise.g); e.noise.g.connect(this.engBus);
    // lump LFO (V8 burble)
    e.lfo = c.createOscillator(); e.lfoG = c.createGain(); e.lfo.frequency.value = 8; e.lfoG.gain.value = 0; e.lfo.connect(e.lfoG); e.lfoG.connect(e.mix.gain); e.lfo.start(); e.mix.gain.value = 1;
    this.engBus.gain.setTargetAtTime(0.5, c.currentTime, 0.1);
  }
  stopEngine() { if (!this.engine) return; const e = this.engine; for (const n of ['saw', 'sq', 'sub', 'oct']) { try { e[n].o.stop(); } catch { /* */ } } try { e.noise.src.stop(); e.lfo.stop(); } catch { /* */ } this.engine = null; }
  // rpm (absolute), redline, throttle 0..1, boost 0..1
  updateEngine(rpm, redline, thr, boost, speed, dt) {
    if (!this.ready || !this.engine) return; const c = this.ctx, t = c.currentTime, P = this.P, e = this.engine; const x = Math.min(1.05, rpm / redline);
    const f = rpm / 60 * P.cyl / 2; const set = (p, v) => p.setTargetAtTime(v, t, 0.025);
    set(e.saw.o.frequency, f); set(e.sq.o.frequency, f * 2.003); set(e.sub.o.frequency, f * 0.5); set(e.oct.o.frequency, f * (P.buzz ? 3 : 4));
    const load = 0.35 + 0.65 * thr;
    set(e.saw.g.gain, P.saw * 0.45 * load); set(e.sq.g.gain, P.sq * 0.25 * (0.4 + x * 0.6) * load); set(e.sub.g.gain, P.sub * 0.35 * (1.05 - x * 0.5) * load); set(e.oct.g.gain, 0.12 * x * load * (P.buzz ? 2.2 : 1));
    set(e.lp.frequency, 380 + (P.lp * 650) * (0.35 + x * 1.7) * (0.55 + thr * 0.7) * (1 + this.exh * 0.12)); set(e.hp.frequency, 28 + P.base * 0.2);
    set(e.noise.bp.frequency, 900 + x * 2600); set(e.noise.g.gain, P.rasp * 0.06 * (0.2 + thr) * (0.4 + x));
    if (P.lump) { set(e.lfo.frequency, Math.max(4, f * 0.5)); set(e.lfoG.gain, P.lump * (1.2 - thr * 0.6)); }
    // turbo whistle
    const tb = this.turboOn ? boost * (0.15 + thr * 0.85) : 0; set(this.tb.o.frequency, 2200 + x * 5200 * boost + 800); set(this.tb.g.gain, tb * 0.05 * (P.whine ? 1.8 : 1));
    if (P.whine) { set(this.tb.o.frequency, 1500 + x * 6000); set(this.tb.g.gain, 0.03 + 0.05 * thr * x); }
    // wind + tyre
    set(this.wind.g.gain, Math.min(0.28, speed / 70 * 0.28)); set(this.wind.lp.frequency, 300 + speed * 15);
  }
  engineGain(v) { if (this.ready) this.engBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  squeal(amount, pitch) { if (!this.ready) return; const t = this.ctx.currentTime; this.sq.g.gain.setTargetAtTime(Math.min(0.2, amount * 0.2), t, 0.05); this.sq.bp.frequency.setTargetAtTime(1000 + pitch * 1500, t, 0.05); this.sq.bp2.frequency.setTargetAtTime(2100 + pitch * 1900, t, 0.08); }
  rumble(amount) { if (!this.ready) return; this.rum.g.gain.setTargetAtTime(Math.min(0.22, amount * 0.22), this.ctx.currentTime, 0.1); }
  blowoff() { if (!this.ready) return; const c = this.ctx, t = c.currentTime; const s = this.noiseSrc(), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(5200, t); bp.frequency.exponentialRampToValueAtTime(2200, t + 0.35); bp.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); s.connect(bp); bp.connect(g); g.connect(this.sfx); s.stop(t + 0.45); }
  pop(strength = 1) { if (!this.ready) return; const c = this.ctx, t = c.currentTime; const s = this.noiseSrc(), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = 400 + Math.random() * 900; bp.Q.value = 0.8; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * strength, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); s.connect(bp); bp.connect(g); g.connect(this.sfx); s.stop(t + 0.12); }
  crash(power = 1) { if (!this.ready) return; const c = this.ctx, t = c.currentTime; const s = this.noiseSrc(), lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = 900 + 600 * power; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6 * Math.min(1, power), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); s.connect(lp); lp.connect(g); g.connect(this.sfx); s.stop(t + 0.6); const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3); og.gain.setValueAtTime(0.5 * Math.min(1, power), t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(og); og.connect(this.sfx); o.start(t); o.stop(t + 0.4); }
  tone(freq, dur = 0.12, type = 'sine', vol = 0.18, when = 0, slide = 0) { if (!this.ready) return; const c = this.ctx, t = c.currentTime + when; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.05); }
  click() { this.tone(620, 0.05, 'triangle', 0.1); }
  hover() { this.tone(900, 0.03, 'sine', 0.04); }
  confirm() { this.tone(520, 0.09, 'triangle', 0.14); this.tone(780, 0.12, 'triangle', 0.14, 0.07); }
  error() { this.tone(180, 0.18, 'sawtooth', 0.12, 0, 0.7); }
  cash() { this.tone(1200, 0.08, 'square', 0.08); this.tone(1800, 0.14, 'square', 0.08, 0.07); }
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.16, i * 0.09)); }
  tick(mult = 1) { this.tone(880 + mult * 60, 0.04, 'square', 0.04); }
  combo() { this.tone(660, 0.12, 'triangle', 0.12); this.tone(990, 0.16, 'triangle', 0.12, 0.08); }
  bank() { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.13, i * 0.07)); }
  fail() { this.tone(300, 0.3, 'sawtooth', 0.14, 0, 0.4); }
  // ---- tiny generative synthwave
  startMusic(mood = 'menu') {
    if (!this.ready || !this.musicOn || this.musicTimer) return; const c = this.ctx; const bpm = mood === 'drive' ? 108 : 92, step = 60 / bpm / 4; this.mi = 0; this.next = c.currentTime + 0.1;
    const roots = [45, 45, 41, 43]; const scale = [0, 3, 7, 10, 12, 15];
    const note = (m) => 440 * Math.pow(2, (m - 69) / 12);
    this.musicTimer = setInterval(() => {
      while (this.next < c.currentTime + 0.4) { const t = this.next, i = this.mi, bar = Math.floor(i / 16) % 4, root = roots[bar];
        if (i % 4 === 0 || i % 16 === 10) this.mnote(note(root), t, step * 3.4, 'sawtooth', 0.22, 380 + (i % 16) * 20);
        if (i % 2 === 0) this.mnote(note(root + 24 + scale[(i * 3 + bar) % scale.length]), t, step * 1.5, 'square', 0.05, 2600);
        if (i % 8 === 0) this.mnote(note(root + 12), t, step * 14, 'triangle', 0.06, 900);
        if (i % 4 === 2) this.mhat(t); if (i % 16 === 0 || i % 16 === 8) this.mkick(t);
        this.mi++; this.next += step; }
    }, 120);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
  mnote(f, t, d, type, v, cut) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(lp); lp.connect(g); g.connect(this.mus); o.start(t); o.stop(t + d + 0.05); }
  mhat(t) { const c = this.ctx, s = this.noiseSrc(), hp = c.createBiquadFilter(), g = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 7000; g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); s.connect(hp); hp.connect(g); g.connect(this.mus); s.stop(t + 0.08); }
  mkick(t) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + 0.2); }
}
export const audio = new AudioEngine();
