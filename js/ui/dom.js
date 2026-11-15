// tiny DOM helpers
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const money = (n) => '$' + fmt(n);
export const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function fmtTime(t) { if (!t) return '--:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; }
export const stars = (n, max = 3) => '★'.repeat(n) + '<span class="dim">' + '★'.repeat(max - n) + '</span>';
