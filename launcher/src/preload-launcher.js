const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('launcher', {
  state: () => call('l:state'),
  check: () => call('l:check'),
  install: () => call('l:install'),
  play: () => call('l:play'),
  rollback: () => call('l:rollback'),
  updateLauncher: () => call('l:updateLauncher'),
  openSaves: () => call('l:openSaves'),
  backupSave: () => call('l:backupSave'),
  restoreSave: () => call('l:restoreSave'),
  cloudBackup: () => call('l:cloudBackup'),
  cloudRestore: () => call('l:cloudRestore'),
  chooseCloudDir: () => call('l:chooseCloudDir'),
  setSettings: p => call('l:setSettings', p),
  openExternal: u => call('l:openExternal', u),
  openLogs: () => call('l:openLogs'),
  onStatus: cb => ipcRenderer.on('l:status', (_e, s) => cb(s)),
  onProgress: cb => ipcRenderer.on('l:progress', (_e, p) => cb(p)),
  onStateChanged: cb => ipcRenderer.on('l:state-changed', () => cb()),
  onToast: cb => ipcRenderer.on('l:toast', (_e, t) => cb(t)),
});
