const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  loginSuccess: () => ipcRenderer.send('login-success'),
  screenShareStart: (data) => ipcRenderer.send('screen-share-start', data),
  screenShareStop: () => ipcRenderer.send('screen-share-stop'),
  getSources: () => ipcRenderer.invoke('get-sources'),
  onToolbarAction: (cb) => ipcRenderer.on('toolbar-action', (e, action) => cb(action)),
  onChatToggle: (cb) => ipcRenderer.on('chat-toggle', (e) => cb()),
  // 聊天同步
  onChatRequest: (cb) => ipcRenderer.on('chat-request', () => cb()),
  sendChatData: (data) => ipcRenderer.send('chat-data', data),
  onChatNewMsg: (cb) => ipcRenderer.on('chat-new-msg', (e, msg) => cb(msg)),
  sendChatNewMsg: (msg) => ipcRenderer.send('chat-new-msg-from-main', msg),
  onChatMuteSync: (cb) => ipcRenderer.on('chat-mute-sync', (e, data) => cb(data)),
  sendVbgChange: (bgId) => ipcRenderer.send('toolbar-action', 'vbg:' + bgId),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
});
