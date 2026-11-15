// Hidden owner-only admin console. Open: Ctrl+Shift+F12, or long-press (about 1 s) on the profile card in the main menu.
// The passphrase is verified in the browser with WebCrypto PBKDF2-SHA256 against the salted verifier in js/core/adminVerifier.js
// (no plaintext anywhere). Note: this is a client-side game, so this keeps the cheats away from normal play, not from a determined local editor.
import { ADMIN_VERIFIER as V } from '../core/adminVerifier.js';
import { COMMANDS, runAdmin } from '../core/admin.js';

const hex2buf = h => Uint8Array.from(h.match(/../g).map(x => parseInt(x, 16)));
const buf2hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function derive(pass) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  return buf2hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hex2buf(V.salt), iterations: V.iter }, key, 256));
}
const sha = async t => buf2hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
const ctEq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const DEV = 'slide_admin_dev';
async function deviceOK() { try { const v = localStorage.getItem(DEV); if (!v) return false; const [tok, proof] = v.split('.'); return !!tok && ctEq(proof || '', await sha(tok + ':' + V.hash)); } catch { return false; } }
async function rememberDevice() { try { const tok = buf2hex(crypto.getRandomValues(new Uint8Array(24))); localStorage.setItem(DEV, tok + '.' + await sha(tok + ':' + V.hash)); } catch { /* ignore */ } }
const BUTTONS = [['Unlock All', 'unlockall'], ['+$1M', 'money 1000000'], ['+1000 DP', 'dp 1000'], ['+5000 XP', 'xp 5000'], ['Level 30', 'level 30'], ['Max Car', 'maxcar'], ['All Cars', 'unlockcars'], ['All Parts', 'unlockparts'], ['Complete Career', 'complete all'], ['New Dailies', 'daily'], ['Debug', 'debug'], ['Status', 'status'], ['Clear', 'clear'], ['Lock', 'lock']];

