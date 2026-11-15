'use strict';
const $ = id => document.getElementById(id);
let S = null, toastTimer = 0, progress = null;

const fmtMB = n => (n / 1048576).toFixed(n > 10485760 ? 1 : 2) + ' MB';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function ago(ms) { if (!ms) return ''; const s = (Date.now() - ms) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return new Date(ms).toLocaleDateString(); }
function toast(text, kind) { const t = $('toast'); t.textContent = text; t.className = 'toast ' + (kind || ''); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 4200); }

// tiny, safe markdown renderer for release notes
function md(src) {
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  let html = '', inList = false;
  for (const raw of String(src || '').split(/\r?\n/)) {
    const line = raw.trimEnd(); let m;
    if ((m = /^\s*[-*]\s+(.*)/.exec(line))) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inline(m[1]) + '</li>'; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    if ((m = /^#{1,4}\s+(.*)/.exec(line))) html += '<h4>' + inline(m[1]) + '</h4>';
    else if (line.trim()) html += '<p>' + inline(line) + '</p>';
  }
  return html + (inList ? '</ul>' : '');
}

function render() {
  if (!S) return;
  const st = S.status || {}, inst = S.installed || {}, lt = S.latest;
  $('lver').textContent = 'v' + S.launcherVersion;
  $('vInstalled').textContent = inst.current ? 'v' + inst.current : 'Not installed';
  $('vLatest').textContent = lt ? 'v' + lt.version : (st.state === 'checking' ? '…' : '—');
  const sc = $('statusText').parentElement; $('statusText').textContent = st.message || (inst.current ? 'Ready to play.' : '');
  sc.className = 'vcard status ' + ({ uptodate: 'good', update: 'warn', 'launcher-required': 'warn', offline: 'warn', error: 'bad' }[st.state] || '');
  const working = ['downloading', 'extracting', 'checking'].includes(st.state) || S.busy;
  const pw = $('progressWrap'); pw.hidden = !(st.state === 'downloading' || st.state === 'extracting');
  const bar = pw.querySelector('.bar'); bar.classList.toggle('indet', st.state === 'extracting' && !(progress && progress.phase === 'extract' && progress.total > 1));

  const play = $('btnPlay'); play.disabled = !inst.current || S.gameRunning || ['downloading', 'extracting'].includes(st.state);
  $('playLabel').textContent = S.gameRunning ? 'Playing…' : (inst.current ? 'Play' : 'Installing…');
  const canUpdate = lt && lt.updateAvailable && !lt.needsNewerLauncher && !working;
  $('btnUpdate').hidden = !canUpdate; if (canUpdate) $('btnUpdate').textContent = 'Update to v' + lt.version;
  $('btnCheck').disabled = working || S.gameRunning;

  const b = $('launcherBanner'); b.hidden = !(lt && (lt.launcherUpdate || lt.needsNewerLauncher));
  if (!b.hidden) $('bannerText').textContent = lt.launcherUpdate ? `New launcher v${lt.launcher.version} available` : `Launcher ${lt.minLauncher}+ required`;

  const sv = S.save; $('saveInfo').textContent = sv.exists ? `${(sv.size / 1024).toFixed(0)} KB · saved ${ago(sv.mtime)} · ${sv.backups} backup${sv.backups === 1 ? '' : 's'}` : 'No save yet — start playing!';
  $('btnCloud').disabled = !sv.exists;
  $('btnBackup').disabled = !sv.exists;
  $('btnRestore').disabled = S.gameRunning;

  const notes = lt ? lt.notes : null;
  if (lt) { $('notes').innerHTML = md(notes) || '<p class="dim">No release notes.</p>'; $('notesVer').textContent = lt.tag || ('v' + lt.version); }
  else if (st.state === 'offline') { $('notes').innerHTML = '<p class="dim">Release notes will appear here when you are online.</p>'; }

  // settings modal
  const s = S.settings;
  $('sAutoCheck').checked = s.autoCheck; $('sAutoInstall').checked = s.autoInstall; $('sHide').checked = s.closeLauncherOnPlay; $('sAutoCloud').checked = s.autoCloud;
  $('sCloudDir').textContent = s.cloudDir || 'Not set'; $('sCloudDir').title = s.cloudDir || '';
  $('btnCloudRestore').disabled = !s.cloudDir || S.gameRunning;
  $('rbInfo').textContent = inst.previous ? `v${inst.previous} is kept on disk (current: v${inst.current}).` : 'No previous version on disk yet.';
  $('btnRollback').disabled = !inst.previous || S.gameRunning || working;
  $('pathInfo').textContent = S.paths.log;
}

async function refresh() { S = await launcher.state(); render(); }
async function act(fn, okMsg) {
  const r = await fn(); if (r && r.state) { S = r.state; render(); }
  if (r && r.ok === false && !r.cancelled) toast(r.error || 'Something went wrong', 'bad'); else if (r && r.ok && okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'good');
  await refresh(); return r;
}

launcher.onStatus(s => { if (S) { S.status = s; S.busy = ['downloading', 'extracting', 'checking'].includes(s.state); render(); } });
launcher.onProgress(p => {
  progress = p; const fill = $('barFill');
  if (p.phase === 'download') {
    const pct = p.total ? Math.min(100, p.got / p.total * 100) : 0; fill.style.width = pct.toFixed(1) + '%';
    $('pLeft').textContent = `Downloading ${fmtMB(p.got)} / ${fmtMB(p.total)}`; $('pRight').textContent = p.speed ? `${fmtMB(p.speed)}/s · ${pct.toFixed(0)}%` : '100%';
  } else { const pct = p.total ? p.got / p.total * 100 : 0; fill.style.width = pct.toFixed(0) + '%'; $('pLeft').textContent = p.total > 1 ? `Installing… ${p.got} / ${p.total} files` : 'Installing…'; $('pRight').textContent = p.total > 1 ? pct.toFixed(0) + '%' : ''; }
});
launcher.onToast(t => toast(t.text, t.kind));
if (launcher.onStateChanged) launcher.onStateChanged(refresh);

$('btnPlay').onclick = () => act(launcher.play);
$('btnCheck').onclick = () => act(launcher.check);
$('btnUpdate').onclick = () => act(launcher.install);
$('btnUpdLauncher').onclick = () => act(launcher.updateLauncher);
$('btnOpenSaves').onclick = () => act(launcher.openSaves);
$('btnBackup').onclick = () => act(launcher.backupSave, r => 'Save exported to ' + r.file);
$('btnRestore').onclick = () => act(launcher.restoreSave, 'Save restored');
$('btnCloud').onclick = async () => { if (!S.settings.cloudDir) { $('settingsModal').hidden = false; toast('Choose a cloud backup folder first', ''); return; } await act(launcher.cloudBackup); };
$('btnRelease').onclick = () => launcher.openExternal(S.repoUrl);
$('btnSettings').onclick = () => { $('settingsModal').hidden = false; };
$('btnCloseSettings').onclick = () => { $('settingsModal').hidden = true; };
$('settingsModal').addEventListener('mousedown', e => { if (e.target === $('settingsModal')) $('settingsModal').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('settingsModal').hidden = true; });
const bind = (id, key) => { $(id).onchange = async e => { S = await launcher.setSettings({ [key]: e.target.checked }); render(); }; };
bind('sAutoCheck', 'autoCheck'); bind('sAutoInstall', 'autoInstall'); bind('sHide', 'closeLauncherOnPlay'); bind('sAutoCloud', 'autoCloud');
$('btnChooseCloud').onclick = () => act(launcher.chooseCloudDir);
$('btnCloudRestore').onclick = () => act(launcher.cloudRestore, 'Save restored from cloud folder');
$('btnRollback').onclick = () => act(launcher.rollback, 'Rolled back to the previous version');
$('btnLogs').onclick = () => launcher.openLogs();

refresh();
