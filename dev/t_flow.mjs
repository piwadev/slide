export default async (p, h) => {
  const log = (...a) => h.logs.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  const boot = async () => { await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000}); await p.waitForTimeout(1200); };
  await boot();
  // admin gate
  await p.keyboard.press('Control+Shift+F12'); await p.waitForTimeout(400);
  log('admin dialog', await p.evaluate(() => !!document.querySelector('.adm-box input[type=password]')));
  await p.fill('.adm-box input[type=password]', 'definitely-wrong'); await p.keyboard.press('Enter'); await p.waitForTimeout(3500);
  log('admin wrong ->', await p.evaluate(() => (document.querySelector('.adm-msg') || {}).textContent));
  await p.keyboard.press('Escape');
  // admin commands (direct import of the command engine)
  log('cmds', await p.evaluate(async () => { const { runAdmin } = await import('/js/core/admin.js'); const a = window.__slide.app, P = a.profile; const c0 = P.save.cash; const r1 = runAdmin('money 5000', P, a); const r2 = runAdmin('level 12', P, a); const r3 = runAdmin('unlockall', P, a); const r4 = runAdmin('status', P, a); return { cashDelta: P.save.cash - c0, level: P.save.level, r3: r3.ok, status: (r4.lines||[]).slice(0,3) }; }));
  // garage customisation
  await p.evaluate(() => document.querySelector('.nav button[data-nav="garage"]').click()); await p.waitForTimeout(800);
  const bodyHash = () => p.evaluate(() => { const m = window.__slide.app.garage.model; let h = ''; m.root.traverse(o => { if (o.isMesh && o.material && o.material.color) h += o.material.color.getHexString(); }); return h.length + ':' + h.slice(0, 80) + ' ' + JSON.stringify(m.cfg.paint) + ' ' + m.cfg.wheels.design; });
  const a0 = await bodyHash();
  await p.evaluate(() => document.querySelector('[data-tab="paint"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { const l = document.querySelectorAll('#gBody [data-v]'); l[2].click(); }); await p.waitForTimeout(500);
  const a1 = await bodyHash(); log('paint change alters car', a0 !== a1);
  await p.evaluate(() => document.querySelector('[data-tab="wheels"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { const l = [...document.querySelectorAll('#gBody .item:not(.lock)')]; l[0].click(); }); await p.waitForTimeout(500);
  const a2 = await bodyHash(); log('wheel change alters car', a1 !== a2);
  await p.screenshot({ path: '/workspace/slide/screenshots/02-garage-customise.png' });
  log('buybar', await p.evaluate(() => document.getElementById('gBuy').innerText.replace(/\n/g, ' | ')));
  await p.evaluate(() => { const b = [...document.querySelectorAll('#gBuy button')].find(x => /BUY|SAVE/i.test(x.textContent)); b && b.click(); }); await p.waitForTimeout(800);
  log('after buy', await p.evaluate(() => { const P = window.__slide.app.profile; return { cash: P.save.cash, paint: P.cfg.paint, design: P.cfg.wheels.design }; }));
  await p.evaluate(() => { window.__slide.app.profile.save && window.__slide.app.profile.flush && window.__slide.app.profile.flush(); });
  await boot();
  log('after reload', await p.evaluate(() => { const P = window.__slide.app.profile; return { level: P.save.level, cash: P.save.cash, paint: P.cfg.paint, design: P.cfg.wheels.design }; }));
};
