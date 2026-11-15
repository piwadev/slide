// SLIDE — app bootstrap, main loop, scene switching (menu garage <-> driving session).
import { Stage } from './render/stage.js';
import { GarageScene } from './render/garage.js';
import { Profile } from './core/progress.js';
import { Input } from './game/input.js';
import { Game } from './game/game.js';
import { HUD } from './ui/hud.js';
import { UI } from './ui/screens.js';
import { initAdmin } from './ui/adminUI.js';
import { audio } from './audio.js';
import { carById, CARS } from './data/cars.js';

const $ = s => document.querySelector(s);
const bar = (p, m) => { $('#ldBar').style.width = Math.round(p * 100) + '%'; if (m) $('#ldMsg').textContent = m; };

class App {
  async boot() {
    bar(0.05, 'Loading fonts…');
    await Promise.all(['Bangers', 'Knewave', 'Permanent Marker', 'Rubik Spray Paint'].map(f => document.fonts.load(`80px "${f}"`)).concat(['500 20px "Barlow Condensed"', '700 20px "Barlow Condensed"', '800 20px "Barlow Condensed"', '400 16px Barlow', '600 16px Barlow'].map(f => document.fonts.load(f)))).catch(() => {});
    bar(0.2, 'Starting engine…'); this.profile = new Profile(); const q = this.profile.save.settings.quality;
    this.stage = new Stage($('#gl'), q); this.stage.setQuality(q); this.input = new Input(); audio.setVolume(this.profile.save.settings.master); audio.musicOn = this.profile.save.settings.music;
    bar(0.35, 'Building the garage…'); await new Promise(r => setTimeout(r, 30));
    this.garage = new GarageScene(this.stage); this.hud = new HUD($('#hud')); this.ui = new UI(this); this.game = null; this.debug = this.profile.save.admin.debug; this.mode = 'menu';
    initAdmin(this); window.__slide = { app: this }; window.__cars = carById;
    bar(0.8, 'Polishing paint…'); this.garage.setCar(this.profile.car, this.profile.cfg); this.garage.enter({ quality: q }); this.garage.go('hero', true);
    this.ui.showMenu('drive'); bar(1, 'Ready'); await new Promise(r => setTimeout(r, 250)); $('#loading').classList.add('gone'); setTimeout(() => $('#loading').remove(), 700);
    // first user gesture unlocks audio + menu music
    const unlock = () => { audio.init(); if (this.mode === 'menu' && this.profile.save.settings.music) audio.startMusic('menu'); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    let last = performance.now(); const loop = (t) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (t - last) / 1000); last = t; this.frame(dt); }; requestAnimationFrame(loop);
    this.profile.ensureDaily(); setInterval(() => { if (this.mode === 'menu') this.profile.ensureDaily(); }, 60000);
  }
  frame(dt) {
    if (this.freeze) return;
    if (this.mode === 'game' && this.game && this.game.running) { this.game.update(dt); this.hud.update(this.game, dt, this.profile.save.settings.units); }
    else if (this.mode === 'menu') {
      this.garage.update(dt); if (this.revT > 0) { this.revT -= dt; const x = 1 - Math.abs(this.revT / 2.2 - 0.5) * 2; audio.updateEngine(1100 + x * (this.profile.car.redline - 1500), this.profile.car.redline, 0.9 * x + 0.1, x, 0, dt); if (this.revT <= 0) { audio.engineGain(0); } if (x > 0.9 && !this._bo && this.profile.car.sound.type.match(/t|tt|rotary/)) { this._bo = 1; } }
      this.garage.render();
    }
  }
  rev() { audio.init(); const c = this.profile.car; audio.setEngine(c.sound.type, { turbo: /t$|tt$|rotary/.test(c.sound.type) || this.profile.cfg.perf.turbo > 0, exhaust: this.profile.cfg.perf.exhaust }); audio.engineGain(0.5); this.revT = 2.2; this._bo = 0; setTimeout(() => audio.blowoff(), 1500); }
  async startGame(o) {
    audio.init(); audio.stopEngine(); this.revT = 0; const s = this.profile.save;
    if (!this.profile.mapOpen(o.mapId)) { this.ui.toast('Map locked', 'err'); return; }
    const veil = $('#loading') || null; this.ui.closeModal(); this.garage.leave(); this.ui.menu.classList.add('hidden'); this.hud.root.classList.remove('hidden');
    this.lastOpts = o; this.mode = 'game'; if (this.game) { this.game.dispose(); this.game = null; }
    const g = this.game = new Game(this); const t0 = performance.now();
    try { await g.start({ ...o, carId: s.selected, cfg: this.profile.cfg, quality: s.settings.quality, manual: s.settings.manual }); }
    catch (e) { console.error(e); this.ui.toast('Failed to start: ' + e.message, 'err'); this.quitToMenu(false); return; }
    this.hud.attachMap(g.world); this.hud.last = {}; this.hud.q.hFeed.innerHTML = ''; this.hud.hintT = 12; this.hud.q.hHint.style.opacity = 1;
    window.__slide.game = g;
  }
  pause() { const g = this.game; if (!g || g.finished || g.phase === 'countdown' && false) return; if (this.ui.layer.firstChild) { if (g.paused) this.resume(); return; } g.paused = true; this.ui.pauseMenu(); }
  resume() { if (this.game) this.game.paused = false; this.ui.closeModal(); }
  restart() { if (this.lastOpts) this.startGame(this.lastOpts); }
  onResult(res) { setTimeout(() => { if (this.mode === 'game') this.ui.results(res); }, 900); }
  // bank=true: free roam banks the session (results screen first); otherwise leave straight away
  quitToMenu(bank) {
    const g = this.game;
    if (g && g.running && bank && g.mode === 'free' && !g.finished) { g.finish(); return; }
    this.toMenu();
  }
  toMenu() {
    if (this.game) { try { this.game.dispose(); } catch (e) { console.warn(e); } this.game = null; }
    this.mode = 'menu'; this.hud.root.classList.add('hidden'); audio.stopEngine(); this.garage.setCar(this.profile.car, this.profile.cfg); this.garage.enter({ quality: this.profile.save.settings.quality }); this.garage.go('hero', true); this.ui.showMenu(this.ui.tab);
    if (this.profile.save.settings.music) { audio.musicOn = true; audio.startMusic('menu'); }
  }
  refresh() { this.ui.refresh(); }
  setDebug(v) { this.debug = v; }
  launchEvent(id, force) { const ev = (window.__events || {})[id]; }
  launchQuick(o) { this.startGame(o); }
}
const app = new App();
import('./data/events.js').then(m => { app.launchEvent = (id) => { const ev = m.eventById[id]; if (ev) app.startGame({ mapId: ev.map, mode: ev.mode, event: ev }); }; });
app.boot().catch(e => { console.error(e); $('#ldMsg').textContent = 'Failed to start: ' + e.message; });
