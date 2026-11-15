// Procedural paint / livery / sticker textures drawn on a 2048x1024 canvas that the car body samples.
// Layout (v = ring parameter t): right side band t 0.07..0.31, top band t 0.36..0.64, left side band t 0.69..0.93 (right band rotated 180deg).
import { itemOf, LIVERIES } from '../data/parts.js';
export const TEX_W = 2048, TEX_H = 1024;
const BAND = { r0: 0.07, r1: 0.31 }; // right side band in t
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

// ---------- side art (drawn into W x h canvas, front on the left)
function sideArt(ctx, W, h, cfg, car, hood) {
  const id = cfg.livery.id, c1 = cfg.livery.c1, c2 = cfg.livery.c2, c3 = cfg.livery.c3, R = rnd(7);
  ctx.save();
  const polyStripe = (y0, y1, col, skew = 0) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0 + skew); ctx.lineTo(W, y1 + skew); ctx.lineTo(0, y1); ctx.fill(); };
  switch (id) {
    case 'racing': polyStripe(h * 0.32, h * 0.44, c1); polyStripe(h * 0.5, h * 0.56, c2); break;
    case 'split': ctx.fillStyle = c3; ctx.fillRect(0, h * 0.5, W, h * 0.5); ctx.fillStyle = c2; ctx.fillRect(0, h * 0.5 - 6, W, 6); break;
    case 'speed':
      for (let i = 0; i < 26; i++) { const y = R() * h, l = 200 + R() * 700, x = R() * W * 0.8, t = 4 + R() * 18; ctx.fillStyle = i % 3 ? c1 : c2; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y - t * 0.4); ctx.lineTo(x + l, y + t * 0.4); ctx.closePath(); ctx.fill(); } break;
    case 'flames': {
      for (let k = 0; k < 3; k++) { ctx.fillStyle = [c2, c1, '#fff3b0'][k]; ctx.beginPath(); ctx.moveTo(0, h * 0.9);
        for (let i = 0; i <= 14; i++) { const x = (i / 14) * W * (0.62 - k * 0.06), up = 0.25 + 0.18 * Math.abs(Math.sin(i * 1.7 + k)) + (i % 2 ? 0.1 : 0); ctx.quadraticCurveTo(x - 22, h * (0.82 - up * 0.2), x + 20, h * (0.9 - up * (0.9 - k * 0.2))); }
        ctx.lineTo(W * (0.62 - k * 0.06), h); ctx.lineTo(0, h); ctx.fill(); } break; }
    case 'samurai': {
      ctx.fillStyle = c2; for (let i = 0; i < 70; i++) { const x = W * (0.4 + R() * 0.55), y = h * (0.15 + R() * 0.8), r = 2 + R() * 14; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); if (R() > 0.7) { ctx.fillRect(x, y, 3, 20 + R() * 30); } }
      ctx.fillStyle = '#0b0b0d'; const sx = W * 0.66, sy = h * 0.5;
      ctx.beginPath(); ctx.moveTo(sx - 120, sy + h * 0.5); ctx.bezierCurveTo(sx - 160, sy - 20, sx - 90, sy - h * 0.45, sx - 20, sy - h * 0.46); ctx.lineTo(sx + 30, sy - h * 0.62); ctx.lineTo(sx + 60, sy - h * 0.44); ctx.bezierCurveTo(sx + 110, sy - h * 0.3, sx + 160, sy, sx + 190, sy + h * 0.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#0b0b0d'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx - 240, sy - h * 0.1); ctx.lineTo(sx + 300, sy - h * 0.62); ctx.stroke();
      ctx.strokeStyle = c1; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx - 225, sy - h * 0.1); ctx.lineTo(sx + 285, sy - h * 0.6); ctx.stroke();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(W * 0.9, h * 0.3, h * 0.2, 0, 7); ctx.fill(); break; }
    case 'sakura': for (let i = 0; i < 120; i++) { const x = R() * W, y = R() * h, s = 8 + R() * 18, a = R() * 6; ctx.fillStyle = i % 4 ? c2 : c1; ctx.globalAlpha = 0.9; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.55, 0, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.globalAlpha = 1; ctx.strokeStyle = '#2b1b17'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(W * 0.15, h); ctx.bezierCurveTo(W * 0.3, h * 0.5, W * 0.4, h * 0.6, W * 0.62, h * 0.12); ctx.stroke(); break;
    case 'wave': ctx.strokeStyle = c1; ctx.lineWidth = 4; for (let r = 0; r < 7; r++) { ctx.beginPath(); for (let x = 0; x <= W; x += 14) { const y = h * (0.15 + r * 0.12) + Math.sin(x * 0.01 + r) * 14 + Math.sin(x * 0.027) * 8; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      ctx.fillStyle = c2; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(W * 0.55, h); ctx.bezierCurveTo(W * 0.6, h * 0.1, W * 0.88, h * 0.1, W * 0.84, h * 0.55); ctx.bezierCurveTo(W * 0.8, h * 0.2, W * 0.7, h * 0.4, W * 0.72, h); ctx.fill(); break;
    case 'checker': { const s = 38; for (let x = 0; x < W * 0.4; x += s) for (let y = 0; y < h; y += s) if (((x / s) + (y / s)) % 2 < 1) { ctx.fillStyle = c3; ctx.fillRect(W * 0.6 + x, y, s, s); } break; }
    case 'grid': ctx.strokeStyle = c1; ctx.lineWidth = 3; for (let x = -W; x < W * 2; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (x - W / 2) * 0.4, h); ctx.stroke(); } for (let i = 1; i < 8; i++) { ctx.strokeStyle = c2; ctx.beginPath(); ctx.moveTo(0, h * i * i / 64 + h * 0.1); ctx.lineTo(W, h * i * i / 64 + h * 0.1); ctx.stroke(); } break;
    case 'hex': ctx.fillStyle = c3; ctx.globalAlpha = 0.85; for (let y = 0, row = 0; y < h + 30; y += 26, row++) for (let x = (row % 2) * 22; x < W; x += 44) { ctx.beginPath(); for (let k = 0; k < 6; k++) ctx.lineTo(x + 18 * Math.cos(k * 1.047), y + 18 * Math.sin(k * 1.047)); ctx.closePath(); ctx.fill(); } break;
    case 'camo': for (let i = 0; i < 90; i++) { ctx.fillStyle = [c1, c2, c3][i % 3]; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(R() * W, R() * h, 40 + R() * 120, 20 + R() * 50, R() * 3, 0, 7); ctx.fill(); } break;
    case 'tiger': ctx.fillStyle = c3; for (let i = 0; i < 26; i++) { const x = W * (0.05 + i * 0.036), w = 14 + R() * 20; ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + 50, h / 2, x + 8, h); ctx.lineTo(x + w + 10, h); ctx.quadraticCurveTo(x + w + 60, h / 2, x + w, 0); ctx.fill(); } break;
    case 'fade': { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, c3); ctx.fillStyle = g; ctx.fillRect(0, 0, W, h); const g2 = ctx.createLinearGradient(0, 0, W, 0); g2.addColorStop(0, c1); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.6; ctx.fillStyle = g2; ctx.fillRect(0, 0, W, h); break; }
    case 'oni': ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(W * 0.65, h * 0.5, h * 0.46, 0, 7); ctx.fill(); ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.moveTo(W * 0.65 - 70, h * 0.2); ctx.lineTo(W * 0.65 - 120, h * 0.02); ctx.lineTo(W * 0.65 - 30, h * 0.12); ctx.fill(); ctx.beginPath(); ctx.moveTo(W * 0.65 + 70, h * 0.2); ctx.lineTo(W * 0.65 + 120, h * 0.02); ctx.lineTo(W * 0.65 + 30, h * 0.12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(W * 0.65 - 55, h * 0.45, 28, 14, 0.4, 0, 7); ctx.ellipse(W * 0.65 + 55, h * 0.45, 28, 14, -0.4, 0, 7); ctx.fill(); ctx.fillStyle = '#0b0b0d'; ctx.fillRect(W * 0.65 - 60, h * 0.7, 120, 12); for (let i = 0; i < 6; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(W * 0.65 - 55 + i * 20, h * 0.66, 10, 20); } break;
    case 'rising': ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(W * 0.62, h * 0.55, h * 0.55, 0, 7); ctx.fill(); ctx.strokeStyle = c2; ctx.lineWidth = 7; for (let i = 0; i < 22; i++) { const a = i * 0.29; ctx.beginPath(); ctx.moveTo(W * 0.62 + Math.cos(a) * h * 0.62, h * 0.55 + Math.sin(a) * h * 0.62); ctx.lineTo(W * 0.62 + Math.cos(a) * h * 1.6, h * 0.55 + Math.sin(a) * h * 1.6); ctx.stroke(); } break;
  }
  ctx.restore();
}

