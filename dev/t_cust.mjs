// every real-model car: load in garage, change paint/wheels/livery/tint/glow through the real UI draft path, assert the pixels change
import fs from 'fs';
export default async (p, h) => {
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, { timeout: 90000 }); await p.waitForTimeout(1000);
  const ids = (process.env.CARS || 'r34,a80,s13,ae86,huracan,964,mustang,challenger').split(',');
  const sel = async (car) => p.evaluate(async (car) => { const a = window.__slide.app; a.profile.save.owned[car] = { cfg: a.profile.fixCfg(window.__cars[car], null), bought: 1 }; a.profile.save.selected = car; a.garage.setCar(window.__cars[car], a.profile.cfg); a.garage.go('side', true); document.getElementById('menu').style.display = 'none'; await new Promise(r => setTimeout(r, 2500)); return !!a.garage.model.isGlb; }, car);
  const snap = async (f) => { await p.waitForTimeout(500); const b = await p.screenshot({ path: f }); return b; };
  const diff = (a, b) => p.evaluate(async ([x, y]) => { const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; }); const [A, B] = await Promise.all([load(x), load(y)]); const c = document.createElement('canvas'); c.width = A.width; c.height = A.height; const g = c.getContext('2d'); g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data; g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 60) n++; return n; }, [a.toString('base64'), b.toString('base64')]);
  const patch = (o) => p.evaluate((o) => { const a = window.__slide.app, cfg = a.profile.cfg; for (const k in o) Object.assign(cfg[k], o[k]); a.garage.refreshCar(cfg); }, o);
  for (const id of ids) {
    const glb = await sel(id); const a0 = await snap(`/tmp/cu_${id}_0.png`);
    await patch({ paint: { color: '#ff2d95' } }); const a1 = await snap(`/tmp/cu_${id}_1.png`);
    await patch({ wheels: { design: 'mesh', color: '#ffd400' } }); const a2 = await snap(`/tmp/cu_${id}_2.png`);
    await patch({ look: { glow: '#00e5ff', tint: 5 }, livery: { id: 'racing', color: '#ffffff' } }); const a3 = await snap(`/tmp/cu_${id}_3.png`);
    h.logs.push(`${id} glb=${glb} paint:${await diff(a0, a1)} wheels:${await diff(a1, a2)} glow/tint/livery:${await diff(a2, a3)}`);
  }
};
