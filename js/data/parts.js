// Part / upgrade catalogue. Cosmetic parts are global unlocks you buy once and can fit on any car; performance upgrades are bought per car.
// Each item: { id, name, price, dp (optional Drift-Point price), lvl (player level needed), fx (optional stat effects) }.
// Visual build lives in render/carBuilder.js (keyed by item id); stat effects feed game/vehicle.js through computeStats().
const I = (id, name, price = 0, lvl = 1, extra = {}) => ({ id, name, price, lvl, ...extra });

export const PART_CATS = {
  // ---------------- exterior (global, cosmetic)
  fbumper: { group: 'Exterior', label: 'Front Bumper', items: [I('stock', 'Stock'), I('lip', 'Sport Lip', 2400, 2), I('splitter', 'Track Splitter', 5200, 4, { fx: { grip: 0.01 } }), I('aggro', 'Aggressive + Canards', 9800, 7), I('wide', 'Widebody Chin', 14500, 10), I('mesh', 'Open Mesh Racing', 11800, 13, { dp: 80 })] },
  rbumper: { group: 'Exterior', label: 'Rear Bumper', items: [I('stock', 'Stock'), I('duck', 'Duckbill', 2200, 2), I('diffuser', 'Diffuser', 4800, 4), I('aggro', 'Aggressive Vented', 9500, 8), I('race', 'Race Diffuser + Fins', 13800, 12, { fx: { grip: 0.01 } })] },
  skirts: { group: 'Exterior', label: 'Side Skirts', items: [I('stock', 'Stock'), I('sport', 'Sport Skirts', 2600, 2), I('gt', 'GT Ground Effect', 5200, 5), I('wide', 'Extended Race Skirts', 9200, 9), I('carbon', 'Carbon Blades', 12800, 14, { dp: 60 })] },
  widebody: { group: 'Exterior', label: 'Widebody Kit', items: [I('stock', 'Factory Width'), I('mild', 'Mild Flares +40mm', 14000, 5, { fx: { grip: 0.015, weight: 14 } }), I('wide', 'Wide Flares +80mm', 26000, 9, { fx: { grip: 0.03, weight: 26 } }), I('extreme', 'Bolt-on Mega +130mm', 42000, 14, { dp: 120, fx: { grip: 0.045, weight: 40 } })] },
  spoiler: { group: 'Exterior', label: 'Spoiler / Wing', items: [I('stock', 'None / Stock'), I('lip', 'Trunk Lip', 1500, 1), I('ducktail', 'Ducktail', 3100, 3), I('gt', 'GT Wing (swan neck)', 6500, 6, { fx: { aero: 0.25, weight: 6 } }), I('wing', 'Big Track Wing', 9000, 8, { fx: { aero: 0.4, weight: 9 } }), I('drift', 'Mega Drift Wing', 15000, 7, { fx: { aero: 0.5, weight: 10 } }), I('carbonGt', 'Carbon GT Wing', 21000, 15, { dp: 150, fx: { aero: 0.55, weight: -2 } })] },
  hood: { group: 'Exterior', label: 'Hood', items: [I('stock', 'Stock'), I('vented', 'Vented', 3800, 3), I('scoop', 'Power Scoop', 5200, 5), I('bulge', 'Cowl Bulge', 5800, 7), I('carbon', 'Full Carbon', 8800, 9, { fx: { weight: -14 } }), I('pins', 'Race Hood + Pins', 11000, 12, { fx: { weight: -16 }, dp: 70 })] },
  fenders: { group: 'Exterior', label: 'Fenders', items: [I('stock', 'Stock'), I('vents', 'Vented Fenders', 3200, 3), I('louver', 'Louvered', 4200, 5), I('rivet', 'Rivet Overfenders', 6800, 8)] },
  mirrors: { group: 'Exterior', label: 'Mirrors', items: [I('stock', 'Stock'), I('sport', 'Racing Mirrors', 1200, 1), I('slim', 'Slim Bullet', 1800, 3), I('fender', 'Fender Mirrors', 2400, 4), I('carbon', 'Carbon Aero', 3600, 8)] },
};

