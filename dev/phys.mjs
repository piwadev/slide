import { carById } from '../js/data/cars.js';
import { defaultCfg } from '../js/data/parts.js';
import { Vehicle } from '../js/game/vehicle.js';
const id = process.argv[2] || 's13';
const car = carById[id]; const cfg = defaultCfg(car); const V = new Vehicle(car, cfg);
const dt = 1/120; const log = [];
function run(name, T, f, pre) {
  V.reset(0,0,0); if (pre) pre(V); let t=0, out=[]; 
  while (t < T) { const inp = f(t, V); V.step(dt, inp); t += dt; if (Math.floor(t/0.2) !== Math.floor((t-dt)/0.2)) out.push(`${t.toFixed(2)}s v=${(V.speed*3.6).toFixed(0)}km/h g${V.gear} rpm=${V.rpm.toFixed(0)} beta=${(V.beta*57.3).toFixed(0)}° r=${V.r.toFixed(2)} steer=${(V.steer*57.3).toFixed(0)} yaw=${(V.yaw*57.3).toFixed(0)}`); }
  console.log('== ' + name); console.log(out.join('\n'));
}
if (process.argv[3] === 'accel') { run('accel', 20, () => ({ throttle: 1 })); }
if (process.argv[3] === 'drift') {
  run('drift initiation (handbrake)', 7, (t) => { if (t < 1.0) return { throttle: 0.8 };
    if (t < 1.35) return { throttle: 0.7, steer: 1, hb: 0 }; if (t < 1.75) return { throttle: 1, steer: 0.4, hb: 1 }; if (t < 3.4) return { throttle: 0.85, steer: -0.2 }; if (t < 5.5) return { throttle: 0.8, steer: 0.0}; return { throttle: 0.5, steer: 0 }; }, (V) => { V.vz = 22; V.gear = 3; });
  run('drift: hb pulse then hold', 8, (t) => { if (t < 0.8) return { throttle: 0.8 };
    if (t < 1.2) return { throttle: 0.9, steer: 0.8 }; if (t < 1.5) return { throttle: 1, steer: 0.5, hb: 1 }; if (t < 5.5) return { throttle: 1, steer: 0.6 }; return { throttle: 0.5, steer: 0 }; }, (V) => { V.vz = 22; V.gear = 3; });
  run('drift initiation (clutch kick)', 7, (t) => { if (t < 0.5) return { throttle: 0.8 };
    if (t < 0.9) return { throttle: 1, steer: 1 }; if (t < 1.3) return { throttle: 1, steer: -0.6, kick: t<1.0 }; if (t<5) return { throttle: 0.9, steer: 0 }; return { throttle: 0.5 }; }, (V) => { V.vz = 24; V.gear = 3; });
}
if (process.argv[3] === 'grip') { run('steady corner', 6, (t) => ({ throttle: 0.4, steer: 0.35 }), (V)=>{V.vz=15; V.gear=3}); }
