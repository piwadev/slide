export default async (p, h) => {
  const q = new URLSearchParams(process.env.Q||'');
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000});
  await p.evaluate(({map,tod,mode,car}) => { const a = window.__slide.app; if (car) { a.profile.save.owned[car] = a.profile.save.owned[car] || {cfg: a.profile.fixCfg(null,null), bought:1}; } a.startGame({mapId: map, mode, tod}); }, {map: process.env.MAP||'tokyo', tod: process.env.TOD||'night', mode: process.env.MODE||'free'});
  await p.waitForFunction("window.__slide.game && window.__slide.game.phase==='run'", null, {timeout: 120000});
  const fps = await p.evaluate(()=>window.__slide.game.fps); h.logs.push('fps '+fps.toFixed(1));
  await p.keyboard.down('w'); await p.waitForTimeout(4000);
  await p.keyboard.down('a'); await p.keyboard.down('Space'); await p.waitForTimeout(500); await p.keyboard.up('Space');
  for (let i=0;i<8;i++){ await p.waitForTimeout(700); const s = await p.evaluate(()=>{const g=window.__slide.game; const v=g.veh; return {spd:(v.speed*3.6).toFixed(0), beta:(v.beta*57.3).toFixed(0), pts:g.scorer.combo, tot:g.scorer.total, mult:g.scorer.mult.toFixed(1), x:v.x.toFixed(0), z:v.z.toFixed(0), gear:v.gear}}); h.logs.push(JSON.stringify(s)); }
  await h.shot('/workspace/slide/dev/d1.png');
};
