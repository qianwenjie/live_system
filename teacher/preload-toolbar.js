const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('toolbarAPI', {
  sendAction: (action) => ipcRenderer.send('toolbar-action', action),
  onStateUpdate: (cb) => ipcRenderer.on('state-update', (e, state) => cb(state)),
  onTimerTick: (cb) => ipcRenderer.on('timer-tick', (e, data) => cb(data)),
  dragStart: () => ipcRenderer.send('toolbar-drag-start'),
  showDeviceMenu: (type, devices, currentId) =>
    ipcRenderer.send('show-device-menu', type, devices, currentId),
  onDeviceSelected: (cb) =>
    ipcRenderer.on('device-selected', (e, type, id) => cb(type, id)),
});