export const WHEEL_DESIGNS = [
  I('te6', 'Volk TE37 6-spoke', 3200, 1, { sp: 6, w: 0.19, taper: 0.55, dish: 0.0, lipw: 0.012 }),
  I('ce10', 'Volk CE28 10-spoke', 3600, 2, { sp: 10, w: 0.11, taper: 0.5, dish: 0.0, lipw: 0.012 }),
  I('meister', 'Work Meister Deep Dish', 5200, 4, { sp: 5, w: 0.22, taper: 0.3, dish: 0.07, lipw: 0.03 }),
  I('mesh', 'BBS Mesh', 4800, 3, { sp: 24, w: 0.045, taper: 1.0, dish: 0.03, lipw: 0.02, mesh: true }),
  I('turbine', 'Turbine Fan', 4400, 5, { sp: 14, w: 0.15, taper: 0.8, dish: 0.02, lipw: 0.015, twist: 0.55 }),
  I('ssr', 'SSR Split 12', 4100, 6, { sp: 12, w: 0.07, taper: 0.4, dish: 0.025, lipw: 0.018, split: true }),
  I('rpf', 'Enkei RPF1 10', 2600, 1, { sp: 10, w: 0.14, taper: 0.7, dish: 0.0, lipw: 0.01 }),
  I('rg', 'Advan RG Twin 5', 4600, 7, { sp: 5, w: 0.1, taper: 0.5, dish: 0.0, lipw: 0.012, split: true }),
  I('steel', 'Steelie (steel)', 600, 1, { sp: 8, w: 0.12, taper: 1, dish: 0.0, lipw: 0.01, disc: true }),
  I('star', 'Starburst 8', 3900, 9, { sp: 8, w: 0.12, taper: 0.35, dish: 0.04, lipw: 0.025, twist: -0.25 }),
  I('blade', 'Forged Blade 7', 7800, 12, { sp: 7, w: 0.13, taper: 0.45, dish: 0.0, lipw: 0.01, twist: 0.2, dp: 60 }),
  I('vortex', 'Vortex Aero 5', 9600, 16, { sp: 5, w: 0.27, taper: 0.2, dish: 0.0, lipw: 0.012, disc: true, dp: 120 }),
];
export const TIRES = [
  I('stock', 'Comfort', 0, 1, { grip: 1.0, slide: 1.0, ph: 0.55, smoke: 1.0 }),
  I('sport', 'Sport', 900, 1, { grip: 1.07, slide: 1.0, ph: 0.5, smoke: 1.0 }),
  I('drift', 'Drift Tyre', 1400, 2, { grip: 0.97, slide: 1.18, ph: 0.47, smoke: 1.5 }),
  I('stretch', 'Stretched', 1100, 3, { grip: 0.93, slide: 1.12, ph: 0.38, smoke: 1.3 }),
  I('semi', 'Semi-Slick', 2600, 6, { grip: 1.17, slide: 0.95, ph: 0.45, smoke: 0.9 }),
  I('slick', 'Race Slick', 4200, 11, { grip: 1.28, slide: 0.88, ph: 0.42, smoke: 0.7 }),
  I('smoke', 'Smoke Show', 5000, 8, { grip: 0.96, slide: 1.2, ph: 0.5, smoke: 2.4, dp: 50 }),
];
export const FINISHES = [
  I('gloss', 'Gloss', 0, 1, { metal: 0.15, rough: 0.28, cc: 1.0, ccr: 0.03 }),
  I('metallic', 'Metallic', 800, 1, { metal: 0.75, rough: 0.32, cc: 1.0, ccr: 0.04 }),
  I('pearl', 'Pearl', 2600, 4, { metal: 0.5, rough: 0.35, cc: 1.0, ccr: 0.02, irid: 1 }),
  I('candy', 'Candy', 3200, 6, { metal: 0.9, rough: 0.2, cc: 1.0, ccr: 0.01 }),
  I('satin', 'Satin', 1200, 3, { metal: 0.3, rough: 0.5, cc: 0.4, ccr: 0.25 }),
  I('matte', 'Matte', 1500, 2, { metal: 0.05, rough: 0.88, cc: 0.0, ccr: 0.5 }),
  I('chrome', 'Chrome', 6500, 9, { metal: 1.0, rough: 0.04, cc: 0.0, ccr: 0.0, chrome: true }),
  I('flip', 'Color-Shift', 7500, 12, { metal: 0.8, rough: 0.2, cc: 1, ccr: 0.01, irid: 2, dp: 80 }),
];
export const LIVERIES = [
  I('none', 'Plain'), I('racing', 'Racing Stripes', 1800, 1), I('split', 'Panda Split', 2400, 2), I('speed', 'Speed Lines', 2600, 3), I('flames', 'Old-School Flames', 3200, 4),
  I('samurai', 'Samurai Ink', 5200, 6, { dp: 40 }), I('sakura', 'Sakura Fall', 4400, 5), I('wave', 'Great Wave', 4800, 7), I('checker', 'Checker Flag', 3000, 4),
  I('grid', 'Neon Grid', 5600, 9), I('hex', 'Carbon Hex', 6200, 10), I('camo', 'Street Camo', 3600, 5), I('tiger', 'Tiger Stripes', 4800, 8), I('fade', 'Night Fade', 3800, 6),
  I('oni', 'Oni Mask', 8800, 14, { dp: 100 }), I('rising', 'Rising Sun', 4200, 8),
];
export const STICKERS = [
  I('slide', 'SLIDE Logo', 300, 1), I('hashiriya', '走り屋', 400, 1), I('torii', '鳥居 Gate', 600, 3), I('driftking', 'DRIFT KING', 500, 2), I('tokyo', 'TOKYO', 400, 1),
  I('touge', '峠 Touge', 500, 3), I('star', 'Star', 300, 1), I('skull', 'Skull', 700, 4), I('bolt', 'Lightning', 500, 2), I('flag', 'Checker Flag', 400, 2),
  I('sun', 'Rising Sun', 500, 2), I('num13', 'Race No. 13', 400, 1), I('nitro', 'NITRO', 600, 3), I('kyoto', '魂 Spirit', 900, 6), I('sponsor', 'Sponsor Pack', 1200, 5), I('donut', 'Donut Club', 700, 4, { dp: 20 }),
];
export const STICKER_SLOTS = ['door', 'fender', 'quarter', 'hood'];
export const HEADLIGHTS = [I('#fff6e0', 'Halogen', 0, 1), I('#ffffff', 'Xenon White', 600, 1), I('#bfe6ff', 'Ice Blue', 800, 2), I('#ffd54a', 'Selective Yellow', 800, 2), I('#ff9f43', 'Amber', 900, 3), I('#ff3b3b', 'Red', 1200, 5), I('#b86bff', 'Purple', 1200, 5), I('#59ff9a', 'Toxic Green', 1200, 6)];
export const UNDERGLOW = [I('off', 'Off', 0, 1), I('#ff1d3d', 'Red', 1500, 1), I('#1d8bff', 'Blue', 1500, 1), I('#00f0ff', 'Cyan', 1500, 2), I('#a24bff', 'Purple', 1500, 2), I('#39ff6a', 'Green', 1500, 3), I('#ff8a00', 'Orange', 1500, 3), I('#ffffff', 'White', 1500, 3), I('rainbow', 'Rainbow Cycle', 4000, 10, { dp: 90 })];
export const FLAMES = [I('none', 'None', 0, 1), I('pops', 'Backfire Pops', 1800, 3), I('big', 'Big Flames', 4200, 8), I('blue', 'Blue Flames', 6000, 12, { dp: 60 })];
export const PLATES = ['SLIDE 01', 'S13 K1D', 'DRIFTER', 'TOUGE', 'SIDEWAYS'];

