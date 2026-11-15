// drive bot in-page: manual stepping, no rendering
export default async (p, h) => {
  await p.setViewportSize({width: 640, height: 360});
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000});
  const map = process.env.MAP||'tokyo', car = process.env.CAR||'s13';
  const out = await p.evaluate(async ({map, car}) => {
    const a = window.__slide.app; a.profile.save.settings.quality='low'; if (car!=='s13') { a.profile.save.owned[car] = {cfg: a.profile.fixCfg(window.__cars[car], null), bought:1}; a.profile.save.selected = car; }
    await a.startGame({mapId: map, mode:'free', tod:'day'}); const g = a.game; g.noRender = true; g.cd = 0; g.phase = 'run';
    const K = a.input.keys; const log = []; const path = g.world.path; let t = 0;
    // bot: follow path ahead, throttle modulated, handbrake kick at entry of corners
    for (let i = 0; i < 60*70; i++) {
      const v = g.veh; const n = path.nearest(v.x, v.z, 6); const look = 14 + v.speed * 0.9; const q = path.at(n.s + look); const tx = q.x - v.x, tz = q.z - v.z;
      const want = Math.atan2(tx, tz); let err = want - v.yaw; while (err > Math.PI) err -= 2*Math.PI; while (err < -Math.PI) err += 2*Math.PI;
      const kmax = Math.max(...[0,10,20,30].map(d => Math.abs(path.at(n.s + d).k)));
      K.clear(); const steer = Math.max(-1, Math.min(1, err * 1.8 + (-v.beta) * 1.2));
      if (steer > 0.12) K.add('KeyA'); else if (steer < -0.12) K.add('KeyD');
      const target = Math.max(14, Math.min(34, Math.sqrt(9 / Math.max(0.003, kmax)))); if (v.speed < target) K.add('KeyW'); else if (v.speed > target + 4) K.add('KeyS');
      if (kmax > 0.03 && v.speed > 15 && Math.abs(err) > 0.12 && g.time % 5 < 0.25) K.add('Space');
      if (kmax > 0.025 && v.speed > 14) K.add('ShiftLeft');
      g.update(1/60); t += 1/60;
      if (i % 120 === 0) log.push({t: t.toFixed(0), spd: (v.speed*3.6).toFixed(0), beta: (v.beta*57.3).toFixed(0), pts: g.scorer.combo, tot: g.scorer.total, mult: g.scorer.mult.toFixed(1), s: n.s.toFixed(0), d: n.d.toFixed(1), crashes: g.scorer.stats.crashes});
    }
    return {log, stats: g.scorer.stats, total: g.scorer.total};
  }, {map, car});
  for (const l of out.log) h.logs.push(JSON.stringify(l)); h.logs.push(JSON.stringify(out.stats)); h.logs.push('TOTAL '+out.total);
};
