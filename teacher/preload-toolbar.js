const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('toolbarAPI', {
  sendAction: (action) => ipcRenderer.send('toolbar-action', action),
  onStateUpdate: (cb) => ipcRenderer.on('state-update', (e, state) => cb(state)),
  onTimerTick: (cb) => ipcRenderer.on('timer-tick', (e, data) => cb(data)),
  dragStart: () => ipcRenderer.send('toolbar-drag-start'),
});