// ---------------- performance upgrades (per car, levels 0..n)
export const PERF = {
  engine: { label: 'Engine', desc: 'Cams, pistons, internals', lv: [
    { name: 'Stock', price: 0, lvl: 1, fx: {} }, { name: 'Street', price: 3200, lvl: 2, fx: { power: 0.08, weight: 4 } }, { name: 'Sport', price: 8500, lvl: 4, fx: { power: 0.18, weight: 8 } },
    { name: 'Race', price: 19000, lvl: 8, fx: { power: 0.32, weight: 12 } }, { name: 'Pro Build', price: 42000, lvl: 13, fx: { power: 0.46, weight: 14 } }, { name: 'Full Forged', price: 85000, lvl: 18, dp: 150, fx: { power: 0.62, weight: 16 } }] },
  turbo: { label: 'Turbo', desc: 'More boost, more power high-up', lv: [
    { name: 'None / Stock', price: 0, lvl: 1, fx: {} }, { name: 'Small Turbo', price: 4500, lvl: 3, fx: { power: 0.10, lag: 0.25 } }, { name: 'Medium Turbo', price: 11000, lvl: 6, fx: { power: 0.20, lag: 0.45 } },
    { name: 'Big Single', price: 24000, lvl: 10, fx: { power: 0.32, lag: 0.8 } }, { name: 'Twin Turbo', price: 48000, lvl: 15, fx: { power: 0.44, lag: 0.55 } }] },
  ecu: { label: 'ECU Tuning', desc: 'Fuel & ignition maps, higher redline', lv: [
    { name: 'Stock', price: 0, lvl: 1, fx: {} }, { name: 'Stage 1 Map', price: 1800, lvl: 2, fx: { power: 0.05, redline: 200 } }, { name: 'Stage 2 Map', price: 5200, lvl: 5, fx: { power: 0.09, redline: 400 } }, { name: 'Standalone', price: 12000, lvl: 9, fx: { power: 0.14, redline: 600, response: 0.15 } }] },
  exhaust: { label: 'Exhaust', desc: 'Flow and sound', lv: [
    { name: 'Stock', price: 0, lvl: 1, fx: {} }, { name: 'Cat-back', price: 1600, lvl: 2, fx: { power: 0.03 } }, { name: 'Sport Header', price: 4200, lvl: 5, fx: { power: 0.06 } }, { name: 'Straight Pipe', price: 7800, lvl: 9, fx: { power: 0.09, weight: -8 } }] },
  suspension: { label: 'Suspension', desc: 'Ride height, damping, roll', lv: [
    { name: 'Stock', price: 0, lvl: 1, fx: {} }, { name: 'Sport Springs', price: 1800, lvl: 2, fx: { drop: 0.02, grip: 0.015, roll: 0.8 } }, { name: 'Coilovers', price: 5600, lvl: 5, fx: { drop: 0.04, grip: 0.03, roll: 0.55 } },
    { name: 'Drift Coilovers', price: 11500, lvl: 9, fx: { drop: 0.05, grip: 0.035, roll: 0.5, steer: 3 } }, { name: 'Air Ride', price: 19000, lvl: 12, fx: { drop: 0.075, grip: 0.02, roll: 0.45 } }] },
  steering: { label: 'Steering Angle', desc: 'Angle kit & knuckles', lv: [
    { name: 'Stock', price: 0, lvl: 1, fx: {} }, { name: 'Angle Kit', price: 4000, lvl: 3, fx: { steer: 6 } }, { name: 'Wide-Angle', price: 9500, lvl: 7, fx: { steer: 12 } }, { name: 'Drift Knuckles', price: 20000, lvl: 11, fx: { steer: 18 } }] },
  brakes: { label: 'Brakes', desc: 'Pads, discs, calipers', lv: [
    { name: 'Stock', price: 0, lvl: 1, fx: {} }, { name: 'Sport Pads', price: 1400, lvl: 2, fx: { brake: 0.2 } }, { name: 'Big Brake Kit', price: 6200, lvl: 6, fx: { brake: 0.45 } }, { name: 'Race Carbon', price: 14000, lvl: 11, fx: { brake: 0.75 } }] },
  trans: { label: 'Transmission', desc: 'Ratios & shift speed', lv: [
    { name: 'Stock', price: 0, lvl: 1, fx: {} }, { name: 'Short Final', price: 2800, lvl: 3, fx: { final: 1.06 } }, { name: 'Close-Ratio', price: 8200, lvl: 7, fx: { final: 1.09, shift: 0.7 } }, { name: 'Sequential', price: 18500, lvl: 12, fx: { final: 1.12, shift: 0.35 } }] },
  diff: { label: 'Differential', desc: 'Rear lock — key for drifting', lv: [
    { name: 'Open', price: 0, lvl: 1, fx: { lock: 0.0 } }, { name: '1.5-Way LSD', price: 3200, lvl: 2, fx: { lock: 0.45 } }, { name: '2-Way Drift LSD', price: 7400, lvl: 6, fx: { lock: 0.75 } }, { name: 'Welded', price: 1200, lvl: 3, fx: { lock: 1.0, grip: -0.02 } }] },
};
export const PERF_KEYS = Object.keys(PERF);

