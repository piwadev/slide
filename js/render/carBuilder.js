// Procedural car model: lofted glossy body (paint + glass), wheel arches carved in the loft, widebody flares, bumpers, spoilers, hoods,
// mirrors, interior, lights, plates, underglow, wheels with suspension/steer/camber. Fully driven by car data + customisation cfg.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { itemOf, FINISHES, computeStats } from '../data/parts.js';
import { paintCanvas, platePng, carbonCanvas, TEX_W, TEX_H } from './liveries.js';
import { buildWheel, buildCaliper } from './wheels.js';

const TR = [0, 0.03, 0.07, 0.14, 0.24, 0.31, 0.35, 0.39, 0.43, 0.47, 0.5]; const NH = 11; const crown = (a, yc, ys) => yc + (ys - yc) * Math.pow(Math.min(1, a / 0.86), 2);            // ring t-values (right half, bottom centre -> top centre)
const cosI = (pts, s) => { // cosine interpolation of [[s,y]...]
  if (s <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (s <= pts[i][0]) { const a = pts[i - 1], b = pts[i], u = (s - a[0]) / (b[0] - a[0] || 1), k = (1 - Math.cos(u * Math.PI)) / 2; return a[1] + (b[1] - a[1]) * k; } return pts[pts.length - 1][1];
};
const linI = (pts, s) => { if (s <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (s <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (s - a[0]) / (b[0] - a[0] || 1); } return pts[pts.length - 1][1]; };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const DARK = () => new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.6, metalness: 0.2 });

