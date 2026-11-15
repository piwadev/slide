export default async (p, h) => {
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000}); await p.waitForTimeout(3500);
  await p.evaluate(()=>{window.__slide.app.freeze=true;}); await p.screenshot({ path: '/workspace/slide/screenshots/01b-menu.png' });
};