// ---------- stickers
const font = (px, f = 'Rubik Spray Paint, Permanent Marker, sans-serif') => `${px}px ${f}`;
export function drawSticker(ctx, id, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const txt = (t, px, f, stroke) => { ctx.font = font(px * s, f); if (stroke) { ctx.lineWidth = 6 * s; ctx.strokeStyle = stroke; ctx.strokeText(t, 0, 0); } ctx.fillText(t, 0, 0); };
  const JP = '"Yu Gothic","Hiragino Sans","Noto Sans CJK JP","Noto Serif CJK JP","MS Gothic",sans-serif';
  switch (id) {
    case 'slide': txt('SLIDE', 120, 'Knewave, Permanent Marker, sans-serif', '#000'); break;
    case 'hashiriya': txt('走り屋', 120, JP); break;
    case 'torii': ctx.lineWidth = 14 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-70 * s, -40 * s); ctx.quadraticCurveTo(0, -62 * s, 70 * s, -40 * s); ctx.moveTo(-52 * s, -14 * s); ctx.lineTo(52 * s, -14 * s); ctx.moveTo(-40 * s, -40 * s); ctx.lineTo(-40 * s, 60 * s); ctx.moveTo(40 * s, -40 * s); ctx.lineTo(40 * s, 60 * s); ctx.stroke(); break;
    case 'driftking': txt('DRIFT KING', 70, 'Bangers, Impact, sans-serif', '#000'); break;
    case 'tokyo': txt('TOKYO', 90, 'Bangers, Impact, sans-serif', '#000'); break;
    case 'touge': txt('峠', 190, JP); break;
    case 'star': ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = (i % 2 ? 26 : 62) * s, a = -1.57 + i * 0.628; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
    case 'skull': ctx.beginPath(); ctx.arc(0, -8 * s, 46 * s, 0, 7); ctx.fill(); ctx.fillRect(-26 * s, 20 * s, 52 * s, 30 * s); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-18 * s, -8 * s, 12 * s, 0, 7); ctx.arc(18 * s, -8 * s, 12 * s, 0, 7); ctx.fill(); ctx.fillRect(-4 * s, 10 * s, 8 * s, 14 * s); for (let i = -2; i <= 2; i++) ctx.fillRect(i * 10 * s - 2 * s, 30 * s, 4 * s, 18 * s); break;
    case 'bolt': ctx.beginPath(); ctx.moveTo(10 * s, -70 * s); ctx.lineTo(-34 * s, 8 * s); ctx.lineTo(-2 * s, 8 * s); ctx.lineTo(-14 * s, 70 * s); ctx.lineTo(38 * s, -14 * s); ctx.lineTo(4 * s, -14 * s); ctx.closePath(); ctx.fill(); break;
    case 'flag': for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { ctx.fillStyle = (i + j) % 2 ? col : '#101010'; ctx.fillRect((j - 3) * 18 * s, (i - 2) * 18 * s, 18 * s, 18 * s); } break;
    case 'sun': ctx.beginPath(); ctx.arc(0, 0, 30 * s, 0, 7); ctx.fill(); ctx.lineWidth = 7 * s; for (let i = 0; i < 16; i++) { const a = i * 0.3927; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 42 * s, Math.sin(a) * 42 * s); ctx.lineTo(Math.cos(a) * 72 * s, Math.sin(a) * 72 * s); ctx.stroke(); } break;
    case 'num13': ctx.beginPath(); ctx.arc(0, 0, 62 * s, 0, 7); ctx.fill(); ctx.fillStyle = '#101010'; txt('13', 78, 'Bangers, Impact, sans-serif'); break;
    case 'nitro': txt('NITRO', 100, 'Bangers, Impact, sans-serif', '#101010'); break;
    case 'kyoto': txt('魂', 200, JP); break;
    case 'sponsor': { const items = ['RS', 'KAZE', 'GReddy', 'HKS', 'A\'PEXi']; items.forEach((t, i) => { ctx.fillStyle = i % 2 ? '#fff' : '#101010'; ctx.fillRect((i - 2) * 110 * s - 50 * s, -24 * s, 100 * s, 48 * s); ctx.fillStyle = i % 2 ? '#101010' : col; ctx.save(); ctx.translate((i - 2) * 110 * s, 0); ctx.font = font(32 * s, 'Bangers, Impact, sans-serif'); ctx.fillText(t, 0, 2); ctx.restore(); }); break; }
    case 'donut': ctx.lineWidth = 20 * s; ctx.beginPath(); ctx.arc(0, 0, 40 * s, 0, 7); ctx.stroke(); ctx.fillStyle = '#101010'; txt('DONUT', 36, 'Bangers, Impact, sans-serif'); break;
  }
  ctx.restore();
}
// sticker slots: place in side-band local coords (u,v within band W x h), front at left
export const SLOT_POS = { door: [0.5, 0.45, 0.62], fender: [0.2, 0.5, 0.42], quarter: [0.83, 0.5, 0.48], hood: [0.5, 0.5, 0.8] };

