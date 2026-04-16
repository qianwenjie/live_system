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
  setIgnoreMouseEvents: (ignore, opts) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, opts || {}),
  // 聊天同步
  requestChatData: () => ipcRenderer.send('chat-request-data'),
  onChatInit: (cb) => ipcRenderer.on('chat-init', (e, data) => cb(data)),
  onChatNewMsg: (cb) => ipcRenderer.on('chat-new-msg', (e, msg) => cb(msg)),
  sendChatNewMsg: (msg) => ipcRenderer.send('chat-new-msg-from-panel', msg),
  sendChatMute: (data) => ipcRenderer.send('chat-mute-from-panel', data),
  onChatMuteSync: (cb) => ipcRenderer.on('chat-mute-sync', (e, data) => cb(data)),
  onVbgInit: (cb) => ipcRenderer.on('vbg-init', (e, bgId) => cb(bgId)),
  onVbgApplied: (cb) => ipcRenderer.on('vbg-applied', (e, bgId) => cb(bgId)),
});
