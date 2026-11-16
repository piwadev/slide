export default async (p, h) => {
  const files = process.env.F; const cols = process.env.COLS || 4;
  await p.setViewportSize({ width: 1920, height: 1200 });
  await p.goto(h.url.replace('index.html', 'dev/sheet.html') + `?f=${files}&cols=${cols}&w=${process.env.SW||480}&h=${process.env.SH||300}&dbg=${process.env.DBG||0}`);
  await p.waitForFunction('window.__done', null, { timeout: 280000 });
  const url = await p.evaluate(() => document.getElementById('c').toDataURL('image/jpeg', 0.85));
  (await import('fs')).writeFileSync(process.env.OUT, Buffer.from(url.split(',')[1], 'base64'));
};
