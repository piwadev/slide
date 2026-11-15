// Career ladder + daily challenge templates + achievements. Data-driven: add a row to extend the game.
import { MAPS } from './maps.js';
export const TIERS = [
  { id: 1, name: 'Rookie', lvl: 1, color: '#9ad17a' }, { id: 2, name: 'Street', lvl: 4, color: '#5cc6ff' }, { id: 3, name: 'Pro', lvl: 8, color: '#ffd24a' },
  { id: 4, name: 'Elite', lvl: 13, color: '#ff9a3c' }, { id: 5, name: 'Master', lvl: 19, color: '#ff5a5a' }, { id: 6, name: 'Legend', lvl: 26, color: '#c27bff' },
];
// [name, map, mode, tier, a, b]  mode: challenge (a=target score, b=time s) | timeattack (a=laps, b=pace factor) | tandem (a=target score, b=time s)
const ROWS = [
  ['Tokyo Warm-Up', 'tokyo', 'challenge', 1, 2500, 100], ['Arena Basics', 'arena', 'challenge', 1, 3500, 100], ['Cone Dance', 'industrial', 'timeattack', 1, 1, 0.8], ['Midnight Tandem', 'tokyo', 'tandem', 1, 3000, 120], ['Rookie Cup', 'arena', 'timeattack', 1, 2, 0.8],
  ['Touge Intro', 'mountain', 'challenge', 2, 6500, 110], ['Neon Chain', 'tokyo', 'challenge', 2, 9000, 110], ['Lot Sprint', 'industrial', 'timeattack', 2, 2, 0.85], ['Arena Tandem', 'arena', 'tandem', 2, 6500, 120], ['Downhill Run', 'mountain', 'timeattack', 2, 1, 0.85],
  ['Harbor Sweepers', 'harbor', 'challenge', 3, 14000, 120], ['Touge Battle', 'mountain', 'tandem', 3, 9000, 130], ['Arena Pro Cup', 'arena', 'timeattack', 3, 3, 0.9], ['Container Maze', 'industrial', 'challenge', 3, 16000, 110], ['Tokyo Midnight Run', 'tokyo', 'timeattack', 3, 2, 0.9],
  ['Dock Tandem', 'harbor', 'tandem', 4, 14000, 140], ['Desert Burn', 'desert', 'challenge', 4, 22000, 130], ['Harbor Time Attack', 'harbor', 'timeattack', 4, 2, 0.94], ['Tokyo Elite Chain', 'tokyo', 'challenge', 4, 26000, 120], ['Highway Tandem', 'desert', 'tandem', 4, 18000, 140],
  ['Touge Master', 'mountain', 'challenge', 5, 38000, 140], ['Arena Masters', 'arena', 'tandem', 5, 30000, 150], ['Desert Time Attack', 'desert', 'timeattack', 5, 2, 0.98], ['Industrial Inferno', 'industrial', 'challenge', 5, 48000, 130], ['Harbor Showdown', 'harbor', 'tandem', 5, 36000, 150],
  ['Legend: Tokyo', 'tokyo', 'challenge', 6, 70000, 150], ['Legend: Touge', 'mountain', 'timeattack', 6, 2, 1.02], ['Legend: Desert', 'desert', 'challenge', 6, 85000, 150], ['Legend: Arena Final', 'arena', 'tandem', 6, 70000, 160], ['KING OF SLIDE', 'tokyo', 'tandem', 6, 100000, 170],
];
const TIER_CASH = [0, 2200, 6000, 14000, 30000, 60000, 120000];
export const EVENTS = ROWS.map((r, i) => {
  const [name, map, mode, tier, a, b] = r; const t = TIERS[tier - 1], mp = MAPS[map];
  const e = { id: 'e' + (i + 1), n: i + 1, name, map, mode, tier, lvl: Math.max(t.lvl, mp.level), reward: { cash: Math.round(TIER_CASH[tier] * (0.8 + (i % 5) * 0.12) / 100) * 100, xp: tier * 120 + (i % 5) * 40, dp: tier * 12 + (i % 5) * 4 } };
  if (mode === 'timeattack') { e.laps = a; e.pace = b; e.desc = `${a} lap${a > 1 ? 's' : ''} — beat the par time.`; }
  else { e.target = a; e.time = b; e.stars = [a, Math.round(a * 1.7), Math.round(a * 2.6)]; e.desc = mode === 'tandem' ? `Chase the lead car and reach ${a.toLocaleString()} pts in ${b}s.` : `Reach ${a.toLocaleString()} pts before the clock runs out (${b}s).`; }
  return e;
});
export const eventById = Object.fromEntries(EVENTS.map(e => [e.id, e]));
export const MODE_NAMES = { challenge: 'Drift Challenge', timeattack: 'Time Attack', tandem: 'Tandem Drift', free: 'Free Roam' };

