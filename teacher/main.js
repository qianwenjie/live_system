const { app, BrowserWindow, ipcMain, session, desktopCapturer, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let win, toolbarWin, pipWin, chatWin;
let borderProcs = [];
let liveSeconds = 0, networkSignal = 3, timerInterval = null;
let shareState = { micOn: false, camOn: false, chatOpen: false };

function createWindow() {
  win = new BrowserWindow({
    width: 420, height: 580,
    minWidth: 420, minHeight: 580,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(['media', 'display-capture', 'mediaKeySystem'].includes(permission));
  });

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' });
    });
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.openDevTools({ mode: 'detach' });
}

function createBorder(data) {
  // 先 kill 旧进程
  borderProcs.forEach(p => { try { p.kill(); } catch(e) {} });
  borderProcs = [];

  const bin = path.join(__dirname, 'native', 'corner-overlay');
  const mode = data && data.mode === 'window' ? 'window' : 'screen';
  const windowIds = (data && data.windowIds) || [];

  if (mode === 'screen') {
    const p = spawn(bin, ['screen']);
    p.on('error', () => {});
    borderProcs = [p];
  } else {
    // 单进程处理所有 windowId，Swift 端做合并逻辑
    const p = spawn(bin, ['window', ...windowIds.map(String)]);
    p.on('error', () => {});
    borderProcs = [p];
  }
}

function createToolbar() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  toolbarWin = new BrowserWindow({
    width: 560, height: 60,
    x: Math.round((width - 560) / 2),
    y: height - 80,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload-toolbar.js')
    }
  });
  toolbarWin.loadFile(path.join(__dirname, 'toolbar.html'));
  toolbarWin.setAlwaysOnTop(true, 'screen-saver');
  toolbarWin.on('closed', () => { toolbarWin = null; });
}

function createPip() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  pipWin = new BrowserWindow({
    width: 200, height: 150,
    x: width - 220, y: 20,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload-pip.js')
    }
  });
  pipWin.loadFile(path.join(__dirname, 'pip.html'));
  pipWin.setAlwaysOnTop(true, 'screen-saver');
  pipWin.webContents.once('did-finish-load', () => {
    pipWin.webContents.send('pip-stream', {});
  });
  pipWin.on('closed', () => { pipWin = null; });
}

function activateWindows(windowIds) {
  if (!windowIds || !windowIds.length) return;
  const bin = path.join(__dirname, 'native', 'corner-overlay');
  const p = spawn(bin, ['activate', ...windowIds.map(String)]);
  p.on('error', () => {});
}

function startShareMode(data) {
  shareState = { micOn: data.micOn || false, camOn: data.camOn || false, chatOpen: false, screenLabel: data.screenLabel || '共享中' };
  liveSeconds = data.seconds || 0;
  networkSignal = data.signal || 3;

  createToolbar();
  createBorder({ mode: data.borderMode || 'screen', windowIds: data.windowIds || [] });
  if (data.borderMode === 'window' && data.windowIds && data.windowIds.length) {
    activateWindows(data.windowIds);
  }
  if (shareState.camOn) createPip();

  // 隐藏主窗口
  if (win) win.hide();

  // 启动计时器，每秒推送给 toolbar
  timerInterval = setInterval(() => {
    liveSeconds++;
    if (Math.random() < 0.05) networkSignal = Math.floor(Math.random() * 4) + 1;
    if (toolbarWin) toolbarWin.webContents.send('timer-tick', { seconds: liveSeconds, signal: networkSignal });
    // 同步回主窗口
    if (win) win.webContents.send('toolbar-action', '__tick__');
  }, 1000);

  // 推送初始状态
  setTimeout(() => {
    if (toolbarWin) toolbarWin.webContents.send('state-update', shareState);
  }, 500);
}

function stopShareMode() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (toolbarWin) { toolbarWin.close(); toolbarWin = null; }
  if (pipWin) { pipWin.close(); pipWin = null; }
  if (chatWin) { chatWin.close(); chatWin = null; }
  borderProcs.forEach(p => { try { p.kill(); } catch(e) {} });
  borderProcs = [];
  if (win) { win.show(); win.focus(); }
}

// IPC: 获取屏幕/窗口源列表
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 200, height: 130 } });
    console.log('[get-sources] raw count:', sources.length);
    const result = sources
      .filter(s => s.name && s.name.trim())
      .map(s => ({
        id: s.id,
        windowId: s.id.split(':')[1],
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
      }));
    console.log('[get-sources] filtered count:', result.length);
    return result;
  } catch (err) {
    console.error('[get-sources] error:', err);
    return [];
  }
});

// IPC: 登录成功，主窗口放大
ipcMain.on('login-success', () => {
  if (!win) return;
  win.setResizable(true);
  win.setMinimumSize(960, 600);
  win.setSize(1280, 800);
  win.center();
});

// IPC: 开始共享
ipcMain.on('screen-share-start', (e, data) => {
  startShareMode(data);
});

// IPC: 停止共享
ipcMain.on('screen-share-stop', () => {
  stopShareMode();
  if (win) win.webContents.send('toolbar-action', 'stop');
});

// IPC: 工具条按钮操作
ipcMain.on('toolbar-action', (e, action) => {
  if (action === 'stop') {
    stopShareMode();
    if (win) win.webContents.send('toolbar-action', 'stop');
    return;
  }
  if (action === 'mic') {
    shareState.micOn = !shareState.micOn;
    if (toolbarWin) toolbarWin.webContents.send('state-update', shareState);
    if (win) win.webContents.send('toolbar-action', 'mic');
    return;
  }
  if (action === 'cam') {
    shareState.camOn = !shareState.camOn;
    if (shareState.camOn && !pipWin) createPip();
    if (!shareState.camOn && pipWin) { pipWin.close(); pipWin = null; }
    if (toolbarWin) toolbarWin.webContents.send('state-update', shareState);
    if (win) win.webContents.send('toolbar-action', 'cam');
    return;
  }
  if (action === 'chat') {
    shareState.chatOpen = !shareState.chatOpen;
    if (toolbarWin) toolbarWin.webContents.send('state-update', shareState);
    if (win) win.webContents.send('chat-toggle');
    // 显示/隐藏主窗口的互动区（把主窗口临时显示出来）
    if (win) {
      if (shareState.chatOpen) { win.show(); win.focus(); }
      else { win.hide(); }
    }
    return;
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
