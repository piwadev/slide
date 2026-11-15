// Procedural wheel/tyre/brake generation. A wheel is built along the +X axis (face looks toward +X); left wheels get rotated 180deg.
import * as THREE from 'three';
import { WHEEL_DESIGNS, TIRES, itemOf } from '../data/parts.js';

export const FINISH_MAT = {
  gloss: { metalness: 0.75, roughness: 0.28 }, chrome: { metalness: 1, roughness: 0.05 }, matte: { metalness: 0.4, roughness: 0.75 },
  satin: { metalness: 0.8, roughness: 0.45 }, bronze: { metalness: 0.9, roughness: 0.3 },
};
const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.88, metalness: 0 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x070708, roughness: 0.9, metalness: 0.1 });

function lathe(pts, seg) { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg); g.rotateZ(-Math.PI / 2); return g; } // axis -> +X

export function tireGeometry(R, rimR, w, seg = 36) {
  const sw = R - rimR, h = w / 2;
  const pts = [[rimR - 0.012, -h * 0.82], [rimR + 0.004, -h * 0.94], [rimR + sw * 0.35, -h * 1.0], [rimR + sw * 0.78, -h * 0.97], [R - 0.008, -h * 0.82], [R, -h * 0.55], [R + 0.001, -h * 0.2], [R + 0.001, h * 0.2], [R, h * 0.55], [R - 0.008, h * 0.82], [rimR + sw * 0.78, h * 0.97], [rimR + sw * 0.35, h * 1.0], [rimR + 0.004, h * 0.94], [rimR - 0.012, h * 0.82]];
  return lathe(pts, seg);
}

function spokeGeo(design, r0, r1, thick) {
  const sp = design.sp; const wBase = design.w; const pts = [];
  const N = 6; const left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, r = r0 + (r1 - r0) * t, w = (wBase * (1 - t * (1 - design.taper)) * r1) * (design.split ? 0.5 : 1) * (design.mesh ? 0.9 : 1);
    const th = (design.twist || 0) * t, nx = Math.cos(th + Math.PI / 2), ny = Math.sin(th + Math.PI / 2);
    const cx = Math.cos(th) * r, cy = Math.sin(th) * r;
    left.push([cx + nx * w / 2, cy + ny * w / 2]); right.push([cx - nx * w / 2, cy - ny * w / 2]);
  }
  const shape = new THREE.Shape(); shape.moveTo(left[0][0], left[0][1]); for (const p of left) shape.lineTo(p[0], p[1]); for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i][0], right[i][1]); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, steps: 1 });
  return g; // extruded along +Z in shape plane XY
}

