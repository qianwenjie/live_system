const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pipAPI', {
  onStream: (cb) => ipcRenderer.on('pip-stream', (e, data) => cb(data)),
  sendAction: (action) => ipcRenderer.send('toolbar-action', action),
});
