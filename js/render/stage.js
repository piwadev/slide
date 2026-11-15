// WebGL stage: renderer + post (MSAA, bloom, tone-mapping) + quality presets. Scenes/cameras are swapped in with use().
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
export const QUALITY = {
  low: { pr: 0.75, shadow: 0, bloom: false, msaa: 0, scale: 0.5, traffic: 4, skids: 0.4 },
  medium: { pr: 1, shadow: 1024, bloom: true, msaa: 0, scale: 0.75, traffic: 6, skids: 0.7 },
  high: { pr: 1.5, shadow: 2048, bloom: true, msaa: 4, scale: 1, traffic: 8, skids: 1 },
};
export class Stage {
  constructor(canvas, quality = 'high') {
    this.canvas = canvas; this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'high', powerPreference: 'high-performance', preserveDrawingBuffer: true });
    const r = this.renderer; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1; r.shadowMap.type = THREE.PCFShadowMap; r.outputColorSpace = THREE.SRGBColorSpace;
    this.quality = quality; this.q = QUALITY[quality]; this.scene = null; this.camera = null; this.composer = null; this.fx = { bloom: [0.4, 0.7, 0.7] };
    addEventListener('resize', () => this.resize());
  }
  setQuality(q) { this.quality = q; this.q = QUALITY[q] || QUALITY.high; this.composer = null; this.renderer.shadowMap.enabled = this.q.shadow > 0; this.renderer.shadowMap.needsUpdate = true; this.resize(); }
  size() { return { w: this.canvas.clientWidth || innerWidth, h: this.canvas.clientHeight || innerHeight }; }
  resize() { const { w, h } = this.size(); const pr = Math.min(devicePixelRatio || 1, this.q.pr); this.renderer.setPixelRatio(pr); this.renderer.setSize(w, h, false); if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); } if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); } this.aspect = w / h; }
  use(scene, camera, fx = {}) {
    this.scene = scene; this.camera = camera; Object.assign(this.fx, fx); this.renderer.toneMappingExposure = this.fx.exposure || 1; this.renderer.shadowMap.enabled = this.q.shadow > 0;
    if (this.q.bloom) {
      const { w, h } = this.size(); const pr = Math.min(devicePixelRatio || 1, this.q.pr);
      if (!this.composer) { const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: this.q.msaa, colorSpace: THREE.LinearSRGBColorSpace }); this.composer = new EffectComposer(this.renderer, rt); this.composer.setPixelRatio(pr); this.composer.setSize(w, h); this.rp = new RenderPass(scene, camera); this.bp = new UnrealBloomPass(new THREE.Vector2(w, h), 0.4, 0.7, 0.7); this.composer.addPass(this.rp); this.composer.addPass(this.bp); this.composer.addPass(new OutputPass()); }
      this.rp.scene = scene; this.rp.camera = camera; const b = this.fx.bloom; this.bp.strength = b[0]; this.bp.radius = b[1]; this.bp.threshold = b[2];
    }
    this.resize();
  }
  render() { if (!this.scene) return; if (this.q.bloom && this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); }
  shot() { return this.canvas.toDataURL('image/png'); }
}
// shared tweaks for shadow-casting directional light
export function sunLight(L, mapSize) {
  const sun = new THREE.DirectionalLight(new THREE.Color(L.sunCol), L.sunInt); sun.position.set(...L.sunDir).multiplyScalar(80);
  if (mapSize) { sun.castShadow = true; sun.shadow.mapSize.set(mapSize, mapSize); const c = sun.shadow.camera; c.left = -46; c.right = 46; c.top = 46; c.bottom = -46; c.near = 1; c.far = 260; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; }
  return sun;
}
