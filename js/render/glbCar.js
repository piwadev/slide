// Real-model car: loads a prepared glTF (assets/models/<id>.glb, wheels cut out) and drives it with the same customisation
// pipeline as the procedural CarModel: paint finishes / two-tone / liveries via re-projected UVs, glass tint, headlight colour,
// brake lights, underglow, our own wheels on 4 pivots (steer/spin/suspension), body-kit add-ons placed from the model's measured profile.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CarModel } from './carBuilder.js';
import { MODEL_IDS } from '../data/models.js';

const cache = new Map(); // id -> { scene, meta } | 'fail' | Promise
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const url = f => new URL('../../assets/models/' + f, import.meta.url).href;
export const hasModel = id => MODEL_IDS.includes(id);
export const modelReady = id => { const c = cache.get(id); return !!c && c !== 'fail' && !(c instanceof Promise); };

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function prepareAsset(gltf, meta) {
  const scene = gltf.scene; scene.updateMatrixWorld(true);
  // role entries: 'materialRegex' or { m: 'materialRegex', z: 'front'|'rear' } (front = +z half of the car)
  const res = {}; for (const k of Object.keys(meta.roles || {})) res[k] = meta.roles[k].map(e => typeof e === 'string' ? { r: new RegExp(e, 'i') } : { r: new RegExp(e.m, 'i'), z: e.z });
  const roleOf = (n, zc) => { for (const k of Object.keys(res)) if (res[k].some(e => e.r.test(n) && (!e.z || (e.z === 'front') === (zc > 0)))) return k; return null; };
  const bbox = new THREE.Box3(), ctr = new THREE.Vector3();
  const v = new THREE.Vector3(), nv = new THREE.Vector3(), nm = new THREE.Matrix3();
  const L = meta.L, halfL = L / 2, Wh = meta.W / 2, H = meta.H;
  scene.traverse(o => {
    if (!o.isMesh) return;
    o.userData.sharedGeo = true; const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bbox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); bbox.getCenter(ctr);
    const role = roleOf(mats[0].name, ctr.z); o.userData.role = role;
    if (role === 'paint' || role === 'hood' || role === 'roof') { // planar re-projection of the paint canvas: u = nose->tail, v = ring (side wall low band, top high band)
      const g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal; if (!nor) g.computeVertexNormals();
      const N = g.attributes.normal, uv = new Float32Array(pos.count * 2); nm.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); nv.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        const s = (halfL - v.z) / L, side = 0.07 + 0.24 * Math.min(1, Math.max(0, (v.y - 0.18) / (H * 0.72 - 0.18))), topv = 0.31 + 0.19 * (1 - Math.min(1, Math.abs(v.x) / Wh));
        const t = sstep(0.35, 0.85, Math.max(0, nv.y)), vv = side + (topv - side) * t;
        uv[i * 2] = Math.min(1, Math.max(0, s)); uv[i * 2 + 1] = v.x >= 0 ? vv : 1 - vv;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
  });
  return { scene, meta };
}
export function ensureCarAsset(id) {
  if (!hasModel(id)) return Promise.resolve(null);
  const c = cache.get(id); if (c instanceof Promise) return c; if (c && c !== 'fail') return Promise.resolve(c); if (c === 'fail') return Promise.resolve(null);
  const p = (async () => {
    try { const meta = await (await fetch(url(id + '.json'))).json(); const gltf = await loader.loadAsync(url(id + '.glb')); const a = prepareAsset(gltf, meta); cache.set(id, a); return a; }
    catch (e) { console.warn('model load failed', id, e.message); cache.set(id, 'fail'); return null; }
  })();
  cache.set(id, p); return p;
}
export const ensureCarAssets = ids => Promise.all([...new Set(ids)].map(ensureCarAsset));

export function makeCarModel(car, cfg, opts) { return modelReady(car.id) ? new GlbCarModel(car, cfg, opts) : new CarModel(car, cfg, opts); }

