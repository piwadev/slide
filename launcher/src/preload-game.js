// Bridge exposed to the game page inside the launcher: file-based saves instead of localStorage.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('slideNative', {
  loadSave: () => ipcRenderer.sendSync('slide:loadSave'),
  saveSync: (text, reason) => ipcRenderer.sendSync('slide:saveSync', text, reason),
  resetSave: () => ipcRenderer.sendSync('slide:resetSave'),
  info: () => ipcRenderer.sendSync('slide:info'),
});