export const itemOf = (list, id) => list.find(i => i.id === id) || list[0];
export const defaultCfg = (car) => ({
  paint: { color: car.color, finish: car.metal === 'metallic' ? 'metallic' : 'gloss', color2: car.twoTone || '#111214', two: !!car.twoTone, twoMode: 'roof' },
  livery: { id: 'none', c1: '#ffffff', c2: '#e63946', c3: '#111111' },
  stickers: [], plate: 'SLIDE 01',
  parts: { fbumper: 'stock', rbumper: 'stock', skirts: 'stock', widebody: 'stock', spoiler: 'stock', hood: 'stock', fenders: 'stock', mirrors: 'stock' },
  wheels: { design: 'rpf', size: 17, color: '#1a1a1c', finish: 'gloss', lip: '#c9ccd1', offF: 0, offR: 0, camF: -1.5, camR: -1.5, widthF: 0, widthR: 0, tire: 'stock', brake: '#c8102e' },
  look: { tint: 2, head: '#fff6e0', glow: 'off', flames: 'none' },
  perf: { engine: 0, turbo: 0, ecu: 0, exhaust: 0, suspension: 0, steering: 0, brakes: 0, trans: 0, diff: 0 },
  tune: { gripBal: 0, assist: 0.5, brakeBias: 0.5, sens: 0.5 },
});

