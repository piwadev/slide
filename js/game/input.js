// Keyboard + gamepad input -> normalised driving controls. Edge-triggered actions are queued and consumed by the game each frame.
const KEYMAP = {
  throttle: ['KeyW', 'ArrowUp'], brake: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], hb: ['Space'], kick: ['ShiftLeft', 'ShiftRight'],
  up: ['KeyE'], down: ['KeyQ'], cam: ['KeyC'], reset: ['KeyR'], pause: ['Escape', 'KeyP'], map: ['KeyM'], look: ['KeyV'], photo: ['KeyF'], nitro: [],
};
export class Input {
  constructor() {
    this.keys = new Set(); this.edges = []; this.steerKb = 0; this.pad = null; this.enabled = true; this.mouse = { dx: 0, dy: 0, wheel: 0, down: false };
    this.last = 'kb';
    addEventListener('keydown', e => { if (!this.enabled) return; if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (!e.repeat) this.edges.push(e.code); this.keys.add(e.code); this.last = 'kb'; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', e => { if (this.mouse.down) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    addEventListener('mousedown', e => { if (e.target && e.target.tagName === 'CANVAS') this.mouse.down = true; }); addEventListener('mouseup', () => { this.mouse.down = false; });
    addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    this.padPrev = [];
  }
  down(a) { return KEYMAP[a].some(k => this.keys.has(k)); }
  // consume edge events: returns list of action names
  actions() {
    const out = []; for (const code of this.edges) for (const a in KEYMAP) if (KEYMAP[a].includes(code)) out.push(a); this.edges.length = 0;
    const gp = this.gamepad(); if (gp) { const prev = this.padPrev; const b = i => gp.buttons[i] && gp.buttons[i].pressed; const edge = (i, a) => { if (b(i) && !prev[i]) { out.push(a); this.last = 'pad'; } };
      edge(3, 'cam'); edge(9, 'pause'); edge(8, 'reset'); edge(4, 'down'); edge(5, 'up'); edge(2, 'look'); this.padPrev = gp.buttons.map(x => x.pressed); }
    return out;
  }
  gamepad() { const l = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of l) if (g && g.connected) return g; return null; }
  read(dt, sens = 0.5) {
    if (this.override) return this.override; // automated tests
    let steer = 0, thr = 0, brk = 0, hb = 0, kick = false;
    const kbL = this.down('left') ? 1 : 0, kbR = this.down('right') ? 1 : 0, target = kbL - kbR; // +left
    const rate = target === 0 ? 7 : (Math.sign(target) !== Math.sign(this.steerKb) && this.steerKb !== 0 ? 9 : 3.2 + sens * 2.2);
    this.steerKb += Math.max(-rate * dt, Math.min(rate * dt, target - this.steerKb));
    steer = this.steerKb; thr = this.down('throttle') ? 1 : 0; brk = this.down('brake') ? 1 : 0; hb = this.down('hb') ? 1 : 0; kick = this.down('kick');
    const gp = this.gamepad();
    if (gp) {
      const ax = gp.axes[0] || 0, dz = 0.12; const sx = Math.abs(ax) < dz ? 0 : Math.sign(ax) * (Math.abs(ax) - dz) / (1 - dz);
      const rt = gp.buttons[7] ? gp.buttons[7].value : 0, lt = gp.buttons[6] ? gp.buttons[6].value : 0;
      if (Math.abs(sx) > 0.02 || rt > 0.05 || lt > 0.05 || (gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[1] && gp.buttons[1].pressed)) { this.last = 'pad'; steer = -Math.sign(sx) * Math.pow(Math.abs(sx), 1.3); thr = Math.max(thr, rt); brk = Math.max(brk, lt); if (gp.buttons[0] && gp.buttons[0].pressed) hb = 1; if (gp.buttons[1] && gp.buttons[1].pressed) kick = true; }
    }
    return { steer, throttle: thr, brake: brk, hb, kick };
  }
  look() { const m = this.mouse; const r = { dx: m.dx, dy: m.dy, wheel: m.wheel }; m.dx = m.dy = m.wheel = 0; const gp = this.gamepad(); if (gp && gp.axes.length > 3) { r.dx += (Math.abs(gp.axes[2]) > 0.2 ? gp.axes[2] * 12 : 0); r.dy += (Math.abs(gp.axes[3]) > 0.2 ? gp.axes[3] * 8 : 0); } return r; }
  rumble(power, dur = 120) { const gp = this.gamepad(); if (gp && gp.vibrationActuator) { try { gp.vibrationActuator.playEffect('dual-rumble', { duration: dur, strongMagnitude: Math.min(1, power), weakMagnitude: Math.min(1, power * 0.7) }); } catch { /* */ } } }
}
