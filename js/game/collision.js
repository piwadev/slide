// Collision world: wall segments + circles in a spatial hash, car as 3 circles (front/mid/rear). Impulse response with yaw torque.
export class Collider {
  constructor(world) {
    this.cell = 16; this.grid = new Map(); this.segs = world.segs; this.circles = world.circles.slice(); this.dyn = [];
    const add = (k, v) => { let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(v); };
    const c = this.cell;
    world.segs.forEach((s, i) => { const len = Math.hypot(s[2] - s[0], s[3] - s[1]); const n = Math.max(1, Math.ceil(len / (c * 0.5))); const seen = new Set(); for (let k = 0; k <= n; k++) { const x = s[0] + (s[2] - s[0]) * k / n, z = s[1] + (s[3] - s[1]) * k / n; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const key = (Math.floor(x / c) + dx) + ',' + (Math.floor(z / c) + dz); if (!seen.has(key)) { seen.add(key); add(key, i); } } } });
    this.bounds = world.bounds || null;
  }
  // circle test around (px,pz) radius r; returns {nx,nz,pen,x,z} deepest contact or null
  query(px, pz, r, out) {
    const key = Math.floor(px / this.cell) + ',' + Math.floor(pz / this.cell); const a = this.grid.get(key); let best = null;
    if (a) for (const i of a) { const s = this.segs[i]; const ax = s[0], az = s[1], bx = s[2], bz = s[3]; const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9; let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const cx = ax + dx * t, cz = az + dz * t; const ex = px - cx, ez = pz - cz, d2 = ex * ex + ez * ez; const rr = r + 0.12; if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-6; const pen = rr - d; if (!best || pen > best.pen) best = { nx: ex / d, nz: ez / d, pen, x: cx, z: cz, wall: true }; } }
    for (const c of this.circles) { const ex = px - c.x, ez = pz - c.z; if (Math.abs(ex) > c.r + r || Math.abs(ez) > c.r + r) continue; const d2 = ex * ex + ez * ez, rr = r + c.r; if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-6; const pen = rr - d; if (!best || pen > best.pen) best = { nx: ex / d, nz: ez / d, pen, x: c.x + ex / d * c.r, z: c.z + ez / d * c.r, wall: true }; } }
    if (this.bounds) { const b = this.bounds; const m = r + 0.2; if (px < b.x0 + m) best = pick(best, { nx: 1, nz: 0, pen: b.x0 + m - px, x: b.x0, z: pz, wall: true }); if (px > b.x1 - m) best = pick(best, { nx: -1, nz: 0, pen: px - (b.x1 - m), x: b.x1, z: pz, wall: true }); if (pz < b.z0 + m) best = pick(best, { nx: 0, nz: 1, pen: b.z0 + m - pz, x: px, z: b.z0, wall: true }); if (pz > b.z1 - m) best = pick(best, { nx: 0, nz: -1, pen: pz - (b.z1 - m), x: px, z: b.z1, wall: true }); }
    return best;
  }
}
const pick = (a, b) => (!a || b.pen > a.pen) ? b : a;
// resolve car vs world (+ optional dynamic circles list [{x,z,r,vx,vz,ref}]). returns impact {speed, nx, nz, x, z, ref} or null
export function resolveCar(veh, car, col, dyn) {
  const L = car.L, r = car.W * 0.5 * 0.92, off = L * 0.5 - r - 0.05; const sy = Math.sin(veh.yaw), cy = Math.cos(veh.yaw); let hit = null;
  const pts = [[off, 0], [0, 0], [-off, 0]];
  for (let iter = 0; iter < 2; iter++) {
    for (const [ol] of pts) {
      const px = veh.x + sy * ol, pz = veh.z + cy * ol; let c = col.query(px, pz, r);
      if (dyn) for (const d of dyn) { const ex = px - d.x, ez = pz - d.z; const rr = r + d.r; if (ex * ex + ez * ez < rr * rr) { const dd = Math.sqrt(ex * ex + ez * ez) || 1e-6; const pen = rr - dd; if (!c || pen > c.pen) c = { nx: ex / dd, nz: ez / dd, pen, x: d.x + ex / dd * d.r, z: d.z + ez / dd * d.r, wall: false, ref: d.ref, vx: d.vx, vz: d.vz }; } }
      if (!c) continue;
      veh.x += c.nx * c.pen; veh.z += c.nz * c.pen;
      const rvx = veh.vx - (c.vx || 0), rvz = veh.vz - (c.vz || 0); const vn = rvx * c.nx + rvz * c.nz;
      if (vn < 0) {
        const rx = px - veh.x, rz = pz - veh.z; // contact offset from CG (approx. at the circle centre)
        const fwdO = rx * sy + rz * cy, leftO = rx * cy - rz * sy, nF = c.nx * sy + c.nz * cy, nL = c.nx * cy - c.nz * sy;
        const m = veh.mass, I = veh.Iz; const e = c.wall ? 0.12 : 0.25; const k = 1 / m + Math.pow(fwdO * nL - leftO * nF, 2) / I;
        const J = -(1 + e) * vn / k * (c.wall ? 1 : 0.7);
        veh.vx += c.nx * J / m; veh.vz += c.nz * J / m; veh.r += (fwdO * (J * nL) - leftO * (J * nF)) / I * 0.8;
        // wall friction (scrape)
        const tx = -c.nz, tz = c.nx; const vt = veh.vx * tx + veh.vz * tz; const fr = Math.min(Math.abs(vt), Math.abs(J) / m * 0.28) * Math.sign(vt); veh.vx -= tx * fr; veh.vz -= tz * fr;
        const spd = -vn; if (!hit || spd > hit.speed) hit = { speed: spd, nx: c.nx, nz: c.nz, x: c.x, z: c.z, ref: c.ref, wall: c.wall, tvx: veh.vx, tvz: veh.vz };
      }
    }
  }
  return hit;
}
