// Map builders. Each returns a World: geometry group, path, collision segments/circles, surface/height queries, discoveries, zones, traffic hooks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, clamp, lerp, Path, roundedPath, splinePath, canvasTex, asphaltTex, windowTex, signTex, roadMesh, offsetLine, wallAlong, strip, instanced, mtx } from './kit.js';
import { MAPS } from '../data/maps.js';

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const stdMat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.05, ...o });
const emis = (c, i = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), toneMapped: false });

function noiseTex(base, var_, size = 256, rep = 40) {
  return canvasTex(size, size, (c, w, h) => { const R = rng(5); c.fillStyle = base; c.fillRect(0, 0, w, h); const id = c.getImageData(0, 0, w, h); for (let i = 0; i < id.data.length; i += 4) { const n = (R() - 0.5) * var_; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n * 0.8; } c.putImageData(id, 0, 0); for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(0,0,0,${R() * 0.07})`; c.beginPath(); c.arc(R() * w, R() * h, R() * 12, 0, 7); c.fill(); } }, { repeat: true });
}
function base(id, path, halfW) {
  const W = { id, group: new THREE.Group(), path, halfW, segs: [], circles: [], zones: [], discoveries: [], boxes: [], traffic: false, anim: [], size: 400 };
  W.heightAt = (x, z) => { const n = path.nearest(x, z, 3); return n ? n.y : 0; };
  W.surface = (x, z) => { const n = path.nearest(x, z, 3); if (!n) return { grip: 0.6, drag: 1, off: true }; if (Math.abs(n.d) <= halfW + 0.4) return { grip: 1, drag: 0, off: false, kind: 'road', s: n.s }; return W.offSurface; };
  W.offSurface = { grip: 0.7, drag: 1, off: true, kind: 'grass' };
  W.dispose = () => { W.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { ['map', 'emissiveMap'].forEach(k => m[k] && m[k].dispose()); m.dispose(); }); } }); };
  return W;
}
function apexZones(W, minK = 0.035) { // clipping points at tight corners
  const p = W.path; let last = -999; const pts = p.pts;
  for (let i = 0; i < p.n; i++) { const k = pts[i].k; if (Math.abs(k) < minK) continue; let isMax = true; for (let j = -10; j <= 10; j++) { const q = pts[(i + j + p.n) % p.n]; if (Math.abs(q.k) > Math.abs(k)) { isMax = false; break; } } if (isMax && Math.abs(pts[i].s - last) > 40) { last = pts[i].s; const inner = Math.sign(k); W.zones.push({ x: pts[i].x + pts[i].nx * inner * (W.halfW * 0.5), z: pts[i].z + pts[i].nz * inner * (W.halfW * 0.5), r: Math.max(6, W.halfW * 0.7), s: pts[i].s }); } }
}
function discover(W, list) { // list: [fraction, id, name]
  for (const [f, id, name] of list) { const q = W.path.at(f * W.path.length); W.discoveries.push({ id, name, x: q.x + q.nx * (W.halfW * 0.4), z: q.z + q.nz * (W.halfW * 0.4), r: 14, xp: 120 }); }
}
function addGround(W, size, mat, y = 0) { const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat); g.rotation.x = -Math.PI / 2; g.position.y = y; g.receiveShadow = true; W.group.add(g); return g; }
function scatter(W, count, seed, minDist, maxDist, fn) { // random positions near the path at distance [minDist,maxDist]
  const R = rng(seed), out = []; const b = W.path.bounds; let tries = 0;
  while (out.length < count && tries < count * 30) { tries++; const q = W.path.at(R() * W.path.length); const side = R() < 0.5 ? -1 : 1, d = lerp(minDist, maxDist, R()); const x = q.x + q.nx * side * d, z = q.z + q.nz * side * d; const nn = W.path.nearest(x, z, 4); if (nn && nn.dist < minDist * 0.92) continue; const r = fn(x, z, R, nn); if (r !== false) out.push(r); }
  return out;
}
const rep = (t, x, y) => { t.repeat.set(x, y); return t; };

// ============================================================================ TOKYO
function tokyo(ctx) {
  const ctrl = [[0, 0], [180, 0], [180, -110], [90, -110], [90, -40], [30, -40], [30, -170], [-120, -170], [-120, -60], [-190, -60], [-190, 90], [-60, 90], [-60, 30], [0, 30]];
  const path = roundedPath(ctrl, [22, 20, 20, 16, 16, 20, 22, 20, 18, 22, 24, 20, 16, 18], true, 2);
  const hw = 8; const W = base('tokyo', path, hw); W.spawn = { ...path.at(10), s: 10 }; W.traffic = true; W.size = 520;
  const g = W.group; W.offSurface = { grip: 0.85, drag: 0.4, off: true, kind: 'sidewalk' };
  addGround(W, 1400, stdMat('#16181d', { roughness: 0.9 }), -0.02);
  const tex = asphaltTex('#25262b', 2, 1.2); const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: ctx.tod === 'night' ? 0.34 : 0.7, metalness: ctx.tod === 'night' ? 0.15 : 0.05, envMapIntensity: ctx.tod === 'night' ? 1.4 : 0.8 });
  g.add(roadMesh(path, hw, mat, { vrep: 16 }));
  const sidew = stdMat('#7b7f86', { roughness: 0.85 });
  for (const side of [-1, 1]) g.add(strip(offsetLine(path, side * (hw + 2.2)), true, 4.4, sidew, 0.16, 6));
  const mats = { concrete: stdMat('#8a8f98'), rail: stdMat('#b8bec6', { metalness: 0.6, roughness: 0.4 }) };
  for (const side of [-1, 1]) { const w = wallAlong(offsetLine(path, side * (hw + 0.6)), true, 'rail', mats, { h: 0.55, th: 0.25 }); g.add(w.mesh); W.segs.push(...w.segs); }
  // outer walls (building line)
  for (const side of [-1, 1]) { const w = wallAlong(offsetLine(path, side * (hw + 4.4)), true, 'concrete', { concrete: stdMat('#2a2d34') }, { h: 0.6, th: 0.4 }); g.add(w.mesh); W.segs.push(...w.segs); }
  // buildings
  const R = rng(42), win = [windowTex(1), windowTex(2), windowTex(3)];
  const variants = []; for (let i = 0; i < 9; i++) { const w = 10 + R() * 12, d = 10 + R() * 12, h = 22 + R() * 70; const geo = new THREE.BoxGeometry(w, h, d); const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 4.2, uv.getY(k) * h / 3.6); const col = ['#5f6672', '#4b5260', '#6b6358', '#3c4350', '#57606e'][i % 5]; const m = new THREE.MeshStandardMaterial({ color: col, map: win[i % 3], emissive: 0xffffff, emissiveMap: win[i % 3], emissiveIntensity: ctx.tod === 'night' ? 0.62 : ctx.tod === 'dusk' ? 0.3 : 0.06, roughness: 0.55, metalness: 0.25 }); variants.push({ w, d, h, geo, m, list: [] }); }
  const place = [];
  for (let s = 0; s < path.length; s += 15 + R() * 16) for (const side of [-1, 1]) { const v = variants[Math.floor(R() * variants.length)]; const q = path.at(s); const off = hw + 6 + Math.max(v.w, v.d) * 0.5 + R() * 3; const x = q.x + q.nx * side * off, z = q.z + q.nz * side * off; const nn = path.nearest(x, z, 4); if (nn.dist < hw + 5.5 + Math.min(v.w, v.d) * 0.5) continue; if (place.some(p => Math.hypot(p.x - x, p.z - z) < 14)) continue; place.push({ x, z, v, ry: Math.atan2(q.tx, q.tz), side, q }); v.list.push(mtx(x, v.h / 2, z, Math.atan2(q.tx, q.tz))); }
  for (const v of variants) if (v.list.length) { const im = instanced(v.geo, v.m, v.list, { shadow: false }); g.add(im); }
  // neon signs on facades
  const signs = [['居酒屋', '#ff3d81', '#12040b'], ['ラーメン', '#ffd84a', '#150f02'], ['カラオケ', '#35e6ff', '#03131a'], ['ドリフト', '#ff8a2b', '#160a02'], ['スロット', '#b266ff', '#0d0416'], ['SLIDE', '#ff2d95', '#14040d'], ['薬局', '#6dff9b', '#03140a'], ['東京', '#ffffff', '#101114']];
  const stexs = signs.map(([t, fg, bg]) => signTex(t, fg, bg, 128, 480));
  const signMats = stexs.map(t => new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: ctx.tod === 'night' ? 0xffffff : 0x9a9a9a }));
  const plane = new THREE.PlaneGeometry(2.6, 9.6);
  place.forEach((p, i) => { if (i % 2) return; const m = new THREE.Mesh(plane, signMats[i % signMats.length]); const nx = -p.side * p.q.nx, nz = -p.side * p.q.nz; m.position.set(p.x + nx * (p.v.w / 2 + 0.2 + (Math.abs(p.q.tx) > 0.7 ? 0 : 0)) * 0.0 + p.q.nx * -p.side * (hw + 6.1 - (hw + 6 + Math.max(p.v.w, p.v.d) * 0.5)) * 0, 0, 0); const face = new THREE.Vector3(nx, 0, nz); const base0 = new THREE.Vector3(p.x, 6 + (i * 7 % 14), p.z).add(face.clone().multiplyScalar(Math.max(p.v.w, p.v.d) * 0.5 * 0.0 + p.v.w * 0.5 + 0.2)); m.position.copy(base0); m.lookAt(base0.clone().add(face)); g.add(m); });
  // lamps
  const lampGeo = mergeGeometries([new THREE.CylinderGeometry(0.1, 0.14, 9, 8).translate(0, 4.5, 0), new THREE.BoxGeometry(2.2, 0.15, 0.15).translate(1.0, 9, 0)]);
  const lampM = [], headM = [];
  for (let s = 0; s < path.length; s += 38) for (const side of [-1, 1]) { const q = path.at(s); const x = q.x + q.nx * side * (hw + 1.2), z = q.z + q.nz * side * (hw + 1.2); const ry = Math.atan2(q.tx, q.tz) + (side > 0 ? Math.PI / 2 : -Math.PI / 2); lampM.push(mtx(x, 0, z, ry)); headM.push(mtx(x + Math.sin(ry + Math.PI / 2) * 1.9 * 1, 8.9, z + Math.cos(ry + Math.PI / 2) * 1.9, 0)); }
  g.add(instanced(lampGeo, stdMat('#3a3d44', { metalness: 0.6 }), lampM)); g.add(instanced(new THREE.BoxGeometry(0.7, 0.12, 0.35), emis(ctx.tod === 'day' ? '#cccccc' : '#ffe2a8', ctx.tod === 'night' ? 3 : 1), headM));
  // crossings + vending machines
  const zeb = []; for (let s = 55; s < path.length; s += 180) { const q = path.at(s); for (let k = -6; k <= 6; k++) zeb.push(mtx(q.x + q.nx * k * 1.15, 0.045, q.z + q.nz * k * 1.15, Math.atan2(q.tx, q.tz))); }
  g.add(instanced(new THREE.BoxGeometry(0.55, 0.02, 3.2), emis('#d8d8d0', 0.55), zeb));
  const vend = []; const vcol = ['#19d3ff', '#ff2d95', '#ffd84a', '#6dff9b'];
  for (let s = 20; s < path.length; s += 61) for (const side of [-1, 1]) { const q = path.at(s + side * 9); vend.push(mtx(q.x + q.nx * side * (hw + 3.4), 0.9, q.z + q.nz * side * (hw + 3.4), Math.atan2(q.tx, q.tz))); }
  g.add(instanced(new THREE.BoxGeometry(0.9, 1.8, 0.8), emis('#35c8ff', 1.6), vend));
  // animated billboards
  const bb = canvasTex(256, 128, () => {}); bb.userData.t = 0; const bbm = new THREE.MeshBasicMaterial({ map: bb, toneMapped: false });
  const bbDraw = (t) => { const c = bb.image.getContext('2d'); const w = 256, h = 128; const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, `hsl(${(t * 40) % 360},90%,45%)`); gr.addColorStop(1, `hsl(${(t * 40 + 120) % 360},90%,40%)`); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 54px "Barlow Condensed",sans-serif'; c.textAlign = 'center'; c.fillText('SLIDE', w / 2, 62); c.font = 'bold 28px "Noto Sans CJK JP","Yu Gothic",sans-serif'; c.fillText('ドリフト王決定戦', w / 2, 104); bb.needsUpdate = true; };
  bbDraw(0); for (const f of [0.18, 0.5, 0.81]) { const q = path.at(f * path.length); const m = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), bbm); m.position.set(q.x + q.nx * (hw + 20), 22, q.z + q.nz * (hw + 20)); m.lookAt(q.x, 14, q.z); g.add(m); }
  let bt = 0; W.anim.push((dt, t) => { bt += dt; if (bt > 0.5 && ctx.tod !== 'day') { bt = 0; bbDraw(t); } });
  apexZones(W, 0.03); discover(W, [[0.17, 'shibuya', 'Shibuya Crossing'], [0.4, 'alley', 'Neon Alley'], [0.66, 'billboard', 'Rainbow Billboard'], [0.9, 'gate', 'Harajuku Gate']]);
  W.trafficLanes = [-3.2, 3.2]; W.trafficCount = 8; W.minimapColor = '#ff2d95';
  return W;
}

// ============================================================================ MOUNTAIN
function terrain(W, path, halfW, opts) {
  const b = path.bounds, M = opts.margin || 260; const x0 = b.x0 - M, x1 = b.x1 + M, z0 = b.z0 - M, z1 = b.z1 + M;
  const seg = opts.seg || 150, sx = (x1 - x0) / seg, sz = (z1 - z0) / seg; const nz = Math.floor(seg), P = [], IDX = [], UV = [];
  const R = rng(opts.seed || 3); const ph = [R() * 9, R() * 9, R() * 9];
  const noise = (x, z) => Math.sin(x * 0.011 + ph[0]) * Math.cos(z * 0.013 + ph[1]) + 0.5 * Math.sin(x * 0.031 + z * 0.027 + ph[2]) + 0.25 * Math.sin(x * 0.07 - z * 0.06);
  const hf = (x, z) => { const n = path.nearest(x, z, 5); if (!n) return opts.far || 0; const d = n.dist; const roadY = n.y; const t = sstep(halfW + 2.5, halfW + (opts.blend || 40), d); const side = n.d > 0 ? 1 : -1; return lerp(roadY - 0.06, roadY + (opts.relief(x, z, d, side, noise) || 0), t); };
  W.terrainH = hf;
  for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) { const x = x0 + i * sx, z = z0 + j * sz; P.push(x, hf(x, z), z); UV.push(x / 30, z / 30); }
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i; IDX.push(a, a + seg + 1, a + 1, a + 1, a + seg + 1, a + seg + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(IDX); g.computeVertexNormals();
  const m = new THREE.Mesh(g, opts.mat); m.receiveShadow = true; W.group.add(m); return m;
}
function mountain(ctx) {
  const ctrl = [[0, 0], [170, 20], [195, -60], [20, -78], [10, -158], [200, -150], [225, -235], [40, -250], [20, -330], [210, -330], [240, -420], [60, -430], [-40, -380], [-60, -250], [-60, -100]];
  const hfn = s => -0.06 * s * 0.5 + Math.sin(s * 0.004) * 4;
  const path = roundedPath(ctrl, [30, 13, 13, 14, 13, 13, 14, 13, 13, 13, 14, 15, 30, 30, 30], false, 2, hfn); const hw = 5.2;
  const W = base('mountain', path, hw); W.spawn = { ...path.at(8), s: 8 }; W.size = 500; const g = W.group; W.offSurface = { grip: 0.55, drag: 1.2, off: true, kind: 'grass' };
  const grass = noiseTex('#48553a', 26); rep(grass, 1, 1);
  terrain(W, path, hw, { seg: 170, seed: 8, blend: 45, mat: new THREE.MeshStandardMaterial({ map: grass, roughness: 1, color: '#7a8a66' }), relief: (x, z, d, side, n) => (side > 0 ? 1 : -0.5) * (d - hw) * 0.6 * (0.6 + 0.3 * n(x, z)) + n(x, z) * 6 });
  const tex = asphaltTex('#34353a', 2, 0.8); g.add(roadMesh(path, hw, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, envMapIntensity: 0.8 }), { vrep: 16, y: 0.03 }));
  const mats = { rail: stdMat('#c4c9cf', { metalness: 0.6, roughness: 0.35 }), concrete: stdMat('#999') };
  for (const side of [-1, 1]) { const w = wallAlong(offsetLine(path, side * (hw + 0.5)), false, 'rail', mats, { h: 0.55, th: 0.2 }); g.add(w.mesh); W.segs.push(...w.segs); }
  // rail posts
  const posts = []; for (const side of [-1, 1]) for (let i = 0; i < path.n; i += 3) { const p = path.pts[i]; posts.push(mtx(p.x + p.nx * side * (hw + 0.5), p.y, p.z + p.nz * side * (hw + 0.5))); }
  g.add(instanced(new THREE.BoxGeometry(0.12, 0.8, 0.12), stdMat('#777'), posts));
  // trees (instanced cones + trunks)
  const R = rng(9); const tm = [], trm = [];
  for (let i = 0; i < 1500; i++) { const q = path.at(R() * path.length); const side = R() < 0.5 ? -1 : 1, d = hw + 4 + R() * 80; const x = q.x + q.nx * side * d, z = q.z + q.nz * side * d; const nn = path.nearest(x, z, 4); if (nn.dist < hw + 3.5) continue; const y = W.terrainH(x, z); const s = 0.8 + R() * 1.6; tm.push(mtx(x, y + 3 * s, z, R() * 6, s, s * (1 + R() * 0.5), s)); trm.push(mtx(x, y + 0.8 * s, z, 0, s, s, s)); }
  g.add(instanced(new THREE.ConeGeometry(1.8, 7, 7), stdMat('#27421f', { roughness: 0.95 }), tm)); g.add(instanced(new THREE.CylinderGeometry(0.16, 0.22, 1.8, 5), stdMat('#3b2b1d'), trm));
  // distant mountains
  const mm = []; const bc = { x: (path.bounds.x0 + path.bounds.x1) / 2, z: (path.bounds.z0 + path.bounds.z1) / 2 };
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = 650 + R() * 200; mm.push(mtx(bc.x + Math.cos(a) * r, -40, bc.z + Math.sin(a) * r, 0, 1, 1, 1)); }
  const mg = new THREE.ConeGeometry(190, 330, 7); g.add(instanced(mg, stdMat('#2c3340', { roughness: 1 }), mm));
  // chevron signs at hairpins
  const ch = []; for (let i = 0; i < path.n; i += 4) { const p = path.pts[i]; if (Math.abs(p.k) > 0.05) { const side = p.k > 0 ? -1 : 1; ch.push(mtx(p.x + p.nx * side * (hw + 1.6), p.y + 1.1, p.z + p.nz * side * (hw + 1.6), Math.atan2(-p.tx * side, -p.tz * side))); } }
  g.add(instanced(new THREE.BoxGeometry(1.2, 0.8, 0.05), emis('#ffcf33', 0.9), ch));
  apexZones(W, 0.045); discover(W, [[0.2, 'lookout', 'Sunset Lookout'], [0.4, 'shrine', 'Roadside Shrine'], [0.62, 'tunnel', 'Old Tunnel Gate'], [0.85, 'tea', 'Tea House']]);
  W.pointToPoint = true; W.minimapColor = '#ff8a3d'; W.fogBoost = 0.7;
  return W;
}

// ============================================================================ INDUSTRIAL
function industrial(ctx) {
  const ctrl = [[-160, -100], [130, -100], [170, -50], [170, 50], [80, 100], [-20, 40], [-90, 100], [-170, 60], [-175, -30]];
  const path = roundedPath(ctrl, [34, 40, 30, 34, 40, 30, 34, 30, 34], true, 2); const hw = 13;
  const W = base('industrial', path, hw); W.spawn = { ...path.at(10), s: 10 }; W.size = 460; const g = W.group;
  const conc = noiseTex('#8b8d90', 30); rep(conc, 24, 24);
  const lotW = 440, lotH = 330, lcx = 0, lcz = 0;
  const gnd = addGround(W, 1400, stdMat('#3a3d3f'), -0.05);
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(lotW, lotH), new THREE.MeshStandardMaterial({ map: conc, roughness: 0.85, envMapIntensity: 0.6 })); lot.rotation.x = -Math.PI / 2; lot.position.set(lcx, 0.0, lcz); lot.receiveShadow = true; g.add(lot);
  // painted course on lot
  const paint = new THREE.MeshStandardMaterial({ map: asphaltTex('#4a4c50', 3, 0.5), roughness: 0.7 }); g.add(roadMesh(path, hw, paint, { vrep: 16, y: 0.015 }));
  W.surface = (x, z) => ({ grip: 1.0, drag: 0, off: false, kind: Math.abs(x) < lotW / 2 && Math.abs(z) < lotH / 2 ? 'road' : 'dirt', s: (path.nearest(x, z, 3) || { s: 0 }).s });
  W.inLot = (x, z) => Math.abs(x) < lotW / 2 - 4 && Math.abs(z) < lotH / 2 - 4;
  W.surface = (x, z) => { const inl = W.inLot(x, z); return { grip: inl ? 1.0 : 0.65, drag: inl ? 0 : 1, off: !inl, kind: inl ? 'road' : 'dirt', s: (path.nearest(x, z, 3) || { s: 0 }).s }; };
  // perimeter wall
  const wl = [{ x: -lotW / 2, z: -lotH / 2, y: 0 }, { x: lotW / 2, z: -lotH / 2, y: 0 }, { x: lotW / 2, z: lotH / 2, y: 0 }, { x: -lotW / 2, z: lotH / 2, y: 0 }];
  const wm = { concrete: stdMat('#a6a9ad') }; const pw = wallAlong(wl, true, 'concrete', wm, { h: 1.2, th: 0.7 }); g.add(pw.mesh); W.segs.push(...pw.segs);
  // warehouses outside perimeter
  const R = rng(21); const wh = [];
  for (let i = 0; i < 14; i++) { const side = i % 4, t = (Math.floor(i / 4) + 0.5) / 4; const w = 60 + R() * 50, h = 12 + R() * 10, d = 40; let x, z; if (side === 0) { x = -lotW / 2 + t * lotW + (R() - 0.5) * 20; z = -lotH / 2 - 30; } else if (side === 1) { x = -lotW / 2 + t * lotW; z = lotH / 2 + 30; } else if (side === 2) { x = -lotW / 2 - 30; z = -lotH / 2 + t * lotH; } else { x = lotW / 2 + 30; z = -lotH / 2 + t * lotH; } const geo = new THREE.BoxGeometry(side < 2 ? w : d, h, side < 2 ? d : w); const m = new THREE.Mesh(geo, stdMat(['#6b7f8f', '#8a8f94', '#7d6f5e', '#5c6d7a'][i % 4], { metalness: 0.3, roughness: 0.6 })); m.position.set(x, h / 2, z); m.castShadow = true; g.add(m); }
  // container islands (collidable boxes) inside the lot
  const cols = ['#c0392b', '#2c6fb0', '#e1a21b', '#3b8a5b', '#8e44ad', '#d35400'];
  const addBlock = (cx, cz, w, d, rows = 2, ry = 0) => { const hs = 2.6; for (let r = 0; r < rows; r++) { for (let i = 0; i < Math.round(w / 6.1); i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(6, hs, 2.5 * Math.round(d / 2.6)), stdMat(cols[((i * 3 + r * 5 + Math.floor(cx)) % cols.length + cols.length) % cols.length], { roughness: 0.55, metalness: 0.4 })); m.position.set(cx - w / 2 + 3 + i * 6.1, hs / 2 + r * hs, cz); m.castShadow = true; g.add(m); } }
    const hw2 = w / 2, hd = d / 2; const c = [[cx - hw2, cz - hd], [cx + hw2, cz - hd], [cx + hw2, cz + hd], [cx - hw2, cz + hd]]; for (let i = 0; i < 4; i++) W.segs.push([c[i][0], c[i][1], c[(i + 1) % 4][0], c[(i + 1) % 4][1]]); };
  addBlock(10, -28, 75, 8, 3); addBlock(-10, 62, 50, 8, 2);
  // tyre stacks, barrels, cones along course apexes
  const tyres = []; const cones = [];
  for (const z of []) ;
  const tm = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12); const tsm = []; const R2 = rng(77);
  path.pts.forEach((p, i) => { if (i % 6) return; if (Math.abs(p.k) > 0.012) { const side = p.k > 0 ? 1 : -1; const x = p.x + p.nx * side * (hw * 0.9), z = p.z + p.nz * side * (hw * 0.9); for (let k = 0; k < 4; k++) tsm.push(mtx(x, 0.18 + k * 0.36, z)); W.circles.push({ x, z, r: 0.9 }); } });
  g.add(instanced(tm, stdMat('#101010', { roughness: 0.9 }), tsm));
  const cm = []; path.pts.forEach((p, i) => { if (i % 5) return; for (const side of [-1, 1]) { const x = p.x + p.nx * side * (hw - 0.5), z = p.z + p.nz * side * (hw - 0.5); if (W.inLot(x, z)) cm.push(mtx(x, 0.3, z)); } });
  g.add(instanced(new THREE.ConeGeometry(0.22, 0.6, 8), emis('#ff6a1a', 0.9), cm));
  // light masts
  const mast = []; for (let i = 0; i < 8; i++) mast.push(mtx(-190 + (i % 4) * 126, 0, i < 4 ? -135 : 135));
  g.add(instanced(new THREE.CylinderGeometry(0.25, 0.4, 24, 8).translate(0, 12, 0), stdMat('#555', { metalness: 0.5 }), mast));
  g.add(instanced(new THREE.BoxGeometry(5, 0.6, 1.2).translate(0, 24.4, 0), emis('#fff4d6', ctx.tod === 'night' ? 3 : 1), mast));
  apexZones(W, 0.014); discover(W, [[0.15, 'crane', 'Rusty Crane'], [0.4, 'yard', 'Container Maze'], [0.65, 'silo', 'Old Silo'], [0.88, 'ramp', 'Hidden Ramp']]);
  W.minimapColor = '#9aa7b5'; W.open = true; W.bounds = { x0: -lotW / 2, x1: lotW / 2, z0: -lotH / 2, z1: lotH / 2 };
  return W;
}

// ============================================================================ HARBOR
function harbor(ctx) {
  const ctrl = [[0, 0], [260, -20], [450, 60], [520, 220], [380, 330], [150, 300], [-60, 360], [-250, 300], [-300, 150], [-200, 20]];
  const path = splinePath(ctrl, true, 2); const hw = 11;
  const W = base('harbor', path, hw); W.spawn = { ...path.at(10), s: 10 }; W.size = 700; const g = W.group; W.offSurface = { grip: 0.8, drag: 0.6, off: true, kind: 'dock', lin: 0.1 };
  addGround(W, 2600, stdMat('#4e5258', { roughness: 0.9 }), -0.02);
  // water
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: '#0d3b52', roughness: 0.12, metalness: 0.6, envMapIntensity: 1.2 })); water.rotation.x = -Math.PI / 2; water.position.set(0, -1.6, 0); g.add(water);
  // dock slab (concrete) under loop corridor: wide strip
  const slab = noiseTex('#707479', 24); rep(slab, 1, 1);
  const slabMat = new THREE.MeshStandardMaterial({ map: slab, roughness: 0.9 }); const sm = roadMesh(path, hw + 70, slabMat, { vrep: 30, y: 0.0 }); g.add(sm);
  // water cut: outside edge on the left (positive) side is quay edge: rebuild slab narrower on left
  const tex = asphaltTex('#3a3c41', 3, 1); g.add(roadMesh(path, hw, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, envMapIntensity: 0.9 }), { vrep: 20, y: 0.03 }));
  const mats = { concrete: stdMat('#b9bcc0', { roughness: 0.7 }) };
  for (const side of [-1, 1]) { const w = wallAlong(offsetLine(path, side * (hw + 0.7)), true, 'concrete', mats, { h: 0.8, th: 0.6 }); g.add(w.mesh); W.segs.push(...w.segs); }
  // kerbs (red/white) on both edges
  const kt = canvasTex(64, 64, (c) => { c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, 64, 32); c.fillStyle = '#d6322b'; c.fillRect(0, 32, 64, 32); }, { repeat: true });
  for (const side of [-1, 1]) g.add(strip(offsetLine(path, side * (hw - 0.4)), true, 0.9, new THREE.MeshStandardMaterial({ map: kt, roughness: 0.7 }), 0.05, 3));
  // containers: stacks beyond the barriers on the inner (right, -1) side
  const R = rng(31); const cols = ['#c0392b', '#2c6fb0', '#e1a21b', '#3b8a5b', '#8e44ad', '#d35400', '#2a9d8f'];
  const cg = new THREE.BoxGeometry(2.5, 2.6, 6.1); const lists = cols.map(() => []);
  for (let s = 0; s < path.length; s += 6.4) { if (R() < 0.18) continue; const q = path.at(s); const side = -1; const stack = 1 + Math.floor(R() * 4); const lanes = 2 + Math.floor(R() * 3); for (let l = 0; l < lanes; l++) { const off = hw + 8 + l * 2.7; const x = q.x + q.nx * side * off, z = q.z + q.nz * side * off; const nn = path.nearest(x, z, 4); if (nn.dist < hw + 6) continue; for (let k = 0; k < stack; k++) lists[Math.floor(R() * cols.length)].push(mtx(x, 1.3 + k * 2.6, z, Math.atan2(q.tx, q.tz))); } }
  lists.forEach((l, i) => { if (l.length) g.add(instanced(cg, stdMat(cols[i], { roughness: 0.55, metalness: 0.35 }), l, { shadow: false })); });
  // gantry cranes
  const crane = new THREE.Group(); const cm = stdMat('#e0b020', { metalness: 0.3, roughness: 0.5 });
  for (const dx of [-14, 14]) for (const dz of [-8, 8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 38, 1.2), cm); l.position.set(dx, 19, dz); crane.add(l); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(34, 2.4, 22), cm); top.position.y = 38; crane.add(top); const boom = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 70), cm); boom.position.set(0, 40, 40); crane.add(boom);
  for (const f of [0.1, 0.45, 0.8]) { const q = path.at(f * path.length); const c = crane.clone(); c.position.set(q.x + q.nx * 38, 0, q.z + q.nz * 38); c.rotation.y = Math.atan2(-q.nx, -q.nz); g.add(c); }
  // lamps
  const lm = []; for (let s = 0; s < path.length; s += 50) { const q = path.at(s); lm.push(mtx(q.x - q.nx * (hw + 2), 0, q.z - q.nz * (hw + 2))); }
  g.add(instanced(new THREE.CylinderGeometry(0.2, 0.3, 16, 8).translate(0, 8, 0), stdMat('#666', { metalness: 0.5 }), lm)); g.add(instanced(new THREE.BoxGeometry(3, 0.5, 1), emis('#ffe9c0', ctx.tod === 'day' ? 1 : 3), lm.map(m => { const e = m.elements; return mtx(e[12], 16.2, e[14]); })));
  // ship
  const ship = new THREE.Mesh(new THREE.BoxGeometry(30, 22, 220), stdMat('#2b3a4a', { roughness: 0.5, metalness: 0.4 })); const q0 = path.at(0.55 * path.length); ship.position.set(q0.x + q0.nx * 120, 8, q0.z + q0.nz * 120); ship.rotation.y = Math.atan2(q0.tx, q0.tz); g.add(ship);
  apexZones(W, 0.012); discover(W, [[0.1, 'lighthouse', 'Old Lighthouse'], [0.35, 'dockside', 'Dockside Warehouse'], [0.6, 'crane', 'Giant Gantry'], [0.85, 'pier', 'Sunset Pier']]);
  W.minimapColor = '#3fb6c9'; W.water = water; W.anim.push((dt, t) => { water.position.y = -1.6 + Math.sin(t * 0.6) * 0.04; });
  return W;
}

// ============================================================================ DESERT
function desert(ctx) {
  const ctrl = []; const R0 = rng(5); const N = 14; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, r = 560 + Math.sin(i * 2.3) * 160 + R0() * 80; ctrl.push([Math.cos(a) * r * 1.35, Math.sin(a) * r]); }
  const hfn = s => Math.sin(s * 0.003) * 3.5 + Math.sin(s * 0.0071) * 1.8;
  const path = splinePath(ctrl, true, 3, hfn); const hw = 8;
  const W = base('desert', path, hw); W.spawn = { ...path.at(10), s: 10 }; W.size = 900; const g = W.group; W.offSurface = { grip: 0.62, drag: 1.5, off: true, kind: 'sand' };
  const sand = noiseTex('#c9a36a', 24); rep(sand, 1, 1);
  terrain(W, path, hw, { seg: 190, seed: 4, margin: 420, blend: 50, mat: new THREE.MeshStandardMaterial({ map: sand, roughness: 1, color: '#e0b87c' }), relief: (x, z, d, side, n) => Math.max(-1.5, n(x, z) * 3.2 * sstep(8, 80, d)) });
  g.add(roadMesh(path, hw, new THREE.MeshStandardMaterial({ map: asphaltTex('#4a4a4c', 2, 0.7), roughness: 0.7 }), { vrep: 18, y: 0.04 }));
  // road shoulders
  g.add(roadMesh(path, hw + 1.6, new THREE.MeshStandardMaterial({ color: '#8e7a5c', roughness: 1 }), { y: 0.02 }));
  const R = rng(61);
  // mesas, rocks, cacti
  const mesas = []; for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, r = 900 + R() * 900; mesas.push(mtx(Math.cos(a) * r * 1.3, 0, Math.sin(a) * r, R() * 3, 1, 1, 1)); }
  const mgeo = new THREE.CylinderGeometry(45, 70, 80, 7); mgeo.translate(0, 28, 0); g.add(instanced(mgeo, stdMat('#b5683a', { roughness: 1 }), mesas));
  const rocks = scatter(W, 220, 4, 12, 220, (x, z, r) => mtx(x, W.terrainH(x, z) + 0.5, z, r() * 6, 0.8 + r() * 2.6, 0.6 + r() * 1.6, 0.8 + r() * 2));
  g.add(instanced(new THREE.DodecahedronGeometry(1.2, 0), stdMat('#9a6a47', { roughness: 1 }), rocks));
  const cact = scatter(W, 200, 8, 11, 160, (x, z, r) => mtx(x, W.terrainH(x, z) + 1.5, z, 0, 0.9 + r() * 0.8, 0.9 + r() * 0.9, 0.9));
  g.add(instanced(new THREE.CapsuleGeometry(0.28, 2.6, 4, 8), stdMat('#3f6b3a', { roughness: 0.9 }), cact));
  // power poles along the road
  const poles = []; for (let s = 0; s < path.length; s += 60) { const q = path.at(s); poles.push(mtx(q.x + q.nx * (hw + 7), q.y, q.z + q.nz * (hw + 7))); }
  g.add(instanced(new THREE.CylinderGeometry(0.14, 0.2, 11, 6).translate(0, 5.5, 0), stdMat('#5c4630'), poles));
  g.add(instanced(new THREE.BoxGeometry(3.2, 0.14, 0.14).translate(0, 10.6, 0), stdMat('#44331f'), poles));
  // distance markers
  const mk = []; for (let s = 0; s < path.length; s += 100) { const q = path.at(s); mk.push(mtx(q.x - q.nx * (hw + 1.5), q.y + 0.6, q.z - q.nz * (hw + 1.5))); }
  g.add(instanced(new THREE.BoxGeometry(0.25, 1.2, 0.08), emis('#ffffff', 0.7), mk));
  // billboard
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: signTex('SLIDE', '#ffb000', '#150b00', 512, 256, false), toneMapped: false })); const q = path.at(0.3 * path.length); bb.position.set(q.x + q.nx * (hw + 14), q.y + 9, q.z + q.nz * (hw + 14)); bb.lookAt(q.x, q.y + 6, q.z); g.add(bb);
  apexZones(W, 0.006); discover(W, [[0.12, 'diner', 'Route Diner'], [0.38, 'arch', 'Red Rock Arch'], [0.62, 'wreck', 'Abandoned Plane'], [0.86, 'oasis', 'Hidden Oasis']]);
  W.minimapColor = '#f2b560'; W.wideOffroad = true;
  return W;
}

// ============================================================================ ARENA
function arena(ctx) {
  const ctrl = [[0, 0], [230, 0], [270, 40], [270, 120], [190, 165], [130, 115], [70, 160], [10, 120], [-55, 165], [-125, 110], [-125, 40]];
  const path = roundedPath(ctrl, [30, 30, 26, 26, 30, 22, 24, 22, 22, 28, 30], true, 2); const hw = 10;
  const W = base('arena', path, hw); W.spawn = { ...path.at(14), s: 14 }; W.size = 420; const g = W.group; W.offSurface = { grip: 0.68, drag: 1, off: true, kind: 'infield', lin: 0.12 };
  addGround(W, 1400, stdMat('#232629', { roughness: 0.95 }), -0.03);
  const inf = new THREE.Mesh(new THREE.PlaneGeometry(900, 600), new THREE.MeshStandardMaterial({ map: rep(noiseTex('#3c3f42', 24), 60, 40), roughness: 0.9 })); inf.rotation.x = -Math.PI / 2; inf.position.set(70, 0, 80); g.add(inf);
  g.add(roadMesh(path, hw, new THREE.MeshStandardMaterial({ map: asphaltTex('#2d2e33', 3, 1), roughness: 0.58, envMapIntensity: 1.0 }), { vrep: 16, y: 0.03 }));
  // kerbs on inside of curves
  const kt = canvasTex(64, 64, (c) => { c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, 64, 32); c.fillStyle = '#e63232'; c.fillRect(0, 32, 64, 32); }, { repeat: true });
  for (const side of [-1, 1]) g.add(strip(offsetLine(path, side * (hw + 0.5)), true, 1.0, new THREE.MeshStandardMaterial({ map: kt, roughness: 0.7 }), 0.05, 3));
  // tyre walls
  const tex = canvasTex(64, 64, (c) => { c.fillStyle = '#111'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, 64, 12); c.fillRect(0, 36, 64, 12); c.fillStyle = '#e03030'; c.fillRect(0, 12, 64, 12); c.fillRect(0, 48, 64, 12); }, { repeat: true });
  const wm = { tire: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), concrete: stdMat('#bbb') };
  for (const side of [-1, 1]) { const w = wallAlong(offsetLine(path, side * (hw + 2.0)), true, 'tire', wm, { h: 1.1, th: 0.9 }); g.add(w.mesh); W.segs.push(...w.segs); }
  // grandstands
  const R = rng(12); const gs = new THREE.Group(); const gcol = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#f8f9fa'];
  for (const [f, side] of [[0.05, 1], [0.12, 1], [0.35, -1], [0.62, 1]]) { const q = path.at(f * path.length); for (let st = 0; st < 5; st++) { const m = new THREE.Mesh(new THREE.BoxGeometry(36, 1.2, 3), stdMat(gcol[(st + Math.floor(f * 10)) % gcol.length], { roughness: 0.7 })); m.position.set(q.x + q.nx * side * (hw + 8 + st * 3), 0.6 + st * 1.2, q.z + q.nz * side * (hw + 8 + st * 3)); m.rotation.y = Math.atan2(q.tx, q.tz); g.add(m); } }
  // floodlight towers
  const tw = []; for (let s = 0; s < path.length; s += 90) { const q = path.at(s); tw.push(mtx(q.x - q.nx * (hw + 14), 0, q.z - q.nz * (hw + 14), Math.atan2(-q.tx, -q.tz))); }
  g.add(instanced(new THREE.CylinderGeometry(0.3, 0.5, 26, 8).translate(0, 13, 0), stdMat('#444', { metalness: 0.5 }), tw)); g.add(instanced(new THREE.BoxGeometry(6, 1.6, 0.6).translate(0, 26, 0.6), emis('#fff6e0', ctx.tod === 'night' ? 4 : 1), tw));
  // banners
  const bm = []; for (let s = 10; s < path.length; s += 28) { const q = path.at(s); const side = (Math.floor(s / 28) % 2) ? 1 : -1; bm.push(mtx(q.x + q.nx * side * (hw + 3.4), 2.2, q.z + q.nz * side * (hw + 3.4), Math.atan2(q.tx, q.tz))); }
  g.add(instanced(new THREE.BoxGeometry(0.1, 2.6, 4), emis('#ff2d95', 0.8), bm.filter((_, i) => i % 2)));
  g.add(instanced(new THREE.BoxGeometry(0.1, 2.6, 4), emis('#19d3ff', 0.8), bm.filter((_, i) => !(i % 2))));
  // start gantry
  const sg = path.at(0.0); const gantry = new THREE.Group(); const gm = stdMat('#222', { metalness: 0.6 }); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), gm); p.position.set(s * (hw + 1.5), 4, 0); gantry.add(p); } const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * (hw + 1.5), 1.6, 0.8), new THREE.MeshBasicMaterial({ map: signTex('SLIDE ARENA', '#ffb000', '#0d0900', 512, 64, false), toneMapped: false })); beam.position.y = 8; gantry.add(beam); gantry.position.set(sg.x, 0, sg.z); gantry.rotation.y = Math.atan2(sg.tx, sg.tz); g.add(gantry);
  apexZones(W, 0.02); discover(W, [[0.2, 'pit', 'Pit Lane'], [0.5, 'podium', 'Podium'], [0.8, 'scoreboard', 'Giant Scoreboard']]);
  W.minimapColor = '#ffb000';
  return W;
}

const BUILDERS = { tokyo, mountain, industrial, harbor, desert, arena };
export function buildMap(id, ctx) { const W = BUILDERS[id](ctx); W.meta = MAPS[id]; return W; }
