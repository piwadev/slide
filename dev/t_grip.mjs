export default async (p, h) => {
  await p.setViewportSize({width: 640, height: 360});
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000});
  const out = await p.evaluate(async ({map}) => {
    const a = window.__slide.app; a.profile.save.settings.quality='low'; a.profile.save.level = 30; a.profile.save.maps = {tokyo:1,arena:1,industrial:1,mountain:1,harbor:1,desert:1};
    await a.startGame({mapId: map, mode:'free', tod:'day'}); const g = a.game; g.noRender = true; g.cd = 0; g.phase = 'run'; const K = a.input.keys, path = g.world.path; const log = [];
    const adiff = (x, y) => { let d = y - x; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return d; };
    let maxd = 0, crashes0 = 0;
    for (let i = 0; i < 60*90; i++) {
      const v = g.veh; const nn = path.nearest(v.x, v.z, 6); const look = 8 + v.speed * 0.6; const q = path.at(nn.s + look); const want = Math.atan2(q.x - v.x, q.z - v.z);
      const err = adiff(v.yaw, want); K.clear(); const steer = Math.max(-1, Math.min(1, err * 2.0)); if (steer > 0.05) K.add('KeyA'); else if (steer < -0.05) K.add('KeyD');
      let kf = 0; for (const d of [10, 20, 30, 45]) kf = Math.max(kf, Math.abs(path.at(nn.s + d).k)); const target = Math.max(9, Math.min(26, Math.sqrt(5 / Math.max(0.002, kf))));
      if (v.speed < target) K.add('KeyW'); else if (v.speed > target + 2) K.add('KeyS');
      g.update(1/60); maxd = Math.max(maxd, Math.abs(nn.d));
      if (i % 600 === 0) log.push({t: i/60, s: nn.s.toFixed(0), d: nn.d.toFixed(1), spd: (v.speed*3.6).toFixed(0), crashes: g.scorer.stats.crashes, len: path.length.toFixed(0)});
    }
    return {log, maxd, halfW: g.world.halfW};
  }, {map: process.env.MAP||'tokyo'});
  for (const l of out.log) h.logs.push(JSON.stringify(l)); h.logs.push('maxd '+out.maxd.toFixed(1)+' halfW '+out.halfW);
};
