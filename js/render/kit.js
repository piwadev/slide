// World-building kit: seeded RNG, path generation (rounded polygons / splines), spatial lookup, road/wall/kerb meshes,
// canvas textures, instanced prop helpers. Used by render/maps.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ paths
export class Path {
  constructor(pts, closed, heightFn) {
    this.closed = closed; this.pts = pts; this.n = pts.length; let s = 0;
    for (let i = 0; i < this.n; i++) { const p = pts[i], q = pts[(i + 1) % this.n]; p.s = s; const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1e-6; p.tx = dx / l; p.tz = dz / l; p.l = l; s += (i < this.n - 1 || closed) ? l : 0; }
    if (!closed) { const l = pts[this.n - 1], p = pts[this.n - 2]; l.tx = p.tx; l.tz = p.tz; l.l = 0; }
    this.length = s;
    for (const p of pts) { p.nx = p.tz; p.nz = -p.tx; p.y = heightFn ? heightFn(p.s) : 0; } // normal = LEFT of travel (car left for heading psi is (cos psi, -sin psi))
    // curvature (signed, 1/m) smoothed
    for (let i = 0; i < this.n; i++) { const a = pts[(i - 3 + this.n) % this.n], b = pts[(i + 3) % this.n]; const a1 = Math.atan2(a.tx, a.tz), a2 = Math.atan2(b.tx, b.tz); let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; pts[i].k = d / Math.max(1, 6 * (pts[i].l || 1)); }
    this.cell = 24; this.grid = new Map();
    pts.forEach((p, i) => { const k = Math.floor(p.x / this.cell) + ',' + Math.floor(p.z / this.cell); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(i); });
    this.bounds = pts.reduce((b, p) => ({ x0: Math.min(b.x0, p.x), x1: Math.max(b.x1, p.x), z0: Math.min(b.z0, p.z), z1: Math.max(b.z1, p.z) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 });
  }
  // nearest point: returns {i, d (signed lateral: + left), s, y, dist}
  nearest(x, z, radius = 3) {
    let best = null, bd = 1e18; const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let r = 0; r <= radius && !best; r++) for (let ix = cx - r; ix <= cx + r; ix++) for (let iz = cz - r; iz <= cz + r; iz++) { const a = this.grid.get(ix + ',' + iz); if (!a) continue; for (const i of a) { const p = this.pts[i]; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } }
    if (best === null) return null;
    const p = this.pts[best]; const lat = (x - p.x) * p.nx + (z - p.z) * p.nz; const along = (x - p.x) * p.tx + (z - p.z) * p.tz;
    return { i: best, d: lat, dist: Math.sqrt(bd), s: p.s + along, y: p.y, p };
  }
  at(s) { s = this.closed ? ((s % this.length) + this.length) % this.length : clamp(s, 0, this.length); let lo = 0, hi = this.n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (this.pts[m].s <= s) lo = m; else hi = m - 1; } const p = this.pts[lo], q = this.pts[(lo + 1) % this.n], t = p.l ? (s - p.s) / p.l : 0; return { x: lerp(p.x, q.x, t), z: lerp(p.z, q.z, t), y: lerp(p.y, q.y, t), tx: p.tx, tz: p.tz, nx: p.nx, nz: p.nz, k: p.k, s }; }
}
// rounded polygon through control points (fillet radius r, may be array per corner)
export function roundedPath(ctrl, r, closed = true, step = 2, heightFn) {
  const n = ctrl.length, out = [];
  const rad = i => Array.isArray(r) ? r[i % r.length] : r;
  const corner = i => { const p = ctrl[(i + n) % n], a = ctrl[(i - 1 + n) % n], b = ctrl[(i + 1) % n]; const v1 = [a[0] - p[0], a[1] - p[1]], v2 = [b[0] - p[0], b[1] - p[1]]; const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2); const u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2]; const cosA = clamp(u1[0] * u2[0] + u1[1] * u2[1], -1, 1), ang = Math.acos(cosA); if (ang > Math.PI - 0.02) return { pts: [p] }; const t = Math.min(rad(i) / Math.tan(ang / 2), l1 * 0.48, l2 * 0.48), rr = t * Math.tan(ang / 2); const s = [p[0] + u1[0] * t, p[1] + u1[1] * t], e = [p[0] + u2[0] * t, p[1] + u2[1] * t]; const bis = [u1[0] + u2[0], u1[1] + u2[1]]; const bl = Math.hypot(...bis); const c = [p[0] + bis[0] / bl * rr / Math.sin(ang / 2), p[1] + bis[1] / bl * rr / Math.sin(ang / 2)]; let a0 = Math.atan2(s[1] - c[1], s[0] - c[0]), a1 = Math.atan2(e[1] - c[1], e[0] - c[0]); let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; const pts = []; const seg = Math.max(4, Math.ceil(Math.abs(da) * rr / 1.2)); for (let k = 0; k <= seg; k++) { const a = a0 + da * k / seg; pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]); } return { pts }; };
  for (let i = 0; i < n; i++) { if (!closed && (i === 0 || i === n - 1)) { out.push(ctrl[i]); continue; } out.push(...corner(i).pts); }
  return resample(out, closed, step, heightFn);
}
export function splinePath(ctrl, closed = true, step = 2, heightFn) { // Catmull-Rom
  const n = ctrl.length, pts = []; const get = i => ctrl[closed ? (i + n) % n : clamp(i, 0, n - 1)];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) { const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2); const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const m = Math.max(4, Math.ceil(len / 3)); for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t; const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } }
  if (!closed) pts.push(ctrl[n - 1]);
  return resample(pts, closed, step, heightFn);
}
function resample(pts, closed, step, heightFn) {
  const P = closed ? pts.concat([pts[0]]) : pts; const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = cum[cum.length - 1], n = Math.max(8, Math.round(total / step)), out = []; let j = 0;
  for (let k = 0; k < (closed ? n : n + 1); k++) { const d = k / n * total; while (j < cum.length - 2 && cum[j + 1] < d) j++; const t = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1); out.push({ x: lerp(P[j][0], P[j + 1][0], t), z: lerp(P[j][1], P[j + 1][1], t) }); }
  return new Path(out, closed, heightFn);
}

