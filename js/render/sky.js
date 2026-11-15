// Sky dome, lighting presets (day / dusk / night) and PMREM environment generation.
import * as THREE from 'three';
const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FS = `varying vec3 vDir; uniform vec3 top, hor, bot, sunDir, sunCol; uniform float night, sunSize;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main(){ vec3 d = normalize(vDir); float y = d.y; vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y,0.0,1.0), 0.55)) : mix(hor, bot, clamp(-y*3.0,0.0,1.0));
  float sd = max(dot(d, normalize(sunDir)), 0.0); c += sunCol * (pow(sd, 900.0) * 3.0 * sunSize + pow(sd, 12.0) * 0.28 + pow(sd, 3.0) * 0.1);
  if (night > 0.01 && y > 0.0) { vec2 g = floor(d.xz / (y + 0.35) * 160.0); float s = step(0.9965, h21(g)); c += vec3(s) * night * smoothstep(0.05, 0.4, y) * (0.5 + 0.5 * h21(g + 7.0)); }
  gl_FragColor = vec4(c, 1.0); }`;
export const LIGHT = {
  day:   { top: '#4a86d8', hor: '#cfe3f5', bot: '#8d949c', sunDir: [0.5, 0.75, 0.35], sunCol: '#fff1d6', sunInt: 3.0, hemiSky: '#bcd5f2', hemiGnd: '#6a6a60', hemiInt: 1.0, fog: '#c4d6e8', fogD: 0.0016, exposure: 0.95, bloom: [0.12, 0.8, 0.9], night: 0 },
  dusk:  { top: '#27345e', hor: '#ff9a52', bot: '#3d3a46', sunDir: [0.85, 0.12, 0.3], sunCol: '#ffb067', sunInt: 2.2, hemiSky: '#8a8fc0', hemiGnd: '#3a2f33', hemiInt: 0.8, fog: '#c58c6f', fogD: 0.0022, exposure: 0.95, bloom: [0.25, 0.7, 0.8], night: 0.15 },
  night: { top: '#050816', hor: '#1c2140', bot: '#0b0d18', sunDir: [-0.4, 0.5, -0.5], sunCol: '#8fa6ff', sunInt: 0.55, hemiSky: '#37427a', hemiGnd: '#15161f', hemiInt: 0.55, fog: '#0b1022', fogD: 0.0028, exposure: 1.0, bloom: [0.4, 0.55, 0.85], night: 1 },
};
export function lightFor(mapTint, tod) { const base = { ...LIGHT[tod] }; const t = mapTint && mapTint[tod]; return t ? { ...base, ...t } : base; }
export function makeSky(L) {
  const m = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(L.top) }, hor: { value: new THREE.Color(L.hor) }, bot: { value: new THREE.Color(L.bot) }, sunDir: { value: new THREE.Vector3(...L.sunDir) }, sunCol: { value: new THREE.Color(L.sunCol) }, night: { value: L.night }, sunSize: { value: L.night > 0.5 ? 0.35 : 1 } } });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m); mesh.scale.setScalar(1500); mesh.frustumCulled = false; mesh.renderOrder = -10; return mesh;
}
// environment for reflections: sky + a few bright emissive panels (so paint shows highlights)
export function makeEnv(renderer, L, extras = []) {
  const sc = new THREE.Scene(); const sky = makeSky(L); sky.scale.setScalar(50); sc.add(sky);
  const lights = [[0, 14, -10, 18, 4, '#ffffff', 2.4], [-22, 8, 0, 4, 10, '#ffffff', 1.4], [22, 8, 6, 4, 10, '#ffffff', 1.4]];
  const night = L.night > 0.5;
  const g = new THREE.Group(); sc.add(g);
  const add = (x, y, z, w, h, col, inten) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(inten), side: THREE.DoubleSide, toneMapped: false })); m.position.set(x, y, z); m.lookAt(0, 1, 0); g.add(m); };
  if (night) { for (const [x, y, z, w, h, c, i] of [[-20, 6, -12, 6, 14, '#ff2d95', 2.5], [20, 6, 10, 6, 14, '#19d3ff', 2.5], [4, 7, 22, 8, 5, '#ffb347', 2.0], [-6, 12, -20, 14, 3, '#ffffff', 1.4]].concat(extras)) add(x, y, z, w, h, c, i); }
  else for (const [x, y, z, w, h, c, i] of lights.concat(extras)) add(x, y, z, w, h, c, i * (L.sunInt > 2 ? 1 : 0.7));
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(sc, 0.02); pm.dispose(); sky.material.dispose(); return rt.texture;
}
