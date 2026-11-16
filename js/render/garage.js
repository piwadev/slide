// The 3D street-garage: graffiti walls, polished reflective floor, red tool chests, couch, work lamps, paint booth, a car on a lift,
// and the hero car on a turntable. Used behind every menu screen and as the live customisation preview.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeCarModel, ensureCarAsset, hasModel, modelReady } from './glbCar.js';
import { trafficMesh } from '../game/traffic.js';
import { rng, canvasTex } from './kit.js';

const PAL = ['#19d3c5', '#ffd23f', '#9b5de5', '#ff7a1a', '#ff4fa3', '#3a86ff', '#7bff5a'];
const WORDS = ['SLIDE', 'DRIFT', 'KING', 'TOUGE', 'JDM', 'NITRO', 'SEND IT', 'HACHI', '走り屋', '峠', 'RISE', 'SMOKE', 'LOW', 'ONI', 'TOKYO'];
const FONTS = ['Bangers', 'Knewave', 'Permanent Marker', 'Rubik Spray Paint'];
function graffitiTex(seed, w = 2048, h = 1024, light = 0) {
  return canvasTex(w, h, (c) => {
    const R = rng(seed); const pick = a => a[Math.floor(R() * a.length)];
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b2f38'); g.addColorStop(1, '#1b1e24'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    // brick / panel lines
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3; for (let y = 0; y < h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = (y / 64 % 2) * 64; x < w; x += 128) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 64); c.stroke(); } }
    for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},${R() * 0.035})`; c.fillRect(R() * w, R() * h, 2 + R() * 6, 2 + R() * 6); }
    // big colour blocks (buffs)
    for (let i = 0; i < 6; i++) { c.save(); c.globalAlpha = 0.85; c.fillStyle = pick(PAL); c.beginPath(); const x = R() * w, y = R() * h * 0.7, rw = 260 + R() * 520, rh = 160 + R() * 280; c.ellipse(x, y, rw, rh, R() * 3, 0, 7); c.fill(); c.restore(); }
    c.fillStyle = 'rgba(14,16,22,0.38)'; c.fillRect(0, 0, w, h);
    // halftone patches
    for (let k = 0; k < 3; k++) { const x0 = R() * w, y0 = R() * h * 0.6, col = pick(PAL); c.fillStyle = col; for (let y = 0; y < 150; y += 12) for (let x = 0; x < 260; x += 12) { const d = Math.hypot(x - 130, y - 75) / 150; c.beginPath(); c.arc(x0 + x, y0 + y, Math.max(0.5, 5 * (1 - d)), 0, 7); c.fill(); } }
    // pieces
    const nPieces = 5 + Math.floor(R() * 3);
    for (let i = 0; i < nPieces; i++) {
      const word = pick(WORDS), font = pick(FONTS), size = 170 + R() * 190, x = 140 + R() * (w - 460), y = 200 + R() * (h - 520); const c1 = pick(PAL); let c2 = pick(PAL); while (c2 === c1) c2 = pick(PAL);
      c.save(); c.translate(x, y); c.rotate((R() - 0.5) * 0.22); c.font = `${size}px "${font}"`; c.lineJoin = 'round'; c.textBaseline = 'alphabetic';
      const tw = c.measureText(word).width;
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillText(word, 14, 16); c.strokeStyle = '#06070a'; c.lineWidth = size * 0.14; c.strokeText(word, 0, 0);
      const gg = c.createLinearGradient(0, -size, 0, size * 0.1); gg.addColorStop(0, c1); gg.addColorStop(1, c2); c.fillStyle = gg; c.fillText(word, 0, 0);
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = size * 0.02; c.strokeText(word, -size * 0.015, -size * 0.015);
      c.globalCompositeOperation = 'source-atop'; // (no-op on opaque bg but keeps code simple)
      c.globalCompositeOperation = 'source-over';
      for (let d = 0; d < 6; d++) { const dx = R() * tw, dl = 20 + R() * 110; c.strokeStyle = c1; c.lineWidth = 6 + R() * 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(dx, 8); c.lineTo(dx, 8 + dl); c.stroke(); }
      c.restore();
    }
    // splatters, stars, arrows
    for (let i = 0; i < 40; i++) { c.fillStyle = pick(PAL); const x = R() * w, y = R() * h, r = 3 + R() * 14; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + (R() - 0.5) * 70, y + (R() - 0.5) * 70, r * 0.3, 0, 7); c.fill(); } }
    for (let i = 0; i < 7; i++) { const x = R() * w, y = R() * h * 0.8, r = 22 + R() * 30; c.fillStyle = pick(PAL); c.strokeStyle = '#06070a'; c.lineWidth = 7; c.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.stroke(); c.fill(); }
    // hazard stripe + baseboard
    c.fillStyle = '#101216'; c.fillRect(0, h - 150, w, 150); for (let x = -40; x < w; x += 70) { c.fillStyle = '#ffcf33'; c.beginPath(); c.moveTo(x, h - 22); c.lineTo(x + 34, h - 22); c.lineTo(x + 54, h); c.lineTo(x + 20, h); c.fill(); }
    const vg = c.createLinearGradient(0, h - 260, 0, h - 150); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = vg; c.fillRect(0, h - 260, w, 110);
  });
}
function floorTex() { return canvasTex(1024, 1024, (c, w, h) => { const R = rng(3); c.fillStyle = '#17181c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 20 + R() * 28; c.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + R() * 0.3})`; c.fillRect(R() * w, R() * h, 2 + R() * 5, 2 + R() * 5); } c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke(); for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.2})`; c.beginPath(); c.ellipse(R() * w, R() * h, 20 + R() * 70, 10 + R() * 40, R() * 3, 0, 7); c.fill(); } for (let i = 0; i < 6; i++) { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 10 + R() * 8; c.beginPath(); const x = R() * w; c.moveTo(x, 0); c.bezierCurveTo(x + 80, h * 0.3, x - 80, h * 0.6, x + 30, h); c.stroke(); } }, { repeat: true }); }
function chestTex() { return canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#b3121c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { const y = 10 + i * 48; const g = c.createLinearGradient(0, y, 0, y + 42); g.addColorStop(0, '#d92330'); g.addColorStop(1, '#8a0d15'); c.fillStyle = g; c.fillRect(12, y, w - 24, 42); c.fillStyle = '#d9dde2'; c.fillRect(w / 2 - 40, y + 10, 80, 7); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(12, y + 40, w - 24, 3); } }); }
function doorTex() { return canvasTex(512, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#41464f'); g.addColorStop(1, '#262a31'); c.fillStyle = g; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 38) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, y, w, 3); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, y + 3, w, 6); } }); }
const lam = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1, ...o });
const emis = (c, i = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), toneMapped: false });

export class GarageScene {
  constructor(stage) {
    this.stage = stage; this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#0b0c10'); this.scene.fog = new THREE.Fog('#0b0c10', 22, 48);
    this.cam = new THREE.PerspectiveCamera(36, 1.6, 0.1, 120); this.yaw0 = 0.35; this.view = { a: 0.62, e: 0.12, d: 7.4, h: 0.62, tx: 0, tz: 0 }; this.tgt = { ...this.view }; this.auto = true; this.offsetX = 0; this.t = 0; this.model = null; this.prevTraffic = null;
    RectAreaLightUniformsLib.init(); this.build();
    this.bindPointer();
  }
  build() {
    const s = this.scene, W = 26, D = 21, H = 7.2;
    // floor: reflector + dark polished overlay
    const rf = this.refl = new Reflector(new THREE.PlaneGeometry(W, D), { textureWidth: 1024, textureHeight: 1024, color: 0x777788, clipBias: 0.003 }); rf.rotation.x = -Math.PI / 2; rf.position.set(0, 0, 0); s.add(rf);
    const ft = floorTex(); ft.repeat.set(4, 3);
    this.floorMat = new THREE.MeshStandardMaterial({ map: ft, transparent: true, opacity: 0.8, roughness: 0.35, metalness: 0.0, envMapIntensity: 0.6 }); const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.floorMat); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.003; fl.receiveShadow = true; s.add(fl); this.floor = fl;
    // walls
    const wall = (tex, w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.34 })); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; s.add(m); return m; };
    wall(graffitiTex(11), W, H, 0, H / 2, -D / 2, 0); wall(graffitiTex(23, 2048, 1024), D, H, -W / 2, H / 2, 0, Math.PI / 2); wall(graffitiTex(37), D, H, W / 2, H / 2, 0, -Math.PI / 2);
    const dt = doorTex(); dt.wrapS = dt.wrapT = THREE.RepeatWrapping; wall(graffitiTex(51), W, H, 0, H / 2, D / 2, Math.PI);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshStandardMaterial({ map: dt, roughness: 0.5, metalness: 0.5 })); door.position.set(-4.5, 2.6, D / 2 - 0.02); door.rotation.y = Math.PI; s.add(door);
    // ceiling + beams
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), lam('#0d0e12', { roughness: 0.95 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; s.add(ceil);
    const beamM = lam('#1c1f26', { metalness: 0.6, roughness: 0.5 }); for (let x = -10; x <= 10; x += 5) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, D), beamM); b.position.set(x, H - 0.25, 0); s.add(b); }
    // overhead strip lights (emissive) + real rect lights
    this.rects = [];
    for (const [x, z] of [[-3.2, -1.5], [3.2, -1.5], [0, 3.8], [0, -5.5]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.1, 0.5), emis('#f4f9ff', 2.2)); m.position.set(x, H - 0.55, z); s.add(m); }
    const mkRect = (col, inten, w, h, x, y, z, tx, ty, tz) => { const l = new THREE.RectAreaLight(new THREE.Color(col), inten, w, h); l.position.set(x, y, z); l.lookAt(tx, ty, tz); s.add(l); this.rects.push(l); return l; };
    mkRect('#ffffff', 2.0, 6, 1.4, 0, 6.2, 0, 0, 0, 0); mkRect('#cfe6ff', 1.6, 5, 1.2, -5, 5.5, 3.5, 0, 0.4, 0); mkRect('#ffb06a', 1.4, 1.4, 5, 8.5, 3.2, 0, 0, 0.6, 0); mkRect('#ff3d9a', 1.0, 1.2, 4, -9.5, 3, -1, 0, 0.5, 0);
    s.add(new THREE.HemisphereLight('#7f8bb0', '#1a1716', 0.55));
    const spot = this.spot = new THREE.SpotLight('#fff3e0', 55, 30, 0.7, 0.6, 1.4); spot.position.set(2.5, 6.6, 3.5); spot.target.position.set(0, 0.3, 0); spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.03; s.add(spot, spot.target);
    // turntable
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.08, 64), lam('#1d1f25', { roughness: 0.3, metalness: 0.6 })); pad.position.y = 0.04; pad.receiveShadow = true; s.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.42, 0.035, 8, 96).rotateX(Math.PI / 2), emis('#ff8a1a', 1.6)); ring.position.y = 0.085; s.add(ring);
    // lift + decor car (back left)
    const lift = new THREE.Group(); lift.position.set(-7.4, 0, -6.2); lift.rotation.y = 0.3; s.add(lift);
    const steel = lam('#2e323a', { metalness: 0.8, roughness: 0.35 }), yel = lam('#f2b705', { roughness: 0.45, metalness: 0.2 });
    for (const sx of [-2.4, 2.4]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 5.4, 0.5), yel); p.position.set(sx, 2.7, 0); p.castShadow = true; lift.add(p); const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 1.5), steel); base.position.set(sx, 0.05, 0); lift.add(base); for (const z of [-1.2, 1.2]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 1.6), steel); arm.position.set(sx * 0.62, 2.35, z * 0.55); arm.rotation.y = z * 0.3; lift.add(arm); } }
    const top = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 0.55), yel); top.position.set(0, 5.4, 0); lift.add(top);
    const dc = trafficMesh('#1d6fe0'); dc.position.set(0, 2.45, 0); dc.rotation.y = Math.PI / 2; dc.scale.set(1.05, 1.05, 1.1); lift.add(dc); this.liftCar = dc;
    // tool chests along the left wall
    const ct = chestTex(); const chestM = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.38, metalness: 0.5, envMapIntensity: 1.2 });
    const chest = (x, z, w, h, d, ry = Math.PI / 2) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.04), chestM); m.position.set(x, h / 2 + 0.02, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; s.add(m); const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.05, d + 0.04), lam('#8d9198', { metalness: 0.9, roughness: 0.25 })); top.position.set(x, h + 0.04, z); top.rotation.y = ry; s.add(top); return m; };
    chest(-11.5, -2.2, 1.3, 1.5, 0.9); chest(-11.5, -3.6, 1.3, 1.1, 0.9); chest(-11.5, 0.6, 1.3, 2.1, 0.9); chest(-11.55, -0.9, 0.9, 0.9, 0.7);
    // props on chests
    for (const [x, z, h] of [[-11.5, 0.6, 2.2], [-11.5, -2.2, 1.6]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.4, 12), lam('#e9ecef')); l.position.set(x, h + 0.2, z); s.add(l); }
    // couch (right side)
    const red = lam('#a3121b', { roughness: 0.65 }), couch = new THREE.Group(); couch.position.set(11.0, 0, 3.5); couch.rotation.y = -Math.PI / 2; s.add(couch);
    const cb = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, 0.12), red); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; couch.add(m); return m; };
    cb(3.1, 0.45, 1.1, 0, 0.3, 0); cb(3.1, 0.95, 0.35, 0, 0.8, -0.5); cb(0.35, 0.75, 1.1, -1.5, 0.55, 0); cb(0.35, 0.75, 1.1, 1.5, 0.55, 0); cb(1.4, 0.2, 0.9, -0.7, 0.62, 0.05); cb(1.4, 0.2, 0.9, 0.7, 0.62, 0.05);
    const table = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.4, 0.8, 3, 0.04), lam('#22252b', { metalness: 0.6, roughness: 0.3 })); table.position.set(8.9, 0.22, 3.5); table.rotation.y = Math.PI / 2; s.add(table);
    // neon sign above couch
    const neonC = document.createElement('canvas'); neonC.width = 512; neonC.height = 160; const nx = neonC.getContext('2d'); nx.font = '110px "Knewave"'; nx.textAlign = 'center'; nx.shadowColor = '#ff2d95'; nx.shadowBlur = 28; nx.fillStyle = '#ffd1ea'; nx.fillText('slide', 256, 115); nx.shadowColor = '#19d3ff'; nx.shadowBlur = 16; nx.strokeStyle = '#19d3ff'; nx.lineWidth = 3; nx.strokeText('slide', 256, 115); const nt = new THREE.CanvasTexture(neonC); nt.colorSpace = THREE.SRGBColorSpace; const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.25), new THREE.MeshBasicMaterial({ map: nt, transparent: true, toneMapped: false })); sign.position.set(12.9, 3.6, 3.5); sign.rotation.y = -Math.PI / 2; s.add(sign);
    const sl = new THREE.PointLight('#ff2d95', 8, 9, 1.8); sl.position.set(11.8, 3.4, 3.5); s.add(sl);
    // paint booth (back right): translucent walls + fluorescent strips
    const booth = new THREE.Group(); booth.position.set(7.2, 0, -6.4); s.add(booth);
    const plast = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.18, roughness: 0.25, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    for (const [w, h, x, z, ry] of [[6, 3.6, 0, -3, 0], [6, 3.6, -3, 0, Math.PI / 2], [6, 3.6, 3, 0, Math.PI / 2]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), plast); p.position.set(x, h / 2, z); p.rotation.y = ry; booth.add(p); }
    const frame = lam('#9aa0a8', { metalness: 0.9, roughness: 0.3 }); for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.7, 0.1), frame); p.position.set(x, 1.85, z); booth.add(p); }
    for (const [x, z] of [[-2.9, 0], [2.9, 0], [0, -2.9]]) { const tube = new THREE.Mesh(new THREE.BoxGeometry(x ? 0.07 : 4.6, 0.07, x ? 4.6 : 0.07), emis('#eaf6ff', 2.4)); tube.position.set(x, 3.4, z); booth.add(tube); }
    const bl = new THREE.PointLight('#cfe6ff', 8, 11, 1.7); bl.position.set(0, 3.2, 0); booth.add(bl);
    const hanging = lam('#d7dce2', { roughness: 0.4, metalness: 0.3 }); const panel = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.25, 1.2, 2, 0.05), hanging); panel.position.set(0, 0.5, -1.2); booth.add(panel);
    // work lamps on tripods
    this.lamps = []; for (const [x, z, ry] of [[-6.2, 5.2, 0.7], [6.0, 5.4, -0.7], [-4.2, -4.6, 0.3]]) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; s.add(g); const leg = lam('#2a2d33', { metalness: 0.7 }); for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.9, 6), leg); const a = i * Math.PI * 2 / 3; l.position.set(Math.cos(a) * 0.25, 0.9, Math.sin(a) * 0.25); l.rotation.set(Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14); g.add(l); } const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), leg); pole.position.y = 1.7; g.add(pole); const head = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.5, 0.18, 2, 0.04), lam('#f2b705')); head.position.y = 2.55; head.rotation.x = 0.35; g.add(head); const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), emis('#fff3d8', 3.2)); bulb.position.set(0, 0, 0.1); head.add(bulb); const pl = new THREE.PointLight('#ffe6b0', 6, 10, 1.6); pl.position.set(0, 2.5, 0.5); g.add(pl); }
    // oil drums + tyres + posters
    const drum = lam('#1b4d9a', { metalness: 0.6, roughness: 0.4 }); for (const [x, z] of [[-9.5, 6.5], [-9.0, 7.3], [-10, 7.5]]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.95, 16), drum); d.position.set(x, 0.48, z); d.castShadow = true; s.add(d); }
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.17, 12, 28), lam('#0c0c0e', { roughness: 0.9 })); for (let i = 0; i < 4; i++) { const t = tyre.clone(); t.rotation.x = Math.PI / 2; t.position.set(9.6, 0.17 + i * 0.34, 8.2); t.rotation.z = i * 0.4; s.add(t); }
    this.carSlot = new THREE.Group(); s.add(this.carSlot);
    // environment from the room itself (graffiti + strip lights reflect in the paint)
    const pm = new THREE.PMREMGenerator(this.stage.renderer); this.refl.visible = false; this.scene.environment = null; this.envRT = pm.fromScene(this.scene, 0.03, 0.1, 80, { size: 256, position: new THREE.Vector3(0, 1.4, 0) }); this.refl.visible = true; this.scene.environment = this.envRT.texture; this.scene.environmentIntensity = 0.9; pm.dispose();
  }
  // ---------------------------------------------------------------- car
  setCar(car, cfg, opts = {}) {
    if (this.model) { this.carSlot.remove(this.model.root); this.model.dispose(); this.model = null; }
    this.car = car; this.cfg = cfg; const m = this.model = makeCarModel(car, cfg, { low: false }); m.root.position.y = 0.08; this.carSlot.add(m.root); m.root.rotation.y = this.yaw0;
    m.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.setLiftCar(opts.lift);
    if (hasModel(car.id) && !modelReady(car.id)) ensureCarAsset(car.id).then(a => { if (a && this.car === car && this.model === m) this.setCar(car, this.cfg, opts); });
    return m;
  }
  setLiftCar() {}
  refreshCar(cfg) { if (!this.model) return; this.cfg = cfg || this.cfg; this.model.rebuild(this.cfg); this.model.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); }
  // view presets: a=azimuth (rad, 0 = car nose), e=elevation, d=distance, h=target height, tx/tz target offset (car-local)
  preset(name) {
    const c = this.car; const L = c ? c.L : 4.5; const P = {
      menu: { a: 0.62, e: 0.09, d: L * 2.5 + 0.8, h: 0.05, tx: 0, tz: 0 }, hero: { a: 0.62, e: 0.15, d: L * 2.0 + 0.6, h: 0.66, tx: 0, tz: 0 }, side: { a: 1.571, e: 0.06, d: L * 1.8, h: 0.6, tx: 0, tz: 0 }, front: { a: 0.0, e: 0.1, d: L * 1.5, h: 0.6, tx: 0, tz: 0 }, rear: { a: 3.14 + 0.45, e: 0.14, d: L * 1.5, h: 0.75, tx: 0, tz: 0 },
      wheelF: { a: 1.15, e: 0.08, d: 2.6, h: 0.38, tx: 0, tz: c ? this.model.geom.wzF : 1.4 }, wheelR: { a: 1.9, e: 0.08, d: 2.6, h: 0.38, tx: 0, tz: c ? this.model.geom.wzR : -1.4 }, top: { a: 0.6, e: 1.1, d: L * 1.9, h: 0.3, tx: 0, tz: 0 }, hood: { a: 0.25, e: 0.35, d: L * 1.2, h: 0.8, tx: 0, tz: L * 0.25 }, low: { a: 0.3, e: 0.03, d: L * 1.2, h: 0.4, tx: 0, tz: L * 0.3 },
    };
    return P[name] || P.hero;
  }
  go(name, instant = false) { this.tgt = { ...this.preset(name) }; this.presetName = name; if (instant) this.view = { ...this.tgt }; this.auto = name === 'hero' || name === 'menu'; }
  bindPointer() {
    const cv = this.stage.canvas; let down = false, lx = 0, ly = 0;
    cv.addEventListener('pointerdown', e => { if (!this.active) return; down = true; lx = e.clientX; ly = e.clientY; this.auto = false; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (!down) return; this.tgt.a -= (e.clientX - lx) * 0.006; this.tgt.e = Math.max(0.0, Math.min(1.35, this.tgt.e + (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; this.idle = 0; });
    cv.addEventListener('pointerup', () => { down = false; this.idle = 0; });
    cv.addEventListener('wheel', e => { if (!this.active) return; this.tgt.d = Math.max(2.2, Math.min(14, this.tgt.d * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: true });
  }
  enter(opts = {}) { this.active = true; this.stage.setQuality(opts.quality || this.stage.quality); this.stage.renderer.shadowMap.enabled = true; this.stage.use(this.scene, this.cam, { exposure: 0.78, bloom: [0.22, 0.5, 1.05] }); this.spot.castShadow = this.stage.q.shadow > 0; this.refl.visible = this.stage.quality !== 'low'; this.floorMat.opacity = this.refl.visible ? 0.8 : 1; this.idle = 0; this.resize(); }
  leave() { this.active = false; }
  resize() { const { w, h } = this.stage.size(); this.cam.aspect = w / h; this.applyOffset(); }
  setOffset(fx) { this.offsetTarget = fx; if (this.offsetX === undefined) this.offsetX = fx; }
  applyOffset() { const { w, h } = this.stage.size(); const px = Math.round(-(this.offsetX || 0) * w); if (px) this.cam.setViewOffset(w, h, px, 0, w, h); else this.cam.clearViewOffset(); this.cam.updateProjectionMatrix(); }
  update(dt) {
    if (!this.active) return; this.t += dt; const v = this.view, g = this.tgt; const k = 1 - Math.exp(-dt * 4.5);
    if (this.auto) { this.tgt.a += dt * 0.11; } else { this.idle = (this.idle || 0) + dt; }
    for (const key of ['a', 'e', 'd', 'h', 'tx', 'tz']) v[key] += (g[key] - v[key]) * k;
    if (this.offsetTarget !== undefined && Math.abs(this.offsetTarget - this.offsetX) > 0.0005) { this.offsetX += (this.offsetTarget - this.offsetX) * (1 - Math.exp(-dt * 5)); this.applyOffset(); }
    const ya = this.yaw0, a = v.a + ya; const tx = Math.sin(ya) * v.tz, tz = Math.cos(ya) * v.tz;
    const cp = Math.cos(v.e) * v.d; this.cam.position.set(tx + Math.sin(a) * cp, v.h + Math.sin(v.e) * v.d + 0.1, tz + Math.cos(a) * cp); this.cam.lookAt(tx, v.h, tz);
    if (this.model) { this.model.tick(dt, this.t); const m = this.model; m.setWheelSteer(Math.sin(this.t * 0.7) * 0.0); if (this.revT > 0) { this.revT -= dt; } }
    this.spot.position.x = 2.5 + Math.sin(this.t * 0.2) * 0.6;
  }
  render() { this.stage.render(); }
  dispose() { /* garage lives for the app's lifetime */ }
}