// daily challenge templates: stat key tracked live; target scales with level
export const DAILY_POOL = [
  { id: 'total', text: 'Bank {n} drift points', stat: 'score', base: 6000, per: 500, unit: 'pts' },
  { id: 'combo', text: 'Reach a {n}-point combo', stat: 'bestCombo', max: true, base: 2500, per: 250, unit: 'pts' },
  { id: 'angle', text: 'Hit a drift angle of {n}°', stat: 'bestAngle', max: true, base: 55, per: 0.4, cap: 80, unit: '°' },
  { id: 'near', text: 'Pull off {n} near misses', stat: 'nearMiss', base: 6, per: 0.3, unit: '' },
  { id: 'dist', text: 'Drive {n} km', stat: 'km', base: 4, per: 0.15, unit: 'km' },
  { id: 'mult', text: 'Reach a x{n} multiplier', stat: 'bestMult', max: true, base: 4, per: 0.08, cap: 9, unit: 'x' },
  { id: 'long', text: 'Hold one drift for {n} seconds', stat: 'longest', max: true, base: 6, per: 0.1, cap: 15, unit: 's' },
  { id: 'tandem', text: 'Earn {n} tandem points', stat: 'tandemPts', base: 1500, per: 120, unit: 'pts' },
  { id: 'event', text: 'Complete {n} event', stat: 'events', base: 1, per: 0, unit: '' },
  { id: 'chain', text: 'Link {n} corners in one chain', stat: 'bestChain', max: true, base: 3, per: 0.06, cap: 8, unit: '' },
];
export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Slide', desc: 'Bank your first drift', test: s => s.drifts >= 1 },
  { id: 'c1k', name: 'Warming Up', desc: 'Reach a 1,000-point combo', test: s => s.bestCombo >= 1000 },
  { id: 'c10k', name: 'Combo Artist', desc: 'Reach a 10,000-point combo', test: s => s.bestCombo >= 10000 },
  { id: 'c50k', name: 'Drift Legend', desc: 'Reach a 50,000-point combo', test: s => s.bestCombo >= 50000 },
  { id: 'a60', name: 'Sideways', desc: 'Hit a drift angle of 60°', test: s => s.bestAngle >= 60 },
  { id: 'a80', name: 'Almost Backwards', desc: 'Hit a drift angle of 80°', test: s => s.bestAngle >= 80 },
  { id: 'long10', name: 'Marathon Slide', desc: 'Hold one drift for 10 seconds', test: s => s.longest >= 10 },
  { id: 'near50', name: 'Hair Raiser', desc: '50 near misses', test: s => s.nearMiss >= 50 },
  { id: 'km100', name: 'Road Warrior', desc: 'Drive 100 km', test: s => s.km >= 100 },
  { id: 'tan', name: 'Tandem Partner', desc: 'Earn 5,000 tandem points', test: s => s.tandemPts >= 5000 },
  { id: 'mult8', name: 'Multiplier Maniac', desc: 'Reach a x8 multiplier', test: s => s.bestMult >= 8 },
  { id: 'ev5', name: 'Rising Star', desc: 'Win 5 events', test: s => s.eventsWon >= 5 },
  { id: 'ev15', name: 'Street Champion', desc: 'Win 15 events', test: s => s.eventsWon >= 15 },
  { id: 'spd', name: 'Need for Speed', desc: 'Reach 250 km/h', test: s => s.topSpeed >= 250 },
  { id: 'scoreM', name: 'Millionaire Slider', desc: 'Bank 1,000,000 lifetime points', test: s => s.totalScore >= 1000000 },
  { id: 'discover', name: 'Explorer', desc: 'Discover 10 locations', test: s => s.discovered >= 10 },
  { id: 'cars5', name: 'Collector', desc: 'Own 5 cars', test: (s, p) => Object.keys(p.save.owned).length >= 5 },
  { id: 'tuner', name: 'Tuner', desc: 'Fully upgrade a car', test: (s, p) => Object.values(p.save.owned).some(o => Object.values(o.cfg.perf).every(v => v >= 3)) },
  { id: 'lvl20', name: 'Veteran', desc: 'Reach level 20', test: (s, p) => p.save.level >= 20 },
];
