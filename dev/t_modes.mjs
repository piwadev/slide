export default async (p, h) => {
  const log = (...a) => h.logs.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  await p.setViewportSize({ width: 960, height: 540 });
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000}); await p.waitForTimeout(1000);
  await p.evaluate(async () => { const { runAdmin } = await import('/js/core/admin.js'); const a = window.__slide.app; runAdmin('level 40', a.profile, a); runAdmin('unlockall', a.profile, a); a.profile.save.settings.quality = 'low'; });
  for (const [id, mode] of [['arena-basics','challenge'], ]) {
    const r = await p.evaluate(async ({ id, mode }) => {
      const a = window.__slide.app; const { EVENTS } = await import('/js/data/events.js'); const ev = EVENTS.find(e => e.mode === mode && (e.id === id)) || EVENTS.find(e => e.mode === mode);
      await a.startGame({ mapId: ev.map, mode: ev.mode, event: ev }); const g = a.game; g.noRender = true; g.cd = 0; g.phase = 'run';
      const path = g.world.path; const K = a.input.keys; let ticks = 0; const adiff = (x, y) => { let d = y - x; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return d; };
      while (!g.finished && ticks < 60 * 200) {
        const v = g.veh; const nn = path.nearest(v.x, v.z, 6); const q = path.at(nn.s + 8 + v.speed * 0.6); const err = adiff(v.yaw, Math.atan2(q.x - v.x, q.z - v.z)); let kf = 0; for (const d of [10, 20, 30, 45]) kf = Math.max(kf, Math.abs(path.at(nn.s + d).k)); const target = Math.max(9, Math.min(28, Math.sqrt(5 / Math.max(0.002, kf))));
        a.input.override = { steer: Math.max(-1, Math.min(1, err * 2)), throttle: v.speed < target ? 1 : 0, brake: v.speed > target + 2 ? 1 : 0, hb: 0, kick: false };
        g.update(1/60); ticks++;
      }
      const fin = g.finished; if (!fin) g.finish();
      await new Promise(r => setTimeout(r, 1800)); g.noRender = false;
      return { ev: ev.name, mode, naturalFinish: fin, ticks, result: g.result && { score: g.result.score, stars: g.result.stars, laps: g.result.lapTimes.length, cash: g.result.out && g.result.out.cash }, modal: (document.getElementById('layer')||{}).innerHTML.length };
    }, { id, mode });
    log(r); await p.screenshot({ path: `/workspace/slide/dev/res2_${mode}.png` });
    await p.evaluate(() => { window.__slide.app.input.override = null; window.__slide.app.quitToMenu && window.__slide.app.quitToMenu(false); }); await p.waitForTimeout(800);
  }
};