export function initAdmin(app) {
  let el = null, fails = 0, lockedUntil = 0, hist = [], hi = 0, suppressClick = 0, authed = false;
  const P = app.profile;
  async function open() {
    if (el) { el.querySelector('input')?.focus(); return; }
    el = document.createElement('div'); el.className = 'adm'; el.innerHTML = '<div class="adm-box" role="dialog" aria-label="Admin console"></div>'; document.body.appendChild(el);
    el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); e.stopPropagation(); }); el.addEventListener('pointerdown', e => { if (e.target === el) close(); });
    if (authed || await deviceOK()) { authed = true; term(); } else gate();
  }
  function close() { if (el) { el.remove(); el = null; } }
  const box = () => el.querySelector('.adm-box');
  function gate(msg = '') {
    box().innerHTML = `<div class="adm-h"><span class="adm-t">ADMIN</span><button class="adm-x" data-x>×</button></div>
      <form class="adm-gate" autocomplete="off"><label>Passphrase</label><input type="password" name="p" autocomplete="off" spellcheck="false" autofocus><label class="adm-rem"><input type="checkbox" name="r"> Remember on this device</label><button class="adm-go" type="submit">Unlock</button><div class="adm-msg">${msg}</div></form>`;
    box().querySelector('[data-x]').onclick = close;
    const f = box().querySelector('form'); setTimeout(() => f.p.focus(), 30);
    f.onsubmit = async e => {
      e.preventDefault(); const msg = box().querySelector('.adm-msg'), now = Date.now();
      if (now < lockedUntil) { msg.textContent = `Too many attempts. Wait ${Math.ceil((lockedUntil - now) / 1000)}s.`; return; }
      msg.textContent = 'Verifying…'; const val = f.p.value; f.p.value = '';
      let good = false; try { good = ctEq(await derive(val), V.hash); } catch (err) { msg.textContent = 'Crypto unavailable in this context.'; return; }
      if (good) { fails = 0; authed = true; if (f.r.checked) await rememberDevice(); term(); }
      else { fails++; if (fails >= 3) lockedUntil = Date.now() + 15000 * Math.pow(2, Math.min(5, fails - 3)); msg.textContent = 'Wrong passphrase.'; setTimeout(() => f.p.focus(), 10); }
    };
  }
  function term() {
    box().innerHTML = `<div class="adm-h"><span class="adm-t">ADMIN CONSOLE</span><span class="adm-s">owner only</span><button class="adm-x" data-x>×</button></div>
      <div class="adm-btns">${BUTTONS.map(([l, c]) => `<button data-c="${c}">${l}</button>`).join('')}</div>
      <div class="adm-out" id="admOut" tabindex="-1"></div><div class="adm-sug" id="admSug"></div>
      <div class="adm-in"><span>›</span><input id="admIn" autocomplete="off" spellcheck="false" placeholder="type a command (help) — Tab completes"></div>`;
    const out = box().querySelector('#admOut'), inp = box().querySelector('#admIn'), sug = box().querySelector('#admSug');
    const say = (t, c = '') => { const d = document.createElement('div'); d.className = 'ln ' + c; d.textContent = t; out.appendChild(d); out.scrollTop = out.scrollHeight; };
    say('Admin unlocked. Type "help" for commands.', 'g'); box().querySelector('[data-x]').onclick = close;
    const run = async line => {
      line = line.trim(); if (!line) return; say('› ' + line, 'c'); hist.push(line); hi = hist.length;
      const r = runAdmin(line, P, app);
      for (const l of r.lines || (r.error ? [r.error] : [])) say(l, r.ok ? '' : 'e');
      if (r.clear) out.innerHTML = '';
      if (r.lock) { authed = false; try { localStorage.removeItem(DEV); } catch { /* */ } say('locked.', 'g'); setTimeout(close, 300); return; }
      if (r.reset) { say('resetting save…', 'e'); setTimeout(() => { P.reset(); location.reload(); }, 400); return; }
      if (r.changed) app.refresh && app.refresh();
    };
    box().querySelectorAll('[data-c]').forEach(b => { b.onclick = () => run(b.dataset.c); });
    const names = Object.keys(COMMANDS);
    const upd = () => { const v = inp.value.trim().split(/\s+/)[0] || ''; const m = inp.value.includes(' ') ? [] : names.filter(n => n.startsWith(v.toLowerCase())); sug.innerHTML = m.length && v ? m.slice(0, 8).map(n => `<span data-n="${n}">${n}</span>`).join('') : (inp.value.includes(' ') && COMMANDS[v.toLowerCase()] ? `<em>${COMMANDS[v.toLowerCase()].usage}</em>` : ''); sug.querySelectorAll('[data-n]').forEach(s => { s.onclick = () => { inp.value = s.dataset.n + ' '; inp.focus(); upd(); }; }); };
    inp.addEventListener('input', upd);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const v = inp.value; inp.value = ''; upd(); run(v); }
      else if (e.key === 'Tab') { e.preventDefault(); const v = inp.value.trim().toLowerCase(); const m = names.filter(n => n.startsWith(v)); if (m.length) { inp.value = m[0] + ' '; upd(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) inp.value = hist[--hi]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); inp.value = hi < hist.length - 1 ? hist[++hi] : (hi = hist.length, ''); }
    });
    setTimeout(() => inp.focus(), 30);
  }
  document.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && (e.key === 'F12' || e.code === 'F12')) { e.preventDefault(); open(); } }, true);
  let timer = 0, sx = 0, sy = 0;
  document.addEventListener('pointerdown', e => { const c = e.target.closest && e.target.closest('#pcard'); if (!c) return; sx = e.clientX; sy = e.clientY; clearTimeout(timer); timer = setTimeout(() => { suppressClick = Date.now(); open(); }, 1000); }, true);
  const cancel = () => clearTimeout(timer); document.addEventListener('pointerup', cancel, true); document.addEventListener('pointercancel', cancel, true);
  document.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); }, true);
  document.addEventListener('click', e => { if (Date.now() - suppressClick < 600 && e.target.closest && e.target.closest('#pcard')) { e.stopPropagation(); e.preventDefault(); } }, true);
  app.openAdmin = open;
}
