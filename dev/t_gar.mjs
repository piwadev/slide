export default async (p, h) => {
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000}); await p.waitForTimeout(1500);
  await p.evaluate(({preset}) => { const a = window.__slide.app; a.garage.go && a.garage.go(preset); document.getElementById('menu').style.display='none'; a.garage.setOffset && a.garage.setOffset(0); }, {preset: process.env.PRESET||'hero'}); await p.waitForTimeout(2500); await p.evaluate(()=>{window.__slide.app.freeze=true;}); await p.screenshot({path: process.env.SHOT});
};
