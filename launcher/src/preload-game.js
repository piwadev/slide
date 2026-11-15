// Bridge exposed to the game page inside the launcher: file-based saves instead of localStorage.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kowNative', {
  loadSave: () => ipcRenderer.sendSync('kow:loadSave'),
  saveSync: (text, reason) => ipcRenderer.sendSync('kow:saveSync', text, reason),
  resetSave: () => ipcRenderer.sendSync('kow:resetSave'),
  info: () => ipcRenderer.sendSync('kow:info'),
});
