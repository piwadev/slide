// Ambient traffic (Tokyo) and the tandem lead car (kinematic path follower with a faked drift angle).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COLORS = ['#d8d8dc', '#1b1d22', '#8a1c1c', '#1d3d73', '#c9b27c', '#3b6b4a', '#e4e4e4', '#444a52', '#b25a1e'];
let GEO = null;
function geos() { if (GEO) return GEO; GEO = { body: new RoundedBoxGeometry(1.76, 0.62, 4.2, 3, 0.18).translate(0, 0.62, 0), cab: new RoundedBoxGeometry(1.5, 0.5, 2.2, 3, 0.2).translate(0, 1.12, -0.2), glass: new RoundedBoxGeometry(1.52, 0.38, 2.24, 3, 0.18).translate(0, 1.13, -0.2), wheel: new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14).rotateZ(Math.PI / 2), tail: new THREE.BoxGeometry(1.5, 0.1, 0.05), box: new THREE.BoxGeometry(1, 1, 1) }; return GEO; }
export function trafficMesh(col, kind = 0) {
  const g = geos(); const grp = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.35, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.06 });
  const body = new THREE.Mesh(g.body, paint); body.castShadow = true; grp.add(body);
  const cab = new THREE.Mesh(g.cab, paint); cab.castShadow = true; grp.add(cab);
  const gl = new THREE.Mesh(g.glass, new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.1, metalness: 0.5 })); gl.scale.set(1.01, 0.8, 0.98); grp.add(gl);
  const tire = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9 });
  for (const [x, z] of [[-0.86, 1.3], [0.86, 1.3], [-0.86, -1.3], [0.86, -1.3]]) { const w = new THREE.Mesh(g.wheel, tire); w.position.set(x, 0.33, z); grp.add(w); }
  const tail = new THREE.Mesh(g.tail, new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); tail.position.set(0, 0.78, -2.12); grp.add(tail);
  const head = new THREE.Mesh(g.tail, new THREE.MeshBasicMaterial({ color: 0xfff2d0, toneMapped: false })); head.position.set(0, 0.74, 2.12); head.scale.set(0.9, 1, 1); grp.add(head);
  return grp;
}
export class Traffic {
  constructor(world, scene, count) {
    this.w = world; this.cars = []; this.group = new THREE.Group(); scene.add(this.group); const p = world.path; const lanes = world.trafficLanes || [-3.2, 3.2];
    for (let i = 0; i < count; i++) { const lane = lanes[i % lanes.length]; const dir = lane < 0 ? 1 : -1; const mesh = trafficMesh(COLORS[i % COLORS.length]); this.group.add(mesh);
      this.cars.push({ s: (p.length * (i + 0.5) / count + 40) % p.length, lane, dir, v: 8 + Math.random() * 5, vTarget: 8 + Math.random() * 5, mesh, x: 0, z: 0, vx: 0, vz: 0, yaw: 0, r: 1.0, hit: 0, near: false, counted: 0 }); }
    this.update(0);
  }
  update(dt) {
    const p = this.w.path;
    for (const c of this.cars) {
      c.hit = Math.max(0, c.hit - dt); c.v += (c.vTarget * (c.hit > 0 ? 0.2 : 1) - c.v) * Math.min(1, dt * 1.5);
      c.s = (c.s + c.dir * c.v * dt + p.length) % p.length; const q = p.at(c.s);
      const x = q.x + q.nx * c.lane, z = q.z + q.nz * c.lane; c.vx = (x - c.x) / Math.max(dt, 1e-4) * (dt ? 1 : 0); c.vz = (z - c.z) / Math.max(dt, 1e-4) * (dt ? 1 : 0); c.x = x; c.z = z;
      c.yaw = Math.atan2(q.tx * c.dir, q.tz * c.dir); c.mesh.position.set(x, q.y, z); c.mesh.rotation.y = c.yaw;
    }
  }
  // circles for collision (two per car)
  circles() { const out = []; for (const c of this.cars) { const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw); for (const o of [1.25, -1.25]) out.push({ x: c.x + sy * o, z: c.z + cy * o, r: 0.95, vx: c.vx, vz: c.vz, ref: c }); } return out; }
  dispose() { this.group.parent && this.group.parent.remove(this.group); this.group.traverse(o => { if (o.material) o.material.dispose(); }); }
}
export class LeadCar {
  constructor(world, model, fx) {
    this.w = world; this.model = model; this.fx = fx; const p = world.path; this.s = world.spawn.s + 16; this.v = 0; this.slip = 0; this.sign = 1; this.x = 0; this.z = 0; this.yaw = 0; this.spd = 0; this.puff = 0; this.t = 0; this.ready = false;
    this.place();
  }
  place() { const q = this.w.path.at(this.s); this.x = q.x; this.z = q.z; this.yaw = Math.atan2(q.tx, q.tz); this.apply(q); }
  apply(q) { const m = this.model.root; m.position.set(this.x, q.y, this.z); m.rotation.y = this.yaw; }
  update(dt, playerS, playerDist, go = true) {
    const p = this.w.path; this.t += dt; const q = p.at(this.s); let kmax = 0; for (let d = 0; d < 40; d += 8) kmax = Math.max(kmax, Math.abs(p.at(this.s + d).k)); const k = q.k;
    let vmax = clamp(Math.sqrt(10.5 / Math.max(0.0025, kmax)), 13, 36); if (this.w.id === 'desert') vmax = clamp(vmax, 24, 44);
    let gap = playerDist; const rubber = gap > 45 ? 0.55 : gap > 28 ? 0.8 : gap < 7 ? 1.12 : 1; vmax *= rubber;
    if (!go) vmax = 0;
    this.v += clamp(vmax - this.v, -14 * dt, 7.5 * dt); this.s = (this.s + this.v * dt) % p.length; const q2 = p.at(this.s);
    const slipT = clamp(Math.abs(q2.k) * this.v * 0.55, 0, 0.78) * (this.v > 10 ? 1 : 0); const sg = Math.sign(q2.k) || 1;
    this.slip += (slipT * sg - this.slip) * Math.min(1, dt * 5);
    const off = clamp(-q2.k * 55, -2.2, 2.2); // drift line a little wide on exits
    this.x = q2.x + q2.nx * off; this.z = q2.z + q2.nz * off; this.yaw = Math.atan2(q2.tx, q2.tz) + this.slip; this.spd = this.v; this.apply(q2);
    const m = this.model; m.spinWheels(this.v * dt); m.setWheelSteer(clamp(-this.slip * 1.1, -0.5, 0.5));
    // smoke + skids
    const a = Math.abs(this.slip); if (a > 0.22 && this.fx) { this.puff += dt; const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw); const c = this.model.car; for (const sx of [-1, 1]) { const wx = this.x - sy * c.wb * 0.5 + cy * sx * c.track * 0.5, wz = this.z - cy * c.wb * 0.5 - sy * sx * c.track * 0.5; if (Math.random() < dt * 50) this.fx.smokePuff(wx, q2.y, wz, Math.sin(this.yaw - this.slip) * this.v * 0.4, Math.cos(this.yaw - this.slip) * this.v * 0.4, 1.3 + a, 0.35); this.fx.skid(10 + (sx > 0 ? 1 : 0), wx, q2.y, wz, 0.3, clamp(a * 1.2, 0, 0.8), cy, -sy); } }
    else if (this.fx) { this.fx.skid(10, 0, 0, 0, 0, 0, 0, 0); this.fx.skid(11, 0, 0, 0, 0, 0, 0, 0); }
  }
}
