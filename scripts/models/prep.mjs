// Offline model prep: source glTF/GLB -> normalised, wheel-less, compressed assets/models/<id>.glb + <id>.json (meta).
// Run:  node scripts/models/prep.mjs <id> [<id>...]   (needs gltf-transform; see scripts/models/README.md)
// Normalisation: +z = front, x = 0 centre, z = 0 centre, ground y = 0, length = real car length.
// Baked wheels (tyre/rim/disc/caliper) are cut out (everything inside the tyre cylinders) because the game draws its own
// customisable wheels at the measured wheel centres.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, dedup, prune, simplify, textureCompress, meshopt, flatten } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs'; import path from 'path';
const ROOT = process.env.SLIDE || '/workspace/slide', SRC = process.env.MODELSRC || '/workspace/modelsrc/dl';
const { RECIPES } = await import(ROOT + '/scripts/models/recipes.mjs');
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': (await import('meshoptimizer')).MeshoptDecoder });
const mulV = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const rotV = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
const FWD = { '+z': 0, '+x': -90, '-x': 90, '-z': 180 }; // rotation about Y (deg) taking model-forward to +z
const triCount = doc => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3; return t; };
const ensureIdx = (doc, p) => { if (p.getIndices()) return; const n = p.getAttribute('POSITION').getCount(); const a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; p.setIndices(doc.createAccessor().setType('SCALAR').setArray(a).setBuffer(doc.getRoot().listBuffers()[0])); };

