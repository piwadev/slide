// release screenshots: menu garage hero + customise screen, with the real R34 model (run at 1600x900)
export default async (p, h) => {
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, { timeout: 90000 }); await p.waitForTimeout(1000);
  const car = process.env.CAR || 'r34';
  await p.evaluate((car) => { const a = window.__slide.app; a.profile.save.cash = 500000; a.profile.save.level = 30; a.profile.save.owned[car] = { cfg: a.profile.fixCfg(window.__cars[car], null), bought: 1 }; a.profile.save.selected = car; const c = a.profile.cfg; c.wheels.design = 'mesh'; c.wheels.color = '#b9853a'; c.wheels.finish = 'bronze'; c.look.glow = '#ff2d95'; a.profile.emit && a.profile.emit(); a.garage.setCar(window.__cars[car], c); a.garage.go('menu', true); }, car);
  await p.evaluate(() => { for (const n of ['career', 'drive']) document.querySelector(`.nav button[data-nav="${n}"]`).click(); }); await p.waitForTimeout(5000);
  await p.evaluate(() => { window.__slide.app.freeze = true; }); await p.screenshot({ path: '/workspace/slide/screenshots/11-menu-garage-r34.png' });
  await p.evaluate(() => { window.__slide.app.freeze = false; document.querySelector('.nav button[data-nav="garage"]').click(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('[data-tab="paint"]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { const l = document.querySelectorAll('#gBody [data-v]'); l[3] && l[3].click(); }); await p.waitForTimeout(2500);
  await p.screenshot({ path: '/workspace/slide/screenshots/12-garage-customise-r34.png' });
  await p.evaluate(() => document.querySelector('[data-tab="vinyl"]') && document.querySelector('[data-tab="vinyl"]').click()); await p.waitForTimeout(600);
  await p.evaluate(() => { const l = [...document.querySelectorAll('#gBody .item:not(.lock)')]; l[2] && l[2].click(); }); await p.waitForTimeout(2500);
  await p.screenshot({ path: '/workspace/slide/screenshots/13-garage-livery-r34.png' });
  // clean hero shot (UI hidden), like the style reference
  await p.evaluate(() => { document.querySelector('.nav button[data-nav="drive"]').click(); });
  await p.evaluate(() => { const a = window.__slide.app; document.getElementById('menu').style.display = 'none'; a.garage.setOffset && a.garage.setOffset(0); a.garage.go('hero', true); a.garage.auto = false; a.garage.view.a = 0.75; a.garage.tgt.a = 0.75; a.garage.view.d *= 0.72; a.garage.tgt.d = a.garage.view.d; });
  await p.waitForTimeout(2500); await p.evaluate(() => { window.__slide.app.freeze = true; }); await p.screenshot({ path: '/workspace/slide/screenshots/14-garage-hero-r34.png' });
};
