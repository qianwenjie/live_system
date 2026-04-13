const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  loginSuccess: () => ipcRenderer.send('login-success')
});
