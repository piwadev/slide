export default async (p, h) => {
  const W = +(process.env.W||640), H = +(process.env.H||360);
  await p.setViewportSize({width: W, height: H});
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000});
  const map = process.env.MAP||'arena', car = process.env.CAR||'s13', tod = process.env.TOD||'night', shotFile = process.env.SHOT||'', q = process.env.Q||'low', cam = +(process.env.CAM||0), A = +(process.env.A||0.55), Bk = +(process.env.BK||1.0), secs=+(process.env.SECS||20);
  await p.evaluate(async ({map, car, tod, q, cam}) => {
    const a = window.__slide.app; a.profile.save.settings.quality=q; a.profile.save.settings.cam=cam; if (car!=='s13') { a.profile.save.owned[car] = {cfg: a.profile.fixCfg(window.__cars[car], null), bought:1}; a.profile.save.selected = car; }
    a.profile.save.level = 30; a.profile.save.maps = {tokyo:1,arena:1,industrial:1,mountain:1,harbor:1,desert:1};
    await a.startGame({mapId: map, mode:'free', tod}); const g = a.game; g.noRender = true; g.cd = 0; g.phase = 'run'; window.__t = 0;
  }, {map, car, tod, q, cam});
  let shot = false;
  for (let c = 0; c < secs; c++) {
    const r = await p.evaluate(({A, Bk}) => {
      const a = window.__slide.app, g = a.game, K = a.input.keys; let hit = false;
      for (let i = 0; i < 60; i++) {
        const v = g.veh, t = window.__t; K.clear(); const ang = Math.abs(v.beta)*57.3;
        if (t < 2.2) { K.add('KeyW'); if (t > 1.5) { K.add('KeyA'); K.add('Space'); } }
        else { const st = Math.max(-1, Math.min(1, A + Bk * v.beta)); if (st > 0.05) K.add('KeyA'); else if (st < -0.05) K.add('KeyD'); if (ang < 42 || v.speed < 9) K.add('KeyW'); else if (ang > 60) K.add('KeyS'); }
        g.update(1/60); window.__t += 1/60;
        if (ang > 36 && v.speed > 10 && g.time > 5 && g.scorer.live && !window.__shot) { window.__shot = 1; hit = true; }
      }
      const v = g.veh; return {t: window.__t.toFixed(0), spd:(v.speed*3.6).toFixed(0), beta:(v.beta*57.3).toFixed(0), combo: g.scorer.combo|0, tot: g.scorer.total|0, mult: g.scorer.mult.toFixed(1), x: v.x.toFixed(0), z: v.z.toFixed(0), yaw: (v.yaw*57.3)|0, gear: v.gear, rpm: v.rpm|0, crashes: g.scorer.stats.crashes, hit};
    }, {A, Bk});
    h.logs.push(JSON.stringify(r));
    if (r.hit && shotFile && !shot) { shot = true; await p.evaluate(async ()=>{ const g = window.__slide.app.game; for (let i=0;i<24;i++) { g.noRender = i < 23; g.update(1/60); } window.__slide.app.freeze = true; }); await h.shot(shotFile); await p.evaluate(()=>{ window.__slide.app.freeze = false; window.__slide.app.game.noRender = true; }); }
  }
};