// Combined handling stats of a car with its parts/perf. Used by the garage stat bars AND the physics, so bars = real handling.
export function computeStats(car, cfg) {
  const s = { power: car.hp, weight: car.weight, grip: car.grip, steer: car.steer, brake: car.brake, redline: car.redline, aero: 0, drop: 0, roll: 1, final: 1, shift: 1, lock: 0, lag: 0, response: 0, driftBias: car.driftBias };
  let pm = 1, gm = 0;
  for (const k of PERF_KEYS) { const lv = PERF[k].lv[cfg.perf[k] || 0].fx || {}; if (lv.power) pm += lv.power; if (lv.weight) s.weight += lv.weight; if (lv.grip) gm += lv.grip; if (lv.steer) s.steer += lv.steer; if (lv.brake) s.brake += lv.brake; if (lv.redline) s.redline += lv.redline; if (lv.final) s.final *= lv.final; if (lv.shift) s.shift = lv.shift; if (lv.lock !== undefined && k === 'diff') s.lock = lv.lock; if (lv.drop) s.drop += lv.drop; if (lv.roll) s.roll = lv.roll; if (lv.lag) s.lag = lv.lag; if (lv.response) s.response += lv.response; }
  for (const [cat, id] of Object.entries(cfg.parts)) { const it = (PART_CATS[cat].items.find(i => i.id === id)); if (it && it.fx) { if (it.fx.grip) gm += it.fx.grip; if (it.fx.aero) s.aero += it.fx.aero; if (it.fx.weight) s.weight += it.fx.weight; } }
  const tire = itemOf(TIRES, cfg.wheels.tire);
  s.power *= pm; s.grip = (s.grip + gm) * tire.grip; s.slide = tire.slide; s.smoke = tire.smoke; s.tireId = tire.id;
  // wheel size: bigger wheels = slightly more grip & weight, smaller = more sidewall
  const sz = cfg.wheels.size; s.grip *= 1 + (sz - 17) * 0.004; s.weight += (sz - 17) * 3;
  s.gripBal = cfg.tune.gripBal;
  s.topKmh = Math.round(Math.min(380, Math.max(100, 140 + Math.pow(s.power / s.weight * 1000, 0.5) * 10.2 * (1 - s.aero * 0.01) + (s.final - 1) * -20)));
  s.accel = s.power / s.weight * 1000; // hp per tonne
  return s;
}
// bar values 0..100 for garage UI
export function statBars(car, cfg) {
  const s = computeStats(car, cfg);
  const clamp = v => Math.max(4, Math.min(100, v));
  return { Power: clamp((s.power - 100) / 8), Accel: clamp(s.accel / 6.5), 'Top Speed': clamp((s.topKmh - 150) / 2.2), Grip: clamp((s.grip - 0.85) * 220), Steering: clamp((s.steer - 28) * 4.2 + 10), Brakes: clamp(s.brake * 45), 'Drift Control': clamp(100 - (s.driftBias - 0.7) * 120 + s.lock * 12), Weight: clamp(100 - (s.weight - 900) / 12) };
}
export function cfgValue(car, cfg, owned) { // rough sell/ratings
  let v = car.price; for (const k of PERF_KEYS) for (let i = 1; i <= cfg.perf[k]; i++) v += PERF[k].lv[i].price; return v;
}
