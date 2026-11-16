export default async (p, h) => {
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, { timeout: 90000 }); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => {
    const a = window.__slide.app; const car = 'r34'; a.profile.save.owned[car] = { cfg: a.profile.fixCfg(window.__cars[car], null), bought: 1 }; a.profile.save.selected = car;
    a.garage.setCar(window.__cars[car], a.profile.cfg); await new Promise(r => setTimeout(r, 3000));
    const out = []; const walk = (o, path) => { o.children.forEach((c, i) => { if (!c) out.push(path + '/' + i + ' UNDEFINED in ' + o.type + ' ' + o.name); else walk(c, path + '/' + (c.name || c.type)); }); }; walk(a.garage.scene, ''); return out.slice(0, 5);
  });
  h.logs.push(JSON.stringify(r));
};