export class CarModel {
  constructor(car, cfg, opts = {}) {
    this.car = car; this.cfg = cfg; this.low = !!opts.low; this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    this.wheelsG = new THREE.Group(); this.root.add(this.wheelsG); this.matBag = []; this.texBag = [];
    this.geom = this.makeProfile(); this.wheels = []; this.rebuild(cfg);
  }
  // ------------------------------------------------------------ profile (shared by body, hood, spoiler placement)
  makeProfile() {
    const c = this.car, L = c.L, W = c.W; const halfL = L / 2;
    const zOf = s => halfL - s * L;
    const wzF = halfL - (L - c.wb) * c.ovF, wzR = wzF - c.wb; // wheel z positions
    const deck = [[0, c.noseY - 0.04], [0.035, c.noseY], [0.09, c.noseY + (c.hoodY - c.noseY) * 0.35], [c.sA, c.hoodY], [Math.min(0.92, c.sD), c.trunkY], [1, c.tailY]];
    const deckY = s => cosI(deck, s);
    const base = (s) => deckY(s);
    const roofPts = [[c.sA, 0], [c.sB, c.roofY], [c.sC, c.roofY], [c.sD, 0]];
    const roofRaw = s => (s <= c.sA || s >= c.sD) ? -1 : (s < c.sB ? deckY(c.sA) - 0.03 + (c.roofY - (deckY(c.sA) - 0.03)) * (s - c.sA) / (c.sB - c.sA) : s <= c.sC ? c.roofY : deckY(c.sD) + (c.roofY - deckY(c.sD)) * (c.sD - s) / (c.sD - c.sC));
    const roofY = s => { // smoothed
      const r = 0.018; let acc = 0, n = 0; for (let k = -4; k <= 4; k++) { const v = roofRaw(s + k * r / 4); acc += v < 0 ? (k < 0 ? deckY(c.sA) - 0.03 : deckY(c.sD) - 0.0) : v; n++; } return acc / n; };
    const archR = c.wr + 0.075, wy = c.wr;
    const archTop = (s, z0) => { const dz = zOf(s) - z0; return Math.abs(dz) < archR ? wy + Math.sqrt(archR * archR - dz * dz) : -1; };
    const fenderTop = (s, z0) => { const dz = zOf(s) - z0, rr = archR + 0.3; return Math.abs(dz) < rr ? wy + archR * Math.pow(Math.max(0, 1 - (dz / rr) * (dz / rr)), 0.9) + 0.07 : -1; };
    const nr = s => { const e = Math.min(s, 1 - s * 1.0); return e; };
    const station = (s) => {
      const sill = 0.17, e = Math.min(s, 1 - s); const nrnd = e < 0.05 ? Math.sqrt(Math.max(0, 1 - Math.pow(1 - e / 0.05, 2))) : 1;
      const noseLift = (1 - nrnd) * 0.07;
      let w = W / 2 * (0.93 + 0.07 * sstep(0.02, 0.16, s)) * (1 + c.hip * sstep(0.62, 0.8, s)) * (0.8 + 0.2 * nrnd);
      w *= 1 - 0.06 * sstep(0.9, 1, s);
      let y0 = sill + noseLift + 0.06 * sstep(0.93, 1, s);
      const aF = archTop(s, wzF), aR = archTop(s, wzR); y0 = Math.max(y0, aF, aR);
      const yc = deckY(s) - (1 - nrnd) * 0.07;
      let ys = Math.max(yc, fenderTop(s, wzF), fenderTop(s, wzR));
      ys = Math.max(ys, y0 + 0.14);
      const ycc = Math.max(yc, ys - 0.035, y0 + 0.1);
      return { s, z: zOf(s), w, y0, yc: ycc, ys: Math.max(ys, ycc), nrnd };
    };
    return { zOf, wzF, wzR, deckY, roofY, station, archR, wy, sill: 0.17 };
  }
  topY(s, x) { // body top surface height at s, lateral x (matches loft)
    const st = this.geom.station(s), ax = Math.abs(x) / st.w, h = st.ys - st.y0;
    if (ax <= 0.86) return crown(ax, st.yc, st.ys);
    const u = (ax - 0.86) / (0.985 - 0.86); return st.ys + (st.y0 + 0.92 * h - st.ys) * Math.min(1, u);
  }
  // ------------------------------------------------------------ materials
  mat(m) { this.matBag.push(m); return m; }
  paintMats() {
    const cfg = this.cfg, f = itemOf(FINISHES, cfg.paint.finish);
    if (!this.paintCv) this.paintCv = document.createElement('canvas');
    paintCanvas(cfg, this.car, this.paintCv);
    if (!this.paintTex) { this.paintTex = new THREE.CanvasTexture(this.paintCv); this.paintTex.colorSpace = THREE.SRGBColorSpace; this.paintTex.anisotropy = 8; }
    this.paintTex.needsUpdate = true;
    const mk = (map, color) => {
      const m = new THREE.MeshPhysicalMaterial({ color, map, metalness: f.metal, roughness: f.rough, clearcoat: f.cc, clearcoatRoughness: f.ccr, envMapIntensity: f.chrome ? 1.6 : 1.15 });
      if (f.irid) { m.iridescence = 1; m.iridescenceIOR = f.irid === 2 ? 2.2 : 1.6; m.iridescenceThicknessRange = f.irid === 2 ? [200, 700] : [100, 400]; }
      if (f.chrome) m.color.set('#e8ecf0'), m.map = null;
      return m;
    };
    this.paintMat = this.mat(mk(this.paintTex, 0xffffff));
    if (f.chrome) this.paintMat.map = null;
    // second colour (two-tone) material for roof / hood / spoiler
    const c2 = cfg.paint.two ? mk(null, new THREE.Color(cfg.paint.color2)) : this.paintMat; if (c2 !== this.paintMat) this.mat(c2);
    this.paint2Mat = c2;
    this.plainMat = this.mat(mk(null, new THREE.Color(cfg.paint.color))); if (f.chrome) this.plainMat.color.set('#e8ecf0');
    this.carbonMat = this.mat(new THREE.MeshPhysicalMaterial({ map: this.carbonTex(), color: 0xffffff, metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 }));
    this.blackMat = this.mat(new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.45, metalness: 0.3, envMapIntensity: 0.8 }));
    this.chromeMat = this.mat(new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.08, envMapIntensity: 1.5 }));
  }
  carbonTex() { if (!CarModel._carbon) { const t = new THREE.CanvasTexture(carbonCanvas()); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; CarModel._carbon = t; } return CarModel._carbon; }
  tintOpacity() { return [0.28, 0.45, 0.62, 0.76, 0.88, 0.97][this.cfg.look.tint || 0]; }
  glassMat() { return this.mat(new THREE.MeshPhysicalMaterial({ color: 0x0b1117, metalness: 0.2, roughness: 0.04, transparent: true, opacity: this.tintOpacity(), envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0, depthWrite: false, side: THREE.DoubleSide })); }
  hoodMat() { const id = this.cfg.parts.hood; if (id === 'carbon' || id === 'pins') return this.carbonMat; return this.cfg.paint.two && this.cfg.paint.twoMode !== 'roof' ? this.paint2Mat : (this.cfg.paint.two && this.cfg.paint.twoMode === 'hood' ? this.paint2Mat : this.paintMat); }

  // ------------------------------------------------------------ rebuild
  clearGroup(g) { while (g.children.length) { const o = g.children.pop(); o.traverse(n => { if (n.geometry) n.geometry.dispose(); }); } }
  rebuild(cfg) {
    this.cfg = cfg || this.cfg; this.disposeMats(); this.clearGroup(this.body); this.clearGroup(this.wheelsG);
    this.paintMats(); this.glass = this.glassMat();
    this.stats = computeStats(this.car, this.cfg);
    this.drop = this.stats.drop; this.flare = { stock: 0, mild: 0.04, wide: 0.08, extreme: 0.13 }[this.cfg.parts.widebody] || 0;
    this.buildBody(); this.buildDetails(); this.buildAttachments(); this.buildWheels(); this.applyRideHeight();
    this.applyLights(); this.setGlow(this.cfg.look.glow);
  }
  disposeMats() { for (const m of this.matBag) { m.dispose(); } this.matBag.length = 0; }
  dispose() { this.disposeMats(); this.clearGroup(this.body); this.clearGroup(this.wheelsG); if (this.paintTex) this.paintTex.dispose(); }
  applyRideHeight() { this.body.position.y = -this.drop; this.baseY = -this.drop; }
  // fast paths
  updatePaint(cfg) { this.cfg = cfg || this.cfg; this.rebuild(this.cfg); }
  // ------------------------------------------------------------ lofted body
  buildBody() {
    const c = this.car, G = this.geom, N = this.low ? 70 : 130;
    const ss = []; for (let i = 0; i <= N; i++) ss.push(i / N); [0.003, 0.009, 0.018, 0.03, 0.97, 0.982, 0.991, 0.997].forEach(v => ss.push(v)); ss.sort((a, b) => a - b);
    const sts = ss.map(s => G.station(s));
    // ---- lower body
    const P = [], UV = [], IDX = []; const RING = NH * 2 - 1;
    for (const st of sts) {
      const w = st.w, y0 = st.y0, yc = st.yc, ys = st.ys, h = ys - y0;
      const half = [[0, y0], [0.62 * w, y0], [0.93 * w, y0 + 0.035], [w, y0 + 0.2 * h], [w, y0 + 0.7 * h], [0.985 * w, y0 + 0.92 * h], [0.86 * w, ys], [0.7 * w, crown(0.7, yc, ys)], [0.5 * w, crown(0.5, yc, ys)], [0.25 * w, crown(0.25, yc, ys)], [0, yc]];
      const u = st.s;
      for (let i = 0; i < NH; i++) { P.push(half[i][0], half[i][1], st.z); UV.push(u, TR[i]); }
      for (let i = NH - 2; i >= 0; i--) { P.push(-half[i][0], half[i][1], st.z); UV.push(u, 1 - TR[i]); }
    }
    for (let k = 0; k < sts.length - 1; k++) for (let i = 0; i < RING - 1; i++) { const a = k * RING + i, b = a + 1, c2 = a + RING, d = c2 + 1; IDX.push(a, c2, b, b, c2, d); }
    // caps (flat)
    const capVerts = (k, dir) => { const base = P.length / 3; const st = sts[k]; let cx = 0, cy = 0; for (let i = 0; i < RING; i++) { cy += P[(k * RING + i) * 3 + 1]; } cy /= RING; P.push(0, cy, st.z); UV.push(st.s, 0.5); for (let i = 0; i < RING; i++) { const j = (k * RING + i) * 3; P.push(P[j], P[j + 1], P[j + 2]); UV.push(st.s, i < NH ? TR[i] : 1 - TR[RING - 1 - i]); } for (let i = 0; i < RING - 1; i++) { if (dir > 0) IDX.push(base, base + 1 + i, base + 2 + i); else IDX.push(base, base + 2 + i, base + 1 + i); } };
    capVerts(0, -1); capVerts(sts.length - 1, 1);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); bg.setIndex(IDX); bg.computeVertexNormals();
    this.bodyGeo = bg; this.bodyPos0 = Float32Array.from(P);
    const body = new THREE.Mesh(bg, this.paintMat); body.castShadow = true; body.receiveShadow = true; this.bodyMesh = body; this.body.add(body);
    // ---- cabin
    const cs = sts.filter(st => st.s >= c.sA - 0.0001 && st.s <= c.sD + 0.0001);
    const cP = [], cUV = [], cPaint = [], cGlass = [], CR = 11; let cabinRows = 0;
    const sideGlass0 = c.sA + (c.sB - c.sA) * 0.55, sideGlass1 = c.tail === 'notch' ? c.sC + (c.sD - c.sC) * 0.5 : c.sC + (c.sD - c.sC) * 0.22;
    const bPillar = (c.doors || ([ 'jzx100', 'c63', 'hellcat'].includes(c.id) ? 4 : 2)) === 4;
    const cabRows = [];
    for (const st of cs) {
      const rY = G.roofY(st.s), base = st.ys - 0.05, hc = rY - base;
      const u = (st.s - c.sA) / (c.sD - c.sA), bell = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
      const cx = st.w * c.cabW * (0.88 + 0.12 * Math.pow(bell, 0.5)), cw = cx * (0.74 + 0.04 * bell);
      const hh = Math.max(0, hc);
      const belt = Math.min(0.045, 0.2 * hh);
      const half = [[cx, base], [cx * 0.995, base + belt], [cw + 0.03 * cx, rY - 0.075 * hh - 0.012], [cw, rY - 0.015 * hh], [cw * 0.6, rY + 0.003], [0, rY + 0.014]];
      const tt = [0.30, 0.335, 0.385, 0.405, 0.455, 0.5];
      const rowStart = cP.length / 3;
      for (let i = 0; i < 6; i++) { cP.push(half[i][0], half[i][1], st.z); cUV.push(st.s, tt[i]); }
      for (let i = 4; i >= 0; i--) { cP.push(-half[i][0], half[i][1], st.z); cUV.push(st.s, 1 - tt[i]); }
      cabRows.push({ s: st.s, hc });
    }
    for (let k = 0; k < cs.length - 1; k++) {
      const r0 = cabRows[k], r1 = cabRows[k + 1]; if (r0.hc < 0.004 && r1.hc < 0.004) continue;
      const sm = (r0.s + r1.s) / 2; const slope = Math.abs((G.roofY(r1.s) - G.roofY(r0.s)) / ((r1.s - r0.s) * c.L));
      for (let i = 0; i < CR - 1; i++) {
        const a = k * CR + i, b = a + 1, c2 = a + CR, d = c2 + 1; let glass = false;
        const seg = i < 5 ? i : 9 - i; // 0..4 mirrored (right 0-4, left 5-9 -> 4..0)
        if (seg === 1) { glass = sm > sideGlass0 && sm < sideGlass1; if (bPillar && Math.abs(sm - (c.sB + (c.sC - c.sB) * 0.55)) < 0.012) glass = false; if (c.tail !== 'notch' && sm > c.sC + 0.03) glass = glass && (sm < sideGlass1); }
        else if (seg === 3 || seg === 4) glass = slope > 0.2 && seg === 4 || (slope > 0.2 && seg === 3);
        // rows may be mirrored: ring has 11 points; segments i=0..9
        (glass ? cGlass : cPaint).push(a, c2, b, b, c2, d);
      }
    }
    // roof/belt paint uses two-tone material when enabled (roof only mode) else body paint
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cP, 3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(cUV, 2));
    cg.setIndex([...cPaint, ...cGlass]); cg.addGroup(0, cPaint.length, 0); cg.addGroup(cPaint.length, cGlass.length, 1); cg.computeVertexNormals();
    const roofMat = this.cfg.paint.two && this.cfg.paint.twoMode !== 'hood' ? this.paint2Mat : this.paintMat;
    const cab = new THREE.Mesh(cg, [roofMat, this.glass]); cab.castShadow = true; cab.renderOrder = 2; this.cabinMesh = cab; this.body.add(cab);
    this.cabinGlassMat = this.glass;
  }
  // ------------------------------------------------------------ details (lights, grille, doors, interior, plates)
  box(w, h, d, mat, x, y, z, parent = this.body, r = 0) {
    const m = new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = !this.low; parent.add(m); return m;
  }
  buildDetails() {
    const c = this.car, G = this.geom, L = c.L, W = c.W, b = this.body, z0 = L / 2;
    const st1 = G.station(0.03), stN = G.station(0.006), hy = c.noseY;
    const headCol = new THREE.Color(this.cfg.look.head);
    this.headMat = this.mat(new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: headCol, emissiveIntensity: 1.1, roughness: 0.1, metalness: 0.2 }));
    this.tailMat = this.mat(new THREE.MeshStandardMaterial({ color: 0x5a0008, emissive: 0xff1010, emissiveIntensity: 0.35, roughness: 0.2 }));
    const black = this.blackMat, lensGlass = this.mat(new THREE.MeshPhysicalMaterial({ color: 0xcfd8e0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.35, clearcoat: 1 }));
    const front = (s) => G.zOf(s);
    const surf = (s, x) => this.topY(s, x);
    // grille & intakes (dark) at nose
    const nw = st1.w;
    const grilleY = Math.max(st1.y0 + 0.07, hy - 0.2);
    if (c.nose !== 'slit') this.box(nw * 0.5, 0.1, 0.03, black, 0, grilleY, front(0.006) - 0.012, b, 0.01);
    this.box(nw * 1.05, 0.09, 0.03, black, 0, st1.y0 + 0.045, front(0.012) - 0.012, b, 0.01);
    // headlights per nose style
    const hx = nw * 0.66, hz = front(0.018);
    const addHead = (x, y, z, w, h, d, rot = 0) => { const m = this.box(w, h, d, this.headMat, x, y, z, b, 0.012); m.rotation.x = rot; return m; };
    const slope = Math.atan2(c.hoodY - c.noseY, c.L * 0.3) * 0.0;
    switch (c.nose) {
      case 'pop': for (const sx of [-1, 1]) { this.box(0.34, 0.012, 0.13, black, sx * hx * 0.78, surf(0.07, hx * 0.78) + 0.004, front(0.075), b, 0.004); addHead(sx * hx * 1.0, c.noseY - 0.1, hz - 0.012, 0.2, 0.06, 0.05); this.box(0.1, 0.035, 0.02, this.mat(new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8a00, emissiveIntensity: 0.6 })), sx * hx * 0.5, st1.y0 + 0.11, front(0.006) - 0.005, b); } break;
      case 'angular': for (const sx of [-1, 1]) { addHead(sx * hx, c.noseY - 0.03, hz - 0.004, 0.36, 0.11, 0.06, -0.15); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 16), lensGlass); l.rotation.x = Math.PI / 2; l.position.set(sx * (hx - 0.1), c.noseY - 0.03, hz + 0.02); b.add(l); this.box(0.3, 0.025, 0.04, black, sx * hx, c.noseY - 0.11, hz + 0.004, b); } break;
      case 'round': for (const sx of [-1, 1]) for (const k of (c.id === 'mustang' || c.id === 'challenger' ? [0.78, 1.22] : [1])) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 22), this.headMat); l.rotation.x = Math.PI / 2; l.position.set(sx * hx * k * 0.92, c.noseY - 0.1, hz - 0.012); b.add(l); const r = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.012, 8, 22), this.chromeMat); r.position.copy(l.position); r.position.z += 0.03; b.add(r); } break;
      case 'slit': for (const sx of [-1, 1]) { addHead(sx * nw * 0.58, c.noseY + 0.0, hz - 0.02, 0.36, 0.03, 0.05, -0.1); addHead(sx * nw * 0.5, c.noseY - 0.06, hz - 0.01, 0.2, 0.04, 0.04); this.box(0.34, 0.1, 0.03, black, sx * nw * 0.6, st1.y0 + 0.1, hz - 0.01, b, 0.01); } this.box(nw * 0.6, 0.16, 0.03, black, 0, st1.y0 + 0.09, front(0.003) - 0.012, b, 0.02); break;
      case 'wedge': for (const sx of [-1, 1]) { this.box(0.3, 0.012, 0.12, black, sx * hx * 0.8, surf(0.075, hx * 0.8) + 0.004, front(0.08), b, 0.004); addHead(sx * hx * 0.98, c.noseY - 0.07, hz - 0.01, 0.22, 0.065, 0.05); } break;
    }
    // tail lights
    const tz = -z0, ty = c.tailY;
    const tailY = G.deckY(0.985) - 0.1;
    for (const sx of [-1, 1]) { const tw = c.tail === 'hatch' ? 0.34 : 0.4; this.box(tw, 0.095, 0.05, this.tailMat, sx * G.station(0.99).w * 0.68, Math.max(tailY, 0.55), tz + 0.01, b, 0.012); }
    this.box(G.station(0.99).w * 0.8, 0.02, 0.04, this.tailMat, 0, Math.max(tailY, 0.55) + 0.03, tz + 0.012, b);
    // mirror shells/door handles are in paint texture; add front/rear plates
    this.plateTex = this.plateTex || new THREE.CanvasTexture(platePng(this.cfg.plate)); this.plateTex.image = platePng(this.cfg.plate); this.plateTex.needsUpdate = true;
    const pm = this.mat(new THREE.MeshStandardMaterial({ map: this.plateTex, roughness: 0.4 }));
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), pm); fp.position.set(0, st1.y0 + 0.13, front(0.002) + 0.0); fp.rotation.y = 0; b.add(fp);
    const rp = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), pm); rp.position.set(0, Math.max(0.5, G.deckY(0.992) - 0.2), tz - 0.003); rp.rotation.y = Math.PI; b.add(rp);
    // exhaust tips
    const ex = this.cfg.perf.exhaust; this.exhaustPos = [];
    const tipR = [0.032, 0.035, 0.04, 0.05][ex], tipX = c.cls === 'SUPER' ? 0.18 : 0.36;
    const tipPairs = c.cls === 'MUSCLE' || c.cls === 'EURO' ? [-1, 1] : (c.cls === 'SUPER' ? [-1, 1] : [1]);
    for (const sx of tipPairs) { const m = new THREE.Mesh(new THREE.CylinderGeometry(tipR, tipR * 0.92, 0.12, 14, 1, true), this.chromeMat); m.rotation.x = Math.PI / 2; m.position.set(sx * tipX * (tipPairs.length === 1 ? 1 : 1), 0.26, tz - 0.02); m.material.side = THREE.DoubleSide; b.add(m); const inner = new THREE.Mesh(new THREE.CircleGeometry(tipR * 0.9, 12), black); inner.position.set(m.position.x, 0.26, tz + 0.03); b.add(inner); this.exhaustPos.push(new THREE.Vector3(m.position.x, 0.26, tz - 0.08)); }
    // interior (visible through glass)
    if (!this.low) this.buildInterior();
  }
  buildInterior() {
    const c = this.car, G = this.geom, b = this.body, dark = this.mat(new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.8 })), red = this.mat(new THREE.MeshStandardMaterial({ color: 0x3a0f12, roughness: 0.7 }));
    const zA = G.zOf(c.sA + 0.02), zB = G.zOf(c.sB + (c.sC - c.sB) * 0.3), zC = G.zOf(c.sC);
    const yb = 0.46, w = G.station(c.sB).w * c.cabW * 0.85;
    this.box(w * 1.9, 0.18, 0.4, dark, 0, yb + 0.12, zA - 0.2, b, 0.03);
    for (const sx of [-1, 1]) { this.box(0.42, 0.12, 0.5, red, sx * w * 0.45, yb + 0.02, zB - 0.1, b, 0.04); const back = this.box(0.42, 0.52, 0.1, red, sx * w * 0.45, yb + 0.3, zB - 0.38, b, 0.05); back.rotation.x = -0.18; this.box(0.2, 0.15, 0.08, red, sx * w * 0.45, yb + 0.6, zB - 0.42, b, 0.03); }
    if (c.L > 4.2 && c.cls !== 'SUPER') this.box(w * 1.7, 0.12, 0.45, red, 0, yb + 0.02, zC + 0.5, b, 0.04);
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.017, 8, 20), dark); sw.position.set(-w * 0.45, yb + 0.32, zA - 0.38); sw.rotation.x = -0.9; b.add(sw);
    // roll cage hint for track builds
  }
  applyLights() {
    if (this.headMat) { this.headMat.emissive.set(this.cfg.look.head); }
    if (this.glass) { this.glass.opacity = this.tintOpacity(); }
  }
  // ------------------------------------------------------------ attachments (bumpers, skirts, flares, spoilers, hoods, mirrors, fenders)
  buildAttachments() {
    const c = this.car, G = this.geom, L = c.L, W = c.W, P = this.cfg.parts, b = this.body, paint = this.plainMat, black = this.blackMat, carbon = this.carbonMat;
    const st = s => G.station(s);
    const zF = L / 2, zR = -L / 2;
    // ---- front bumper kits
    const f0 = st(0.02), fy = f0.y0;
    const fb = P.fbumper;
    if (fb !== 'stock') {
      const wI = f0.w * 1.82, mat = fb === 'mesh' ? black : (fb === 'splitter' || fb === 'aggro' ? carbon : paint);
      const lipD = { lip: 0.07, splitter: 0.16, aggro: 0.2, wide: 0.17, mesh: 0.12 }[fb];
      this.box(wI * 0.96, 0.025, lipD, fb === 'lip' || fb === 'wide' ? paint : carbon, 0, fy - 0.005, zF - 0.02 + lipD * 0.4, b, 0.01);
      if (fb === 'aggro' || fb === 'wide') for (const sx of [-1, 1]) { const cn = this.box(0.16, 0.02, 0.1, carbon, sx * f0.w * 0.98, fy + 0.13, zF - 0.1, b); cn.rotation.z = sx * 0.35; }
      if (fb === 'wide' || fb === 'aggro') for (const sx of [-1, 1]) this.box(0.2, 0.09, 0.03, black, sx * f0.w * 0.62, fy + 0.07, zF + 0.002, b, 0.01);
      if (fb === 'mesh') this.box(wI * 0.6, 0.11, 0.04, black, 0, fy + 0.09, zF - 0.0, b);
      if (fb === 'wide') this.box(wI * 0.98, 0.06, 0.1, paint, 0, fy + 0.06, zF - 0.06, b, 0.025);
    }
    // ---- rear bumper
    const r0 = st(0.985), ry = r0.y0, rb = P.rbumper;
    if (rb !== 'stock') {
      const wI = r0.w * 1.7;
      this.box(wI, 0.1, 0.1, rb === 'duck' ? paint : carbon, 0, ry + 0.02, zR + 0.01, b, 0.02);
      if (rb === 'diffuser' || rb === 'race' || rb === 'aggro') { const dif = this.box(wI * 0.8, 0.012, 0.28, carbon, 0, ry + 0.07, zR + 0.04, b); dif.rotation.x = 0.28; for (let i = -3; i <= 3; i++) { const fin = this.box(0.012, 0.1, 0.24, carbon, i * wI * 0.1, ry + 0.07, zR + 0.05, b); fin.rotation.x = 0.28; } }
      if (rb === 'race') this.box(wI * 0.85, 0.02, 0.06, carbon, 0, ry - 0.015, zR - 0.1, b);
      if (rb === 'aggro') for (const sx of [-1, 1]) this.box(0.2, 0.1, 0.02, black, sx * r0.w * 0.82, ry + 0.17, zR - 0.01, b, 0.01);
    }
    // ---- side skirts
    const sk = P.skirts;
    if (sk !== 'stock') {
      const sz0 = G.wzF - G.archR - 0.04, sz1 = G.wzR + G.archR + 0.04, len = sz0 - sz1, zc = (sz0 + sz1) / 2, wMid = st(0.5).w;
      const th = { sport: 0.07, gt: 0.1, wide: 0.12, carbon: 0.08 }[sk], out = { sport: 0.03, gt: 0.06, wide: 0.08 + this.flare * 0.5, carbon: 0.05 }[sk];
      for (const sx of [-1, 1]) { const m = this.box(out + 0.04, th, len, sk === 'carbon' ? carbon : paint, sx * (wMid + out / 2 - 0.01), 0.17 + th / 2 - 0.02, zc, b, 0.02); if (sk === 'gt' || sk === 'wide') { const bl = this.box(0.03, 0.02, len * 0.97, carbon, sx * (wMid + out + 0.01), 0.17 - 0.005, zc, b); } }
    }
    // ---- widebody flares (extruded arch plates on each wheel)
    if (this.flare > 0 || P.fenders === 'rivet') this.buildFlares();
    // ---- spoiler
    this.buildSpoiler();
    // ---- hood
    this.buildHood();
    // ---- fenders (vents)
    this.buildFenders();
    // ---- mirrors
    this.buildMirrors();
  }
  buildFlares() {
    const G = this.geom, c = this.car, b = this.body, fl = this.flare || 0.012, rivet = this.cfg.parts.fenders === 'rivet';
    const ex = fl + (rivet && !this.flare ? 0.03 : 0), ar = G.archR;
    for (const [z0, ax] of [[G.wzF, 'F'], [G.wzR, 'R']]) {
      const sTop = this.geom.station(Math.min(0.98, Math.max(0.02, (c.L / 2 - z0) / c.L)));
            const R1 = ar + 0.015, R2 = ar + 0.1 + ex * 0.4, yB = 0.2, wy = G.wy; const sh = new THREE.Shape();
      sh.moveTo(R2, yB); sh.lineTo(R2, wy); sh.absarc(0, wy, R2, 0, Math.PI, false); sh.lineTo(-R2, yB); sh.lineTo(-R1, yB); sh.lineTo(-R1, wy); sh.absarc(0, wy, R1, Math.PI, 0, true); sh.lineTo(R1, yB); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: ex, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 24 });
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(geo, this.plainMat); m.castShadow = true;
        // shape XY -> (z, y), depth along +Z -> we need depth along +/-X: rotate about Y
        m.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; const wSide = this.geom.station(Math.min(0.98, Math.max(0.02, (c.L / 2 - z0) / c.L))).w;
        m.position.set(sx * (wSide - 0.025), 0, z0); b.add(m);
        // rotation.y = +90deg maps shape x -> -z ; we want shape x -> z: handle by scale
        if (rivet) { for (let i = 0; i < 12; i++) { const a = Math.PI * (0.05 + i / 11 * 0.9); const rv = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.01, 8), this.chromeMat); rv.rotation.z = Math.PI / 2; rv.position.set(sx * (wSide - 0.01 + ex + 0.02), G.wy + Math.sin(a) * (ar + 0.05), z0 + Math.cos(a) * (ar + 0.05)); b.add(rv); } }
      }
    }
  }
  buildSpoiler() {
    const c = this.car, G = this.geom, b = this.body, id = this.cfg.parts.spoiler; if (id === 'stock') return;
    const s0 = c.tail === 'hatch' ? 0.965 : 0.91, zS = G.zOf(s0), w = G.station(s0).w, yb = Math.max(this.topY(s0, 0), this.topY(s0, w * 0.5)) - 0.01;
    const mat = (id === 'carbonGt' || id === 'wing') ? this.carbonMat : (this.cfg.paint.two && this.cfg.paint.twoMode === 'spoiler' ? this.paint2Mat : this.plainMat);
    const plate = this.paint2Mat === this.plainMat ? this.blackMat : this.paint2Mat;
    const wingSpan = { lip: 0.8, ducktail: 0.86, gt: 0.86, wing: 0.95, drift: 1.12, carbonGt: 0.98 }[id] * w * 2;
    if (id === 'lip') { this.box(wingSpan, 0.035, 0.1, mat, 0, yb + 0.02, zS + 0.0, b, 0.012); return; }
    if (id === 'ducktail') { const d = this.box(wingSpan, 0.04, 0.2, mat, 0, yb + 0.05, zS + 0.04, b, 0.015); d.rotation.x = -0.35; return; }
    const hgt = { gt: 0.2, wing: 0.27, drift: 0.42, carbonGt: 0.3 }[id], chord = { gt: 0.28, wing: 0.34, drift: 0.46, carbonGt: 0.36 }[id], zW = zS - (id === 'drift' ? 0.15 : 0.05);
    const wing = this.box(wingSpan, 0.03, chord, mat, 0, yb + hgt, zW, b, 0.012); wing.rotation.x = id === 'drift' ? 0.12 : 0.09;
    if (id === 'carbonGt' || id === 'drift') { const fl2 = this.box(wingSpan * 0.97, 0.022, chord * 0.5, mat, 0, yb + hgt + 0.1, zW - 0.12, b, 0.01); fl2.rotation.x = 0.35; }
    if (id === 'drift') { const lip = this.box(wingSpan, 0.045, 0.05, mat, 0, yb + hgt + 0.025, zW - chord * 0.5, b, 0.01); lip.rotation.x = -0.4; }
    for (const sx of [-1, 1]) {
      this.box(0.014, hgt + 0.07, chord * (id === 'drift' ? 0.9 : 0.8), id === 'drift' ? mat : this.blackMat, sx * wingSpan * 0.5, yb + hgt * 0.5 + 0.02, zW, b, 0.005); // end plate
      const stand = this.box(0.03, hgt + 0.02, 0.07, this.blackMat, sx * wingSpan * (id === 'drift' ? 0.3 : 0.26), yb + hgt * 0.5, zW + 0.04, b, 0.008); stand.rotation.x = id === 'gt' ? 0.4 : 0.12;
      if (id === 'gt' || id === 'carbonGt') { const sw = this.box(0.03, hgt * 0.7, 0.05, this.blackMat, sx * wingSpan * 0.26, yb + hgt * 0.35, zW + 0.1, b, 0.008); sw.rotation.x = -0.3; }
    }
  }
  buildHood() {
    const c = this.car, G = this.geom, b = this.body, id = this.cfg.parts.hood, mat = this.hoodMat();
    const s0 = 0.045, s1 = c.sA + 0.012, N = this.low ? 12 : 26, xs = [-0.72, -0.5, -0.25, 0, 0.25, 0.5, 0.72];
    const P = [], UV = [], IDX = []; const R = xs.length;
    for (let k = 0; k <= N; k++) { const s = s0 + (s1 - s0) * k / N, st = G.station(s); for (let j = 0; j < R; j++) { const x = xs[j] * st.w; let bump = 0; if (id === 'bulge') bump = 0.045 * Math.exp(-Math.pow(xs[j] / 0.28, 2)) * Math.sin(Math.PI * Math.min(1, k / N)); P.push(x, this.topY(s, x) + 0.006 + bump, st.z); if (mat === this.carbonMat) UV.push(st.z * 1.3, x * 1.3); else UV.push(s, 0.5 + xs[j] * 0.14); } }
    for (let k = 0; k < N; k++) for (let j = 0; j < R - 1; j++) { const a = k * R + j, bI = a + 1, c2 = a + R, d = c2 + 1; IDX.push(a, bI, c2, bI, d, c2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(IDX); g.computeVertexNormals();
    const h = new THREE.Mesh(g, mat); h.castShadow = true; b.add(h); this.hoodMesh = h;
    const sm = (s) => G.zOf(s), top = (s, x = 0) => this.topY(s, x) + 0.008, w = G.station(0.15).w;
    if (id === 'vented' || id === 'pins') for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { const v = this.box(0.18, 0.012, 0.025, this.blackMat, sx * w * 0.42, top(0.17 + i * 0.022, w * 0.42) + 0.004, sm(0.17 + i * 0.022), b); v.rotation.x = -0.08; }
    if (id === 'scoop') { const sc = this.box(w * 0.7, 0.07, 0.4, mat, 0, top(0.18) + 0.03, sm(0.18), b, 0.02); sc.rotation.x = -0.14; this.box(w * 0.5, 0.04, 0.03, this.blackMat, 0, top(0.11) + 0.035, sm(0.108), b); }
    if (id === 'pins') for (const [sx, s] of [[-1, 0.09], [1, 0.09], [-1, 0.25], [1, 0.25]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 10), this.chromeMat); p.position.set(sx * w * 0.6, top(s, w * 0.6) + 0.006, sm(s)); b.add(p); }
    if (id === 'carbon') for (const sx of [-1, 1]) this.box(0.014, 0.004, 0.9, this.blackMat, sx * w * 0.02, top(0.17) + 0.003, sm(0.17), b);
  }
  buildFenders() {
    const id = this.cfg.parts.fenders, G = this.geom, b = this.body; if (id === 'stock' || id === 'rivet') return;
    const wz = G.wzF, st = this.geom.station(Math.min(0.98, Math.max(0.02, (this.car.L / 2 - wz) / this.car.L))), n = id === 'louver' ? 5 : 3;
    for (const sx of [-1, 1]) for (let i = 0; i < n; i++) { const z = wz - G.archR - 0.1 - i * 0.045; const s = (this.car.L / 2 - z) / this.car.L; const w = this.geom.station(s).w; const y = G.wy + G.archR * 0.6 + 0.1; const v = this.box(0.014 + this.flare, 0.12, 0.014, this.blackMat, sx * (w + 0.002 + this.flare * 0.5), y, z, b); v.rotation.z = sx * 0.1; }
    if (id === 'vents') for (const sx of [-1, 1]) this.box(0.01, 0.07, 0.25, this.blackMat, sx * (st.w + 0.002 + this.flare * 0.8), G.wy + G.archR + 0.0, wz + G.archR + 0.12 + 0.0, b);
  }
  buildMirrors() {
    const c = this.car, G = this.geom, id = this.cfg.parts.mirrors, b = this.body; const sB = c.sA + (c.sB - c.sA) * 0.1, w = G.station(sB).w * c.cabW;
    const fender = id === 'fender'; const sM = c.sA + 0.03, wM = G.station(sM).w; const x = fender ? wM * 0.0 + G.station(0.18).w * 0.8 : wM * c.cabW * 0.9 + 0.02, z = fender ? G.zOf(0.18) : G.zOf(sM), y = fender ? this.topY(0.18, x) + 0.04 : G.station(sM).ys + 0.06;
    const mat = id === 'carbon' || id === 'sport' ? this.carbonMat : this.plainMat;
    for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sx * x, y, z); b.add(g);
      const dims = { stock: [0.14, 0.09, 0.1], sport: [0.16, 0.08, 0.08], slim: [0.12, 0.055, 0.13], fender: [0.1, 0.07, 0.09], carbon: [0.17, 0.075, 0.1] }[id] || [0.14, 0.09, 0.1];
      const m = new THREE.Mesh(new RoundedBoxGeometry(dims[0], dims[1], dims[2], 3, 0.025), mat); m.position.x = sx * dims[0] * 0.5; m.castShadow = true; g.add(m);
      const glassP = new THREE.Mesh(new THREE.PlaneGeometry(dims[0] * 0.8, dims[1] * 0.75), this.chromeMat); glassP.position.set(sx * dims[0] * 0.5, 0, -dims[2] * 0.505); glassP.rotation.y = Math.PI; g.add(glassP);
      const stalk = this.box(0.08, 0.025, 0.04, this.blackMat, sx * -0.01, -0.03, 0.0, g); stalk.visible = !fender || true;
    }
  }
  // ------------------------------------------------------------ wheels
  buildWheels() {
    const c = this.car, G = this.geom, w = this.cfg.wheels, flare = this.flare; this.wheels = [];
    const trackHalf = c.track / 2 + flare * 0.6;
    const caliperLvl = this.cfg.perf.brakes;
    for (let i = 0; i < 4; i++) {
      const front = i < 2, left = i % 2 === 0, axle = front ? 'F' : 'R', sx = left ? -1 : 1;
      const wh = buildWheel(c, w, axle, this.low ? 'low' : 'high');
      const off = (axle === 'F' ? w.offF : w.offR) * 0.001, cam = (axle === 'F' ? w.camF : w.camR) * Math.PI / 180;
      const pivot = new THREE.Object3D(); pivot.position.set(sx * (trackHalf + off + 0.0), c.wr, front ? G.wzF : G.wzR); this.wheelsG.add(pivot);
      const camb = new THREE.Object3D(); pivot.add(camb); camb.rotation.z = sx * -cam * -1 * (-1); // negative camber: top inward
      camb.rotation.z = sx > 0 ? -cam : cam; // cam is negative => right wheel +, left -
      const inner = new THREE.Object3D(); camb.add(inner); if (left) inner.rotation.y = Math.PI; // face outward
      inner.add(wh.spin);
      const cal = buildCaliper(wh.rimR, w.brake, caliperLvl, wh.tw); inner.add(cal);
      // well liner (dark disc behind tyre, on body side)
      const liner = new THREE.Mesh(new THREE.CircleGeometry(G.archR + 0.02, 24, 0, Math.PI), this.blackMat); liner.rotation.y = left ? -Math.PI / 2 : Math.PI / 2; liner.position.set(sx * (trackHalf - wh.tw * 0.75), c.wr, pivot.position.z); this.wheelsG.add(liner); liner.position.y = c.wr;
      this.wheels.push({ pivot, camb, spin: wh.spin, front, left, tw: wh.tw, rimR: wh.rimR, R: wh.R, rimMat: wh.rimMat, liner });
    }
  }
  // ------------------------------------------------------------ underglow
  setGlow(g) {
    if (this.glowMesh) { this.root.remove(this.glowMesh); this.glowMesh.geometry.dispose(); this.glowMesh.material.dispose(); this.glowMesh = null; }
    this.glowRainbow = g === 'rainbow'; if (!g || g === 'off') return;
    if (!CarModel._glowTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); CarModel._glowTex = new THREE.CanvasTexture(cv); }
    const c = this.car, mat = new THREE.MeshBasicMaterial({ map: CarModel._glowTex, color: this.glowRainbow ? 0xff0000 : g, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1.0 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(c.W * 1.7 + this.flare, c.L * 1.25), mat); m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.renderOrder = 1; this.glowMesh = m; this.root.add(m);
    // visible neon tubes under the sills
    const tube = new THREE.MeshBasicMaterial({ color: this.glowRainbow ? 0xff0000 : g }); this.glowTube = tube;
    for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, c.wb * 0.8), tube); t.position.set(sx * (c.W / 2 - 0.02), 0.16 - this.drop, 0); m.add(t); t.position.set(sx * (c.W / 2 - 0.03), 0, 0.0); t.rotation.x = Math.PI / 2; t.position.y = 0; t.position.z = -0.14 + 0.0; }
    this.glowMat = mat;
  }
  tick(dt, t) { if (this.glowRainbow && this.glowMat) { const col = new THREE.Color().setHSL((t * 0.2) % 1, 1, 0.5); this.glowMat.color.copy(col); if (this.glowTube) this.glowTube.color.copy(col); } }
  // ------------------------------------------------------------ dynamic
  setBrake(on) { if (this.tailMat) { this.tailMat.emissiveIntensity = on ? 2.2 : 0.35; } }
  setWheelSteer(a) { for (const w of this.wheels) if (w.front) w.pivot.rotation.y = a; }
  spinWheels(dist) { for (const w of this.wheels) { w.spin.rotation.x -= (dist / w.R) * (w.left ? -1 : 1); } }
  setDamage(zones) { /* handled by deform() */ }
  deform(localPoint, amount) { // dent the body mesh near a local impact point
    const g = this.bodyGeo; if (!g) return; const pos = g.attributes.position; const r = 0.9; let ch = false;
    for (let i = 0; i < pos.count; i++) { const dx = pos.getX(i) - localPoint.x, dy = pos.getY(i) - 0.55 - localPoint.y * 0.0, dz = pos.getZ(i) - localPoint.z; const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5); if (d < r) { const k = (1 - d / r) * amount, nx = -Math.sign(localPoint.x || 0), nz = -Math.sign(localPoint.z || 0); const wob = (Math.sin(i * 12.9898) * 0.5 + 0.5); pos.setX(i, pos.getX(i) + (Math.abs(localPoint.x) > Math.abs(localPoint.z) * 0.5 ? nx * k * 0.35 : 0) * wob); pos.setZ(i, pos.getZ(i) + (Math.abs(localPoint.z) >= Math.abs(localPoint.x) * 0.5 ? nz * k * 0.45 : 0) * wob); pos.setY(i, pos.getY(i) - k * 0.05 * wob); ch = true; } }
    if (ch) { pos.needsUpdate = true; g.computeVertexNormals(); }
  }
  resetDamage() { if (this.bodyGeo && this.bodyPos0) { this.bodyGeo.attributes.position.array.set(this.bodyPos0); this.bodyGeo.attributes.position.needsUpdate = true; this.bodyGeo.computeVertexNormals(); } }
}