export class GlbCarModel extends CarModel {
  constructor(car, cfg, opts = {}) {
    const a = cache.get(car.id), m = a.meta;
    // render-side copy of the car data, fitted to the real model (wheel radius, track, wheelbase); game physics keeps using the original
    super({ ...car, wr: m.R, track: (m.trackF + m.trackR) / 2, W: m.W, wb: m.wzF - m.wzR }, cfg, opts); this.isGlb = true;
  }
  get asset() { return cache.get(this.car.id); }
  clearGroup(g) { while (g.children.length) { const o = g.children.pop(); o.traverse(n => { if (n.geometry && !n.userData.sharedGeo) n.geometry.dispose(); }); } }
  makeProfile() {
    const m = cache.get(this.car.id).meta, L = m.L, halfL = L / 2, NS = m.NS, NX = m.NX, Wh = m.Wh;
    const zOf = s => halfL - s * L;
    const topAt = (s, x) => {
      const fs = Math.min(NS, Math.max(0, s * NS)), i0 = Math.floor(fs), i1 = Math.min(NS, i0 + 1), ts = fs - i0;
      const fx = Math.min(NX - 1, Math.max(0, (x + Wh) / (2 * Wh) * (NX - 1))), j0 = Math.floor(fx), j1 = Math.min(NX - 1, j0 + 1), tx = fx - j0;
      const a = m.top[i0][j0] * (1 - tx) + m.top[i0][j1] * tx, b = m.top[i1][j0] * (1 - tx) + m.top[i1][j1] * tx; return a * (1 - ts) + b * ts;
    };
    const hwAt = s => { const f = Math.min(NS, Math.max(0, s * NS)), i = Math.floor(f), j = Math.min(NS, i + 1); return Math.max(0.4, m.hw[i] * (1 - (f - i)) + m.hw[j] * (f - i)); };
    this._topAt = topAt;
    const station = s => { const w = hwAt(s), yc = topAt(s, 0), y0 = 0.17, ys = Math.max(topAt(s, w * 0.8), topAt(s, w * 0.6), y0 + 0.14); return { s, z: zOf(s), w, y0, yc: Math.max(yc, y0 + 0.1), ys, nrnd: 1 }; };
    const roofY = s => { let r = 0; for (let j = 0; j < NX; j++) r = Math.max(r, m.top[Math.round(Math.min(1, Math.max(0, s)) * NS)][j]); return r; };
    return { zOf, wzF: m.wzF, wzR: m.wzR, deckY: s => topAt(s, 0), roofY, station, archR: m.R + 0.06, wy: m.wy, sill: 0.17 };
  }
  topY(s, x) { return this._topAt(s, x); }
  buildBody() {
    this.makeLampMats();
    const a = this.asset, g = a.scene.clone(true), cfg = this.cfg; this.bodyGeo = null; this.bodyPos0 = null;
    const two = cfg.paint.two, mode = cfg.paint.twoMode, spoilerSwap = cfg.parts.spoiler !== 'stock';
    g.traverse(o => {
      if (!o.isMesh) return; const r = o.userData.role; o.castShadow = true; o.receiveShadow = true;
      if (r === 'paint') o.material = this.paintMat;
      else if (r === 'hood') o.material = this.hoodMat();
      else if (r === 'roof') o.material = two && mode !== 'hood' ? this.paint2Mat : this.paintMat;
      else if (r === 'glass') { o.material = this.glass; o.renderOrder = 2; o.castShadow = false; }
      else if (r === 'head') o.material = this.headMat;
      else if (r === 'tail') o.material = this.tailMat;
      else if (r === 'plain') o.material = this.plainMat;
      else if (r === 'chrome') o.material = this.chromeMat;
      else if (r === 'black') o.material = this.blackMat;
      else if (r === 'carbon') o.material = this.carbonMat;
      else if (r === 'spoiler' && spoilerSwap) o.visible = false;
    });
    this.glbRoot = g; this.body.add(g);
  }
  buildDetails() { this.exhaustPos = [new THREE.Vector3(this.car.W * 0.22, 0.3, -this.car.L / 2 - 0.08)]; }
  makeLampMats() {
    const headCol = new THREE.Color(this.cfg.look.head);
    this.headMat = this.mat(new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: headCol, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.2 }));
    this.tailMat = this.mat(new THREE.MeshStandardMaterial({ color: 0x5a0008, emissive: 0xff1010, emissiveIntensity: 0.35, roughness: 0.2 }));
  }
  buildHood() { if (this.cfg.parts.hood === 'stock') return; super.buildHood(); }
  buildMirrors() { if (this.cfg.parts.mirrors === 'stock') return; super.buildMirrors(); }
  deform() {} resetDamage() {}
}
