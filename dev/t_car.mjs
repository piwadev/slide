// garage shot of a given car: CAR=r34 PRESET=hero PATCH='{"paint":{"color":"#ff0000"}}' OUT=file.png node dev/run.mjs dev/t_car.mjs 1280 720
export default async (p, h) => {
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, { timeout: 90000 }); await p.waitForTimeout(1200);
  const car = process.env.CAR || 'r34', patch = process.env.PATCH || '{}';
  await p.evaluate(async ({ car, patch, preset }) => {
    const a = window.__slide.app; a.profile.save.owned[car] = { cfg: a.profile.fixCfg(window.__cars[car], null), bought: 1 }; a.profile.save.selected = car;
    const cfg = a.profile.cfg; const P = JSON.parse(patch); for (const k in P) Object.assign(cfg[k] || (cfg[k] = {}), P[k]);
    a.garage.setCar(window.__cars[car], cfg); a.garage.go(preset, true); document.getElementById('menu').style.display = 'none'; a.garage.setOffset && a.garage.setOffset(0);
  }, { car, patch, preset: process.env.PRESET || 'hero' });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: process.env.OUT || '/workspace/slide/dev/car.png' });
  h.logs.push('isGlb=' + await p.evaluate(() => !!window.__slide.app.garage.model.isGlb));
};
