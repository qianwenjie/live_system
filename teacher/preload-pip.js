const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pipAPI', {
  onStream: (cb) => ipcRenderer.on('pip-stream', (e, data) => cb(data)),
  onVbgChange: (cb) => ipcRenderer.on('vbg-change', (e, bgId) => cb(bgId)),
  sendAction: (action) => ipcRenderer.send('toolbar-action', action),
});