// returns { spin: Group (tyre+rim+disc), rimMat, lipMat }
export function buildWheel(car, wcfg, axle, quality = 'high') {
  const design = itemOf(WHEEL_DESIGNS, wcfg.design), tire = itemOf(TIRES, wcfg.tire);
  const R = car.wr, rimR = wcfg.size * 0.0254 / 2 * 0.98;
  const wExtra = (axle === 'F' ? wcfg.widthF : wcfg.widthR) || 0;
  const tw = (0.215 + wExtra * 0.001) * (tire.id === 'stretch' ? 0.8 : tire.id === 'slick' || tire.id === 'semi' ? 1.1 : 1) * (car.W > 1.85 ? 1.12 : 1);
  const rw = tw * 0.92; // rim width
  const g = new THREE.Group();
  const seg = quality === 'high' ? 40 : 20;
  const tireMesh = new THREE.Mesh(tireGeometry(R, rimR, tw, seg), rubber); tireMesh.castShadow = true; g.add(tireMesh);
  const fm = FINISH_MAT[wcfg.finish] || FINISH_MAT.gloss;
  const rimMat = new THREE.MeshPhysicalMaterial({ color: wcfg.color, metalness: fm.metalness, roughness: fm.roughness, clearcoat: wcfg.finish === 'gloss' ? 0.6 : 0, envMapIntensity: 1.2 });
  const lipMat = new THREE.MeshStandardMaterial({ color: wcfg.lip || wcfg.color, metalness: 0.9, roughness: 0.18, envMapIntensity: 1.3 });
  // barrel: dark inner + outer lip
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.985, rimR * 0.985, rw * 0.96, seg, 1, true), darkMat); barrel.rotation.z = Math.PI / 2; g.add(barrel);
  const dish = design.dish || 0, lipw = design.lipw || 0.012;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR + 0.002, lipw * 0.55 + (dish ? 0.006 : 0), 8, seg * 2), dish > 0.02 ? lipMat : rimMat); lip.rotation.y = Math.PI / 2; lip.position.x = rw / 2 - 0.004; g.add(lip);
  if (dish > 0.02) { const lip2 = lip.clone(); lip2.position.x = -rw / 2 + 0.004; g.add(lip2); const ring = new THREE.Mesh(new THREE.CylinderGeometry(rimR + 0.004, rimR + 0.004, dish + 0.02, seg, 1, true), lipMat); ring.rotation.z = Math.PI / 2; ring.position.x = rw / 2 - dish / 2 - 0.01; g.add(ring); }
  // face plate position (concave: slightly inboard)
  const faceX = rw / 2 - 0.03 - dish * 0.55;
  const face = new THREE.Group(); face.position.x = faceX; g.add(face);
  // dark disc behind spokes
  const back = new THREE.Mesh(new THREE.CircleGeometry(rimR * 0.97, seg), darkMat); back.rotation.y = Math.PI / 2; back.position.x = -0.035; face.add(back);
  const hubR = rimR * 0.2;
  if (design.disc) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.95, rimR * 0.95, 0.018, seg), rimMat); disc.rotation.z = Math.PI / 2; face.add(disc);
    const holes = design.id === 'steel' ? 8 : 0;
    for (let i = 0; i < holes; i++) { const a = i / holes * Math.PI * 2; const h = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.1, rimR * 0.1, 0.02, 10), darkMat); h.rotation.z = Math.PI / 2; h.position.set(0.004, Math.cos(a) * rimR * 0.62, Math.sin(a) * rimR * 0.62); face.add(h); }
    if (design.id === 'vortex') for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; const sl = new THREE.Mesh(new THREE.BoxGeometry(0.02, rimR * 0.2, 0.012), darkMat); sl.position.set(0.004, Math.cos(a) * rimR * 0.82, Math.sin(a) * rimR * 0.82); sl.rotation.x = -a; face.add(sl); }
  } else {
    const sg = spokeGeo(design, hubR * 0.7, rimR * 0.96, 0.022);
    const n = design.sp, copies = design.split ? 2 : 1;
    for (let i = 0; i < n; i++) for (let c = 0; c < copies; c++) {
      const m = new THREE.Mesh(sg, rimMat); m.rotation.x = 0; // shape in XY, depth Z -> need radial in YZ plane, depth along X
      const holder = new THREE.Object3D(); holder.rotation.x = (i / n) * Math.PI * 2 + (c ? 0.17 : 0); holder.add(m); m.rotation.y = -Math.PI / 2; m.position.x = 0.011; // radial along +Y after rotation? set below
      // geometry: radial along +X(shape)->after rotateY(-90deg) radial along +Z..., fix by rotating holder around X: radial points along Z; fine since symmetric
      face.add(holder);
    }
    if (design.mesh) { const ring = new THREE.Mesh(new THREE.TorusGeometry(rimR * 0.55, 0.008, 6, 36), rimMat); ring.rotation.y = Math.PI / 2; face.add(ring); }
    if (design.sp >= 10 && !design.mesh) { const ring = new THREE.Mesh(new THREE.TorusGeometry(rimR * 0.9, 0.007, 6, 40), rimMat); ring.rotation.y = Math.PI / 2; ring.position.x = 0.01; face.add(ring); }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR * 1.05, 0.03, 20), rimMat); hub.rotation.z = Math.PI / 2; hub.position.x = 0.012; face.add(hub);
  const nutMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 1, roughness: 0.2 });
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const n = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6), nutMat); n.rotation.z = Math.PI / 2; n.position.set(0.026, Math.cos(a) * hubR * 0.62, Math.sin(a) * hubR * 0.62); face.add(n); }
  // brake disc (spins) 
  const bd = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.8, rimR * 0.8, 0.022, seg), new THREE.MeshStandardMaterial({ color: 0x6d7177, metalness: 0.9, roughness: 0.4 })); bd.rotation.z = Math.PI / 2; bd.position.x = -rw * 0.28; g.add(bd);
  return { spin: g, tw, rw, rimR, R, rimMat, lipMat };
}

export function buildCaliper(rimR, colHex, level, tw) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.05 + level * 0.012, rimR * 0.46, rimR * 0.34 + level * 0.02), new THREE.MeshStandardMaterial({ color: colHex, roughness: 0.35, metalness: 0.4 }));
  m.position.set(-tw * 0.24, 0, rimR * 0.62); // behind face, at the rear of the disc
  return m;
}
