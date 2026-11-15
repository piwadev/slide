// Pooled particle effects: tyre smoke, persistent skid marks (ring buffer), sparks, exhaust flames.
import * as THREE from 'three';
const SPR_VS = `attribute float size; attribute float alpha; attribute vec3 tint; varying float vA; varying vec3 vT; varying float vD; uniform float scale;
void main(){ vA = alpha; vT = tint; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; gl_PointSize = size * scale / max(0.1, -mv.z); }`;
const SPR_FS = `varying float vA; varying vec3 vT; varying float vD; uniform sampler2D map; uniform float add;
void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vT * (add > 0.5 ? 1.6 : 1.0), t.a * vA * (add > 0.5 ? 1.0 : smoothstep(3.0, 11.0, vD) * 0.6)); if (gl_FragColor.a < 0.003) discard; }`;
function softTex() { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); const g = c.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); return t; }

class Pool {
  constructor(n, additive, scale) {
    this.n = n; this.i = 0; this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.grav = new Float32Array(n); this.a0 = new Float32Array(n);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.tint = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3));
    const m = new THREE.ShaderMaterial({ vertexShader: SPR_VS, fragmentShader: SPR_FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { map: { value: Pool.tex || (Pool.tex = softTex()) }, scale: { value: scale || 700 }, add: { value: additive ? 1 : 0 } } });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 3;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, a0, r, g, b, grav = 0) { const i = this.i; this.i = (this.i + 1) % this.n; const k = i * 3; this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz; this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0; this.tint[k] = r; this.tint[k + 1] = g; this.tint[k + 2] = b; this.grav[i] = grav; }
  update(dt) {
    for (let i = 0; i < this.n; i++) { if (this.life[i] <= 0) { this.alpha[i] = 0; continue; } this.life[i] -= dt; const k = i * 3, t = 1 - this.life[i] / this.max[i]; this.vel[k + 1] += this.grav[i] * dt; const damp = Math.max(0, 1 - dt * 1.6); if (this.grav[i] === 0) { this.vel[k] *= damp; this.vel[k + 2] *= damp; } this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt; this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t; this.alpha[i] = this.a0[i] * (t < 0.12 ? t / 0.12 : 1) * (1 - t) * (1 - t * 0.3); }
    const g = this.points.geometry; g.attributes.position.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = g.attributes.tint.needsUpdate = true;
  }
}
export class FX {
  constructor(scene, quality = 'high') {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group); const q = { low: 0.4, medium: 0.7, high: 1 }[quality] || 1; this.q = q;
    this.smoke = new Pool(Math.round(900 * q) + 100, false, 900); this.sparks = new Pool(200, true, 400); this.flames = new Pool(140, true, 700); this.group.add(this.smoke.points, this.sparks.points, this.flames.points);
    // skid marks
    this.maxQ = Math.round(3600 * q) + 400; this.qi = 0; const nv = this.maxQ * 4;
    this.sp = new Float32Array(nv * 3); this.sc = new Float32Array(nv * 4); const idx = new Uint32Array(this.maxQ * 6);
    for (let i = 0; i < this.maxQ; i++) { const v = i * 4; idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.sp, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.sc, 4)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.skidMesh = new THREE.Mesh(g, m); this.skidMesh.frustumCulled = false; this.skidMesh.renderOrder = 1; this.group.add(this.skidMesh); this.last = [null, null, null, null]; this.dirty = false;
    this.ambient = [1, 1, 1];
  }
  setTint(r, g, b) { this.ambient = [r, g, b]; }
  smokePuff(x, y, z, vx, vz, size, a, tint) { const t = tint || [0.86, 0.86, 0.88]; const k = this.ambient; this.smoke.emit(x + (Math.random() - 0.5) * 0.3, y + 0.15, z + (Math.random() - 0.5) * 0.3, vx * 0.35 + (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 1.3, vz * 0.35 + (Math.random() - 0.5) * 1.2, 1.6 + Math.random() * 1.1, size * 0.6, size * (2.2 + Math.random()), a, t[0] * k[0], t[1] * k[1], t[2] * k[2]); }
  spark(x, y, z, vx, vy, vz) { this.sparks.emit(x, y, z, vx + (Math.random() - 0.5) * 4, vy + Math.random() * 3, vz + (Math.random() - 0.5) * 4, 0.35 + Math.random() * 0.45, 0.25, 0.1, 1, 1, 0.62 + Math.random() * 0.3, 0.2, -9); }
  flame(x, y, z, dx, dz, big, blue) { const c = blue ? [0.3, 0.55, 1] : [1, 0.55, 0.12]; for (let i = 0; i < (big ? 3 : 1); i++) this.flames.emit(x, y, z, dx * (6 + Math.random() * 5) + (Math.random() - 0.5), 0.3 + Math.random() * 0.5, dz * (6 + Math.random() * 5) + (Math.random() - 0.5), 0.12 + Math.random() * 0.13, big ? 0.7 : 0.45, 0.15, 1, c[0], c[1], c[2], 0); }
  // wheel i skid: world pos, width, intensity (0 stops the trail)
  skid(i, x, y, z, width, a, nx, nz) {
    const L = this.last[i];
    if (a <= 0.02) { this.last[i] = null; return; }
    if (L) { const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz); if (d < 0.18) return; if (d > 6) { this.last[i] = { x, y, z, nx, nz }; return; }
      const v = this.qi * 4; this.qi = (this.qi + 1) % this.maxQ; const w = width / 2; const p = this.sp, c = this.sc;
      const put = (k, px, py, pz, al) => { p[(v + k) * 3] = px; p[(v + k) * 3 + 1] = py; p[(v + k) * 3 + 2] = pz; c[(v + k) * 4] = 0.02; c[(v + k) * 4 + 1] = 0.02; c[(v + k) * 4 + 2] = 0.02; c[(v + k) * 4 + 3] = al; };
      const yy = Math.max(y, L.y) + 0.035;
      put(0, L.x + L.nx * w, yy, L.z + L.nz * w, L.a || a * 0.6); put(1, L.x - L.nx * w, yy, L.z - L.nz * w, L.a || a * 0.6); put(2, x + nx * w, yy, z + nz * w, a * 0.62); put(3, x - nx * w, yy, z - nz * w, a * 0.62); this.dirty = true; }
    this.last[i] = { x, y, z, nx, nz, a: a * 0.62 };
  }
  clearSkids() { this.sc.fill(0); this.skidMesh.geometry.attributes.color.needsUpdate = true; this.qi = 0; this.last = [null, null, null, null]; }
  update(dt) { this.smoke.update(dt); this.sparks.update(dt); this.flames.update(dt); if (this.dirty) { const g = this.skidMesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; this.dirty = false; } }
  dispose() { this.scene.remove(this.group); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
}
