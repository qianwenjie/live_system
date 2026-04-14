const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  loginSuccess: () => ipcRenderer.send('login-success'),
  screenShareStart: (data) => ipcRenderer.send('screen-share-start', data),
  screenShareStop: () => ipcRenderer.send('screen-share-stop'),
  getSources: () => ipcRenderer.invoke('get-sources'),
  onToolbarAction: (cb) => ipcRenderer.on('toolbar-action', (e, action) => cb(action)),
  onChatToggle: (cb) => ipcRenderer.on('chat-toggle', (e) => cb()),
});