// ---------- full paint canvas
export function paintCanvas(cfg, car, canvas) {
  const cv = canvas || document.createElement('canvas'); cv.width = TEX_W; cv.height = TEX_H; const ctx = cv.getContext('2d');
  ctx.fillStyle = cfg.paint.color; ctx.fillRect(0, 0, TEX_W, TEX_H);
  const sideH = Math.round((BAND.r1 - BAND.r0) * TEX_H), sideY = Math.round((1 - BAND.r1) * TEX_H);
  const side = document.createElement('canvas'); side.width = TEX_W; side.height = sideH; const sc = side.getContext('2d');
  sc.fillStyle = 'rgba(0,0,0,0)';
  if (cfg.livery.id !== 'none') sideArt(sc, TEX_W, sideH, cfg, car);
  // panel lines (door gaps) – positions as fraction of length
  sc.strokeStyle = 'rgba(0,0,0,0.55)'; sc.lineWidth = 3;
  const dA = car.sA + 0.01, dB = car.sB + (car.sC - car.sB) * 0.58, dC = Math.min(car.sC + 0.1, car.sD - 0.04);
  const line = (u0, u1, v0, v1) => { sc.beginPath(); sc.moveTo(u0 * TEX_W, v0 * sideH); sc.lineTo(u1 * TEX_W, v1 * sideH); sc.stroke(); };
  line(dA, dA + 0.004, 0.12, 0.98); line(dB, dB, 0.08, 0.98); line(dA, dB, 0.1, 0.1); line(dC, dC + 0.01, 0.1, 0.9);
  sc.fillStyle = 'rgba(20,20,20,0.7)'; sc.fillRect((dA + 0.012) * TEX_W, sideH * 0.45, 56, 8); sc.fillRect((dB + 0.012) * TEX_W, sideH * 0.45, 56, 8);
  // stickers on sides
  for (const st of cfg.stickers) { if (st.slot === 'hood') continue; const p = SLOT_POS[st.slot]; if (!p) continue; drawSticker(sc, st.id, p[0] * TEX_W, p[1] * sideH, p[2] * 0.9, st.color || '#ffffff'); }
  ctx.drawImage(side, 0, sideY);                        // right band
  ctx.save(); ctx.translate(TEX_W, TEX_H - sideY); ctx.rotate(Math.PI); // left band = rotated 180deg
  ctx.drawImage(side, 0, 0); ctx.restore();
  // top band: hood/roof art
  const topY = Math.round(0.36 * TEX_H), topH = Math.round(0.28 * TEX_H);
  ctx.save(); ctx.beginPath(); ctx.rect(0, topY, TEX_W, topH); ctx.clip();
  const id = cfg.livery.id;
  if (id === 'racing') { ctx.fillStyle = cfg.livery.c1; ctx.fillRect(0, topY + topH * 0.38, TEX_W, topH * 0.1); ctx.fillRect(0, topY + topH * 0.52, TEX_W, topH * 0.1); }
  else if (id === 'speed' || id === 'flames' || id === 'tiger' || id === 'camo' || id === 'sakura' || id === 'hex' || id === 'grid' || id === 'wave' || id === 'fade') { const t = document.createElement('canvas'); t.width = TEX_W; t.height = topH; sideArt(t.getContext('2d'), TEX_W, topH, cfg, car); ctx.drawImage(t, 0, topY); }
  else if (id === 'samurai' || id === 'oni' || id === 'rising') { ctx.fillStyle = cfg.livery.c2; ctx.beginPath(); ctx.arc(TEX_W * 0.45, topY + topH / 2, topH * 0.4, 0, 7); ctx.fill(); }
  else if (id === 'checker') { const s = 40; for (let x = 0; x < TEX_W; x += s) for (let y = 0; y < topH; y += s) if (((x / s) + (y / s)) % 2 < 1 && x > TEX_W * 0.7) { ctx.fillStyle = cfg.livery.c3; ctx.fillRect(x, topY + y, s, s); } }
  for (const st of cfg.stickers) if (st.slot === 'hood') drawSticker(ctx, st.id, TEX_W * 0.22, topY + topH / 2, 0.8, st.color || '#fff');
  ctx.restore();
  return cv;
}
export function platePng(text, w = 256, h = 128) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  c.fillStyle = '#e9e9e4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1a2a4a'; c.lineWidth = 6; c.strokeRect(5, 5, w - 10, h - 10);
  c.fillStyle = '#10264a'; c.fillRect(0, 0, 22, h); c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.fillText('JP', 4, h / 2 + 4);
  c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `bold ${Math.min(74, 380 / Math.max(5, text.length) * 1.1)}px "Barlow Condensed", sans-serif`; c.fillText((text || '').toUpperCase().slice(0, 10), w / 2 + 10, h / 2 + 4);
  return cv;
}
export function carbonCanvas() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#0c0c0e'; c.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) { const a = ((x + y) / 16) % 2; const g = c.createLinearGradient(x, y, x + 16, y + 16); g.addColorStop(0, a ? '#2a2c31' : '#17181b'); g.addColorStop(1, a ? '#0e0e10' : '#2b2d33'); c.fillStyle = g; c.fillRect(x + 1, y + 1, 14, 14); c.strokeStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); for (let k = 2; k < 16; k += 4) { if (a) { c.moveTo(x + k, y); c.lineTo(x + k, y + 16); } else { c.moveTo(x, y + k); c.lineTo(x + 16, y + k); } } c.stroke(); }
  return cv;
}