async function prep(id) {
  const R = RECIPES[id]; if (!R) throw new Error('no recipe ' + id);
  const doc = await io.read(path.join(SRC, R.src)); const root = doc.getRoot(); const scene = root.getDefaultScene() || root.listScenes()[0];
  root.listAnimations().forEach(a => a.dispose());
  if (!root.listBuffers().length) root.listBuffers()[0] = doc.createBuffer();
  const buf = root.listBuffers()[0];
  const before = triCount(doc);
  // ---- 1. bake world transforms + orientation into vertex data, one node per mesh
  const yaw = (R.yaw ?? FWD[R.forward || '+z']) * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const Ry = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]; // column-major rotation about Y
  const up = R.up || '+y'; // '+y' | '+z' (Z-up sources): rotate -90 about X
  const nodes = []; scene.traverse(n => { if (n.getMesh()) nodes.push(n); });
  const dropMat = R.dropMat ? new RegExp(R.dropMat, 'i') : null;
  const out = [];
  for (const n of nodes) {
    if (R.dropNodes && new RegExp(R.dropNodes).test(n.getName() || '')) continue;
    const W = n.getWorldMatrix(); const mesh = n.getMesh(); const m2 = mesh.clone(); m2.setName(n.getName() || 'm');
    for (const p of m2.listPrimitives()) {
      if (p.getMode() !== 4) { m2.removePrimitive(p); continue; }
      if (dropMat && dropMat.test(p.getMaterial()?.getName() || '')) { m2.removePrimitive(p); continue; }
      const pos = p.getAttribute('POSITION').clone(), arr = Float32Array.from(pos.getArray()); const nrm = p.getAttribute('NORMAL') ? p.getAttribute('NORMAL').clone() : null; const na = nrm ? Float32Array.from(nrm.getArray()) : null;
      for (let i = 0; i < arr.length; i += 3) {
        let v = mulV(W, arr[i], arr[i + 1], arr[i + 2]); if (up === '+z') v = [v[0], v[2], -v[1]]; v = mulV(Ry, ...v); arr[i] = v[0]; arr[i + 1] = v[1]; arr[i + 2] = v[2];
        if (na) { let q = rotV(W, na[i], na[i + 1], na[i + 2]); if (up === '+z') q = [q[0], q[2], -q[1]]; q = rotV(Ry, ...q); const l = Math.hypot(...q) || 1; na[i] = q[0] / l; na[i + 1] = q[1] / l; na[i + 2] = q[2] / l; }
      }
      pos.setArray(arr); p.setAttribute('POSITION', pos); if (nrm) { nrm.setArray(na); p.setAttribute('NORMAL', nrm); }
      if (R.tireNodes && new RegExp(R.tireNodes).test(n.getName() || '')) p.setExtras({ ...(p.getExtras() || {}), wheel: true });
      if (p.getAttribute('TANGENT')) p.setAttribute('TANGENT', null);
      ensureIdx(doc, p);
    }
    out.push(m2);
  }
  for (const n of nodes) n.dispose(); for (const m of root.listMeshes()) if (!out.includes(m) && m.listParents().filter(x => x.propertyType !== 'Root').length === 0) m.dispose();
  for (const c of scene.listChildren()) c.dispose();
  for (const m of out) scene.addChild(doc.createNode(m.getName()).setMesh(m));
  const prims = () => out.flatMap(m => m.listPrimitives());
  // ---- 2. bounds -> scale / centre
  const bounds = (filter) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of prims()) { if (filter && !filter(p)) continue; const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a[i + k]); mx[k] = Math.max(mx[k], a[i + k + 0]); } } return { mn, mx }; };
  const bb = (filter) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of prims()) { if (filter && !filter(p)) continue; const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { const v = a[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; } } return { mn, mx }; };
  const b0 = bb(p => !/glass/i.test(p.getMaterial()?.getName() || '') || true);
  const s = R.L / (b0.mx[2] - b0.mn[2]); const cx = (b0.mn[0] + b0.mx[0]) / 2, cz = (b0.mn[2] + b0.mx[2]) / 2;
  const tireRe = R.tire ? new RegExp(R.tire, 'i') : null; const isTire = p => (p.getExtras() && p.getExtras().wheel) || (tireRe && tireRe.test(p.getMaterial()?.getName() || ''));
  const tb = bb(isTire); if (tb.mn[1] > 1e8) throw new Error('no tire prims for ' + id);
  const gy = tb.mn[1];
  for (const p of prims()) { const a = p.getAttribute('POSITION'); const arr = Float32Array.from(a.getArray()); for (let i = 0; i < arr.length; i += 3) { arr[i] = (arr[i] - cx) * s; arr[i + 1] = (arr[i + 1] - gy) * s; arr[i + 2] = (arr[i + 2] - cz) * s; } a.setArray(arr); }
  // ---- 3. wheel clusters from tyre vertices
  const cl = [[], [], [], []]; // fl(+x? ) quadrant order: [x>0,z>0],[x<0,z>0],[x>0,z<0],[x<0,z<0]
  const tbn = bb(isTire); const tcx = (tbn.mn[0] + tbn.mx[0]) / 2, tcz = (tbn.mn[2] + tbn.mx[2]) / 2;
  const wb = [0, 1, 2, 3].map(() => ({ mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }));
  for (const p of prims()) { if (!isTire(p)) continue; const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) { const q = (a[i] > tcx ? 0 : 1) + (a[i + 2] > tcz ? 0 : 2); for (let k = 0; k < 3; k++) { wb[q].mn[k] = Math.min(wb[q].mn[k], a[i + k]); wb[q].mx[k] = Math.max(wb[q].mx[k], a[i + k]); } } }
  const W4 = wb.map(b => ({ x: (b.mn[0] + b.mx[0]) / 2, y: (b.mn[1] + b.mx[1]) / 2, z: (b.mn[2] + b.mx[2]) / 2, R: Math.min(b.mx[1] - b.mn[1], b.mx[2] - b.mn[2]) / 2, tw: b.mx[0] - b.mn[0] }));
  const front = W4.filter(w => w.z > 0), rear = W4.filter(w => w.z < 0); const avg = (arr, k) => arr.reduce((t, w) => t + w[k], 0) / arr.length;
  const wzF = avg(front, 'z'), wzR = avg(rear, 'z'); const trackF = (Math.abs(front[0].x) + Math.abs(front[1].x)), trackR = (Math.abs(rear[0].x) + Math.abs(rear[1].x));
  const Rw = avg(W4, 'R'), twF = avg(front, 'tw'), twR = avg(rear, 'tw');
  // ---- 4. cut everything inside the tyre cylinders
  const dropWheelRe = R.keepNearWheel ? new RegExp(R.keepNearWheel, 'i') : null;
  let cut = 0;
  for (const p of prims()) {
    if (dropWheelRe && dropWheelRe.test(p.getMaterial()?.getName() || '')) continue;
    const a = p.getAttribute('POSITION').getArray(), idx = p.getIndices().getArray(), keep = [];
    const inside = (i) => { for (const w of W4) { if (Math.abs(a[i * 3] - w.x) <= w.tw / 2 + 0.03 && Math.hypot(a[i * 3 + 1] - w.y, a[i * 3 + 2] - w.z) <= Rw * (R.cutR || 1.015)) return true; } return false; };
    for (let t = 0; t < idx.length; t += 3) { if (inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2])) cut++; else keep.push(idx[t], idx[t + 1], idx[t + 2]); }
    p.getIndices().setArray(Uint32Array.from(keep));
  }
  for (const m of out) for (const p of m.listPrimitives()) if (p.getIndices().getCount() === 0) m.removePrimitive(p);

  // ---- 4b. optional: split a palette-textured material into role materials by the texel colour under each triangle
  if (R.texSplit) {
    const T = R.texSplit; const mat0 = root.listMaterials().find(m => new RegExp(T.material).test(m.getName())); const tex = mat0.getBaseColorTexture();
    const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const texel = (u, v) => { const x = Math.min(info.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * info.width))), y = Math.min(info.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * info.height))); const o = (y * info.width + x) * 3; return [data[o], data[o + 1], data[o + 2]]; };
    const mk = {}; for (const r of T.rules) { const m = mat0.clone().setName(r.name); if (r.flat) { m.setBaseColorTexture(null); m.setBaseColorFactor(r.flat); } mk[r.name] = m; }
    for (const m of out) for (const p of [...m.listPrimitives()]) {
      if (p.getMaterial() !== mat0) continue; const uv = p.getAttribute('TEXCOORD_0').getArray(), idx = p.getIndices().getArray(); const groups = {};
      for (let t = 0; t < idx.length; t += 3) { let u = 0, v = 0; for (let k = 0; k < 3; k++) { u += uv[idx[t + k] * 2] / 3; v += uv[idx[t + k] * 2 + 1] / 3; } const c = texel(u, v); let name = T.rest || mat0.getName(); for (const r of T.rules) if (r.test(c[0], c[1], c[2])) { name = r.name; break; } (groups[name] ||= []).push(idx[t], idx[t + 1], idx[t + 2]); }
      if (T.debug) { const h = {}; for (let t = 0; t < idx.length; t += 3) { let u = 0, v = 0; for (let k = 0; k < 3; k++) { u += uv[idx[t + k] * 2] / 3; v += uv[idx[t + k] * 2 + 1] / 3; } const c = texel(u, v).join(','); h[c] = (h[c] || 0) + 1; } console.log(Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, 12)); }
      console.log('texSplit', Object.entries(groups).map(([k, v]) => k + ':' + v.length / 3).join(' '));
      m.removePrimitive(p);
      for (const [name, arr] of Object.entries(groups)) { const np = doc.createPrimitive().setMode(4).setMaterial(mk[name] || mat0).setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(arr)).setBuffer(buf)); for (const sem of p.listSemantics()) np.setAttribute(sem, p.getAttribute(sem)); m.addPrimitive(np); }
    }
  }
  // ---- 5. profile height-map (top surface over s,x) + half-width per slice
  const all = bb(); const H = all.mx[1], halfL = R.L / 2; const NS = 80, NX = 21; const Wh = Math.max(Math.abs(all.mn[0]), Math.abs(all.mx[0]));
  const top = Array.from({ length: NS + 1 }, () => new Float32Array(NX)); const hw = new Float32Array(NS + 1);
  const yCut = R.beltY || 0.8;
  for (const p of prims()) {
    const a = p.getAttribute('POSITION').getArray(), idx = p.getIndices().getArray();
    for (let i = 0; i < a.length; i += 3) { if (a[i + 1] < yCut) { const si = Math.round((halfL - a[i + 2]) / R.L * NS); if (si >= 0 && si <= NS) hw[si] = Math.max(hw[si], Math.abs(a[i])); } }
    for (let t = 0; t < idx.length; t += 3) {
      const A = [idx[t], idx[t + 1], idx[t + 2]].map(k => [a[k * 3], a[k * 3 + 1], a[k * 3 + 2]]);
      const gs = v => (halfL - v[2]) / R.L * NS, gx = v => (v[0] + Wh) / (2 * Wh) * (NX - 1);
      const s0 = Math.max(0, Math.floor(Math.min(...A.map(gs)))), s1 = Math.min(NS, Math.ceil(Math.max(...A.map(gs)))), x0 = Math.max(0, Math.floor(Math.min(...A.map(gx)))), x1 = Math.min(NX - 1, Math.ceil(Math.max(...A.map(gx))));
      for (let si = s0; si <= s1; si++) for (let xi = x0; xi <= x1; xi++) {
        const px = xi / (NX - 1) * 2 * Wh - Wh, pz = halfL - si / NS * R.L; // barycentric in (x,z)
        const [p0, p1, p2] = A; const d = (p1[2] - p2[2]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[2] - p2[2]); if (Math.abs(d) < 1e-12) { continue; }
        const l0 = ((p1[2] - p2[2]) * (px - p2[0]) + (p2[0] - p1[0]) * (pz - p2[2])) / d, l1 = ((p2[2] - p0[2]) * (px - p2[0]) + (p0[0] - p2[0]) * (pz - p2[2])) / d, l2 = 1 - l0 - l1;
        const e = -0.02; if (l0 < e || l1 < e || l2 < e) continue; const y = l0 * p0[1] + l1 * p1[1] + l2 * p2[1]; if (y > top[si][xi]) top[si][xi] = y;
      }
    }
  }
  const bodyW = Math.max(...hw) * 2;
  // ---- 6. optimise
  await doc.transform(dedup(), prune(), weld());
  const maxT = R.maxTris || 60000, now = triCount(doc);
  if (now > maxT) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: maxT / now, error: R.simpErr || 0.004, lockBorder: false }));
  await doc.transform(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [R.tex || 1024, R.tex || 1024], quality: 82 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  fs.mkdirSync(ROOT + '/assets/models', { recursive: true });
  await io.write(ROOT + '/assets/models/' + id + '.glb', doc);
  const mats = root.listMaterials().map(m => m.getName());
  const meta = { id, L: R.L, W: +bodyW.toFixed(3), H: +H.toFixed(3), wzF: +wzF.toFixed(4), wzR: +wzR.toFixed(4), trackF: +trackF.toFixed(4), trackR: +trackR.toFixed(4), R: +Rw.toFixed(4), twF: +twF.toFixed(3), twR: +twR.toFixed(3), wy: +avg(W4, 'y').toFixed(4), Wh: +Wh.toFixed(3), NS, NX, hw: Array.from(hw, v => +v.toFixed(3)), top: top.map(r => Array.from(r, v => +v.toFixed(3))), roles: R.roles || {}, mats, tris: Math.round(triCount(doc)) };
  fs.writeFileSync(ROOT + '/assets/models/' + id + '.json', JSON.stringify(meta));
  const sz = fs.statSync(ROOT + '/assets/models/' + id + '.glb').size;
  console.log(id, 'tris', Math.round(before), '->', meta.tris, 'cutTris', cut, 'glb', (sz / 1e6).toFixed(2) + 'MB', 'W', meta.W, 'H', meta.H, 'wb', (wzF - wzR).toFixed(3), 'trackF', meta.trackF, 'R', meta.R, 'tw', meta.twF);
}
for (const id of process.argv.slice(2)) await prep(id);