// ------------------------------------------------------------------ textures
export function canvasTex(w, h, draw, opts = {}) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); draw(c, w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 8; return t; }
export function asphaltTex(base = '#2b2c30', lanes = 2, wear = 1) {
  return canvasTex(512, 512, (c, w, h) => {
    const R = rng(11); c.fillStyle = base; c.fillRect(0, 0, w, h);
    const id = c.getImageData(0, 0, w, h); for (let i = 0; i < id.data.length; i += 4) { const n = (R() - 0.5) * 22; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } c.putImageData(id, 0, 0);
    // tyre wear lanes
    for (let k = 0; k < lanes; k++) { const cx = w * (k + 0.5) / lanes; for (const o of [-0.16, 0.16]) { const g = c.createLinearGradient(cx + o * w / lanes - 28, 0, cx + o * w / lanes + 28, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${0.22 * wear})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(cx + o * w / lanes - 28, 0, 56, h); } }
    // cracks / patches
    c.strokeStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 14; i++) { c.beginPath(); let x = R() * w, y = R() * h; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 50; y += R() * 40; c.lineTo(x, y); } c.stroke(); }
    // markings: edge lines + dashed lane dividers (period = full height)
    c.fillStyle = 'rgba(235,235,230,0.92)'; c.fillRect(w * 0.025, 0, 7, h); c.fillRect(w * 0.975 - 7, 0, 7, h);
    for (let k = 1; k < lanes; k++) { const x = w * k / lanes - 4; for (let y = 0; y < h; y += h / 4) { c.fillRect(x, y + 20, 8, h / 8); } }
  }, { repeat: true });
}
export function windowTex(seed, warm = true) {
  return canvasTex(256, 512, (c, w, h) => {
    const R = rng(seed); c.fillStyle = '#12151b'; c.fillRect(0, 0, w, h);
    const cols = 8, rows = 16, cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const on = R() > 0.45; const hue = R(); c.fillStyle = on ? (hue > 0.85 ? '#9fd8ff' : hue > 0.3 ? '#ffd9a0' : '#fff2cf') : '#1b2230'; c.fillRect(x * cw + 6, y * ch + 5, cw - 12, ch - 10); }
  }, { repeat: true });
}
export function signTex(text, fg, bg, w = 128, h = 512, vertical = true) {
  return canvasTex(w, h, (c) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(5, 5, w - 10, h - 10); c.fillStyle = fg; c.shadowColor = fg; c.shadowBlur = 14; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `bold ${vertical ? w * 0.62 : h * 0.6}px "Yu Gothic","Noto Sans CJK JP","MS Gothic",sans-serif`; const chars = [...text]; if (vertical) { const step = (h - 40) / chars.length; chars.forEach((ch, i) => c.fillText(ch, w / 2, 20 + step * (i + 0.5))); } else c.fillText(text, w / 2, h / 2 + 2); });
}
export function gradientSkyTex(stops) { return canvasTex(8, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); stops.forEach(([t, col]) => g.addColorStop(t, col)); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }

