export default async (p, h) => {
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000}); await p.waitForTimeout(1000);
  await p.click('.nav button[data-nav="garage"]'); await p.waitForTimeout(800);
  h.logs.push(JSON.stringify(await p.evaluate(() => { const g = window.__slide.app.ui.garageUI; return g.unowned().map(o => o.cat + ':' + o.id + ':' + o.it.price); })));
  await p.screenshot({ path: '/workspace/slide/dev/u1.png' });
};
