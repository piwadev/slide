export default async (p, h) => {
  const W = +(process.env.W||640), H = +(process.env.H||360);
  await p.setViewportSize({width: W, height: H});
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000});
  const map = process.env.MAP||'tokyo', car = process.env.CAR||'s13', tod = process.env.TOD||'night', secs = +(process.env.SECS||70), shotFile = process.env.SHOT||'', q = process.env.Q||'low', mode = process.env.MODE||'free', cam = +(process.env.CAM||0);
  await p.evaluate(async ({map, car, tod, q, mode, cam}) => {
    const a = window.__slide.app; a.profile.save.settings.quality=q; a.profile.save.settings.cam=cam; if (car!=='s13') { a.profile.save.owned[car] = {cfg: a.profile.fixCfg(window.__cars[car], null), bought:1}; a.profile.save.selected = car; }
    a.profile.save.level = 30; a.profile.save.maps = {tokyo:1,arena:1,industrial:1,mountain:1,harbor:1,desert:1};
    await a.startGame({mapId: map, mode, tod}); const g = a.game; g.noRender = true; g.cd = 0; g.phase = 'run'; window.__bot = { t: 0, kick: 0, shots: 0 }; window.__trace = true;
  }, {map, car, tod, q, mode, cam});
  const total = secs*60; let shot = false;
  for (let chunk = 0; chunk < total; chunk += 60) {
    const r = await p.evaluate(({n, want}) => {
      const a = window.__slide.app, g = a.game, K = a.input.keys, path = g.world.path, B = window.__bot; let hit = false;
      const adiff = (x, y) => { let d = y - x; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return d; };
      for (let i = 0; i < n; i++) {
        const v = g.veh; const nn = path.nearest(v.x, v.z, 6); const look = 10 + v.speed * 0.8; const q = path.at(nn.s + look); const want = Math.atan2(q.x - v.x, q.z - v.z);
        const velDir = v.speed > 3 ? Math.atan2(v.vx, v.vz) : v.yaw; const errV = adiff(velDir, want), h2v = adiff(v.yaw, velDir);
        let kmax = 0, ksign = 0; for (const d of [8, 16, 24, 34]) { const k = path.at(nn.s + d).k; if (Math.abs(k) > Math.abs(kmax)) { kmax = k; ksign = Math.sign(k); } }
        K.clear(); const ang = Math.abs(v.beta) * 57.3; const drifting = ang > 15;
        let steer = Math.max(-1, Math.min(1, -h2v * 1.6 + errV * (Math.abs(h2v) < 0.3 ? 1.1 : 0.2))); if (B.kick > 0) { steer = ksign * 1.0; B.kick -= 1/60; K.add('Space'); K.add('ShiftLeft'); }
        else if (!drifting && Math.abs(kmax) > 0.028 && v.speed > 14 && g.time - (B.last||-9) > 2.5) { B.kick = 0.28; B.last = g.time; }
        let kf = 0; for (const d of [10, 20, 30, 45, 60]) kf = Math.max(kf, Math.abs(path.at(nn.s + d).k)); const target = drifting ? 17 : Math.max(13, Math.min(30, Math.sqrt(8.5 / Math.max(0.002, kf))));
        if (drifting) { if (ang < 52 && v.speed > 8) K.add('KeyW'); if (ang > 70) K.add('KeyS'); } else if (v.speed < target) K.add('KeyW'); else if (v.speed > target + 5) K.add('KeyS');
        a.input.override = { steer, throttle: K.has('KeyW')?1:0, brake: K.has('KeyS')?1:0, hb: K.has('Space')?1:0, kick: K.has('ShiftLeft') }; g.update(1/60); B.t += 1/60; if (window.__trace && B.t > 6 && B.t < 16 && i % 6 === 0) (window.__tr = window.__tr || []).push([B.t.toFixed(1), (v.speed*3.6).toFixed(0), (v.beta*57.3).toFixed(0), v.steer.toFixed(2), Math.round(steer*100)/100, K.has('KeyW')?'W':'', K.has('Space')?'H':'', Math.round(v.yaw*57.3), drifting?'D':'', nn.d.toFixed(1), kmax.toFixed(3)].join(' '));
        if (want && ang > 38 && v.speed > 12 && g.scorer.live && g.time > 4 && !B.shotReady) { B.shotReady = true; hit = true; }
      }
      const v = g.veh; return { t: B.t.toFixed(0), spd: (v.speed*3.6).toFixed(0), beta: (v.beta*57.3).toFixed(0), pts: g.scorer.combo, tot: g.scorer.total, mult: g.scorer.mult.toFixed(1), crashes: g.scorer.stats.crashes, hit };
    }, {n: 60, want: 1});
    if (chunk % 600 === 0) h.logs.push(JSON.stringify(r));
    if (r.hit && shotFile && !shot) { shot = true; await p.evaluate(()=>{ const g = window.__slide.app.game; g.noRender = false; }); await p.evaluate(async ()=>{ const g = window.__slide.app.game; for (let i=0;i<24;i++) { g.noRender = i < 23; g.update(1/60); } window.__slide.app.freeze = true; }); await h.shot(shotFile); await p.evaluate(()=>{ window.__slide.app.freeze = false; window.__slide.app.game.noRender = true; }); }
  }
  const st = await p.evaluate(()=>{ const g = window.__slide.app.game; return { stats: g.scorer.stats, total: g.scorer.total, fps: g.fps }; });
  h.logs.push(JSON.stringify(st)); if (process.env.TRACE) h.logs.push((await p.evaluate(()=>window.__tr||[])).join('\n'));
  if (shotFile && !shot) { await p.evaluate(()=>{ const g = window.__slide.app.game; for (let i=0;i<6;i++) { g.noRender = i < 5; g.update(1/60); } window.__slide.app.freeze = true; }); await h.shot(shotFile); }
};
