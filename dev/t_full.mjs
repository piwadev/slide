export default async (p, h) => {
  const log = (...a) => h.logs.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000});
  await p.waitForTimeout(1500);
  for (const nav of ['drive','career','events','shop','profile']) {
    await p.evaluate((n) => document.querySelector(`.nav button[data-nav="${n}"]`).click(), nav); await p.waitForTimeout(700);
    log(nav, await p.evaluate(() => ({ len: document.getElementById('screen').innerText.length, n: document.querySelectorAll('#screen button, #screen .item, #screen .card').length })));
    await p.screenshot({ path: `/workspace/slide/dev/f_${nav}.png` });
  }
  await p.evaluate(() => document.querySelector('.nav button[data-nav="garage"]').click()); await p.waitForTimeout(900);
  const hash = () => p.evaluate(() => JSON.stringify(window.__slide.app.ui.garageUI.draft));
  const h0 = await hash();
  for (const tab of ['body','wheels','paint','vinyl','lights','perf','tune']) {
    await p.evaluate((t) => document.querySelector(`[data-tab="${t}"]`).click(), tab); await p.waitForTimeout(400);
    const n = await p.evaluate(() => document.querySelectorAll('#gBody [data-v]:not(.lock), #gBody .item:not(.lock)').length);
    log('tab', tab, 'items', n);
    for (let k = 0; k < Math.min(n, 3); k++) { await p.evaluate((k) => { const l = document.querySelectorAll('#gBody [data-v]:not(.lock), #gBody .item:not(.lock)'); l[k] && l[k].click(); }, k); await p.waitForTimeout(250); }
    await p.screenshot({ path: `/workspace/slide/dev/g_${tab}.png` });
  }
  const h1 = await hash(); log('draft changed', h0 !== h1);
  log('buybar', await p.evaluate(() => document.getElementById('gBuy').innerText));
};