// ------------------------------------------------------------------ meshes along paths
export function roadMesh(path, halfW, mat, opts = {}) { // ribbon with uv (u across 0..1, v along in metres / 'vrepeat')
  const pts = path.pts, n = pts.length, P = [], UV = [], IDX = [], vrep = opts.vrep || 16, y0 = opts.y || 0.02, segs = path.closed ? n : n - 1, ex = opts.edge || 0;
  const W = halfW + ex; const rows = path.closed ? n + 1 : n;
  for (let k = 0; k < rows; k++) { const p = pts[k % n]; P.push(p.x - p.nx * W, p.y + y0, p.z - p.nz * W, p.x + p.nx * W, p.y + y0, p.z + p.nz * W); const v = (path.closed && k === n ? path.length : p.s) / vrep; UV.push(0, v, 1, v); }
  for (let k = 0; k < rows - 1; k++) { const a = k * 2; IDX.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(IDX); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
// offset polyline (side = +1 left, -1 right), returns array of {x,z,y}
export function offsetLine(path, off, from = 0, to = 1) { const out = []; const n = path.n; const a = Math.floor(from * n), b = Math.floor(to * n); for (let i = a; i < b; i++) { const p = path.pts[i]; out.push({ x: p.x + p.nx * off, z: p.z + p.nz * off, y: p.y }); } return out; }
// wall: merged boxes along a polyline. returns {mesh, segs:[[x1,z1,x2,z2]]}. style: concrete|rail|tire|block
export function wallAlong(line, closed, style, mats, opts = {}) {
  const segs = [], geos = []; const h = opts.h || 0.9, th = opts.th || 0.5, gap = opts.skip || (() => false);
  const N = line.length;
  for (let i = 0; i < (closed ? N : N - 1); i++) {
    const a = line[i], b = line[(i + 1) % N]; if (gap(i)) continue; const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); if (l < 1e-3) continue;
    segs.push([a.x, a.z, b.x, b.z]);
    const ang = Math.atan2(dx, dz); const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, my = (a.y + b.y) / 2;
    const g = new THREE.BoxGeometry(th, h, l * 1.02); g.rotateY(ang); g.translate(mx, my + h / 2, mz); geos.push(g);
    if (style === 'rail') { const rg = new THREE.BoxGeometry(0.08, 0.28, l * 1.02); rg.rotateY(ang); rg.translate(mx, my + 0.7, mz); geos.push(rg); }
  }
  if (!geos.length) return { mesh: new THREE.Group(), segs };
  const merged = mergeGeometries(geos.map(g => { const ng = g.toNonIndexed ? g.toNonIndexed() : g; return ng; }), false);
  const mesh = new THREE.Mesh(merged, mats[style] || mats.concrete); mesh.castShadow = true; mesh.receiveShadow = true; return { mesh, segs };
}
export function strip(line, closed, width, mat, y = 0.04, vrep = 3) { // flat strip centred on polyline (kerbs)
  const P = [], UV = [], IDX = [], N = line.length; let s = 0;
  const rows = closed ? N + 1 : N;
  for (let k = 0; k < rows; k++) { const a = line[k % N], b = line[(k + 1) % N], c = line[(k - 1 + N) % N]; let dx = b.x - c.x, dz = b.z - c.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const nx = -dz, nz = dx; P.push(a.x - nx * width / 2, a.y + y, a.z - nz * width / 2, a.x + nx * width / 2, a.y + y, a.z + nz * width / 2); if (k) s += Math.hypot(a.x - line[(k - 1) % N].x, a.z - line[(k - 1) % N].z); UV.push(0, s / vrep, 1, s / vrep); }
  for (let k = 0; k < rows - 1; k++) { const a = k * 2; IDX.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(IDX); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
// instanced helper: place many copies of a geometry/material
export function instanced(geo, mat, matrices, opts = {}) { const im = new THREE.InstancedMesh(geo, mat, matrices.length); const m = new THREE.Matrix4(); matrices.forEach((mm, i) => im.setMatrixAt(i, mm)); im.instanceMatrix.needsUpdate = true; im.castShadow = !!opts.shadow; im.receiveShadow = true; im.frustumCulled = false; return im; }
export const mtx = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz)); return m; };
