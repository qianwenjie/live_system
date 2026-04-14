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

function createChatPanel() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const panelW = 320, panelH = Math.min(600, height - 100);
  chatWin = new BrowserWindow({
    width: panelW, height: panelH,
    x: width - panelW - 12, y: Math.round((height - panelH) / 2),
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload-toolbar.js')
    }
  });
  chatWin.loadFile(path.join(__dirname, 'chat-panel.html'));
  chatWin.setAlwaysOnTop(true, 'screen-saver');
  chatWin.on('closed', () => { chatWin = null; shareState.chatOpen = false; if (toolbarWin) toolbarWin.webContents.send('state-update', shareState); });
}

function activateWindows(windowIds) {
  if (!windowIds || !windowIds.length) return;
  const bin = path.join(__dirname, 'native', 'corner-overlay');
  const p = spawn(bin, ['activate', ...windowIds.map(String)]);
  p.on('error', () => {});
}

function startShareMode(data) {
  shareState = { micOn: data.micOn || false, camOn: data.camOn || false, chatOpen: false, screenLabel: data.screenLabel || '共享中', appIcons: data.appIcons || [] };
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

// 通过 Swift 工具获取 windowId 对应的 app icon（base64 PNG）
function getAppIcon(windowId) {
  return new Promise((resolve) => {
    const bin = path.join(__dirname, 'native', 'corner-overlay');
    const p = spawn(bin, ['icon', String(windowId)]);
    let out = '';
    p.stdout.on('data', d => { out += d.toString(); });
    p.on('close', () => resolve(out.trim() ? 'data:image/png;base64,' + out.trim() : null));
    p.on('error', () => resolve(null));
    setTimeout(() => { try { p.kill(); } catch(e) {} resolve(null); }, 2000);
  });
}

// 批量截图多个窗口（一个进程、一次 SCK 查询），返回 { "wid": "data:image/png;base64,..." }
function captureWindows(windowIds) {
  if (!windowIds.length) return Promise.resolve({});
  return new Promise((resolve) => {
    const bin = path.join(__dirname, 'native', 'corner-overlay');
    const p = spawn(bin, ['capture-windows', ...windowIds.map(String)]);
    let out = '';
    p.stdout.on('data', d => { out += d.toString(); });
    p.on('close', () => {
      try {
        const raw = JSON.parse(out.trim());
        const mapped = {};
        for (const [k, v] of Object.entries(raw)) { mapped[k] = 'data:image/png;base64,' + v; }
        resolve(mapped);
      } catch(e) { resolve({}); }
    });
    p.on('error', () => resolve({}));
    setTimeout(() => { try { p.kill(); } catch(e) {} resolve({}); }, 5000);
  });
}

// 用 Swift 获取所有窗口列表（包括最小化），返回 [{windowId, name, pid}]
function getAllWindows() {
  return new Promise((resolve) => {
    const bin = path.join(__dirname, 'native', 'corner-overlay');
    const p = spawn(bin, ['list-windows']);
    let out = '';
    p.stdout.on('data', d => { out += d.toString(); });
    p.on('close', () => {
      try { resolve(JSON.parse(out.trim())); } catch(e) { resolve([]); }
    });
    p.on('error', () => resolve([]));
    setTimeout(() => { try { p.kill(); } catch(e) {} resolve([]); }, 3000);
  });
}

// IPC: 获取屏幕/窗口源列表
ipcMain.handle('get-sources', async () => {
  try {
    const selfAppName = app.getName();
    const selfFilters = [selfAppName, 'Electron', '直播平台', 'Developer Tools'];

    const [sources, allWins] = await Promise.all([
      desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 200, height: 130 } }),
      getAllWindows()
    ]);

    // desktopCapturer 可见窗口
    const filtered = sources
      .filter(s => s.name && s.name.trim())
      .filter(s => !selfFilters.some(f => s.name.includes(f)) && !s.name.startsWith('teacher'));

    // 已被 desktopCapturer 覆盖的 owner 名
    const capturedOwners = new Set(filtered.map(s => s.name.split(' - ')[0]));

    // Swift 补全：desktopCapturer 抓不到的应用（每个 owner 只补一条，无缩略图）
    const extraOwners = new Set();
    const extra = allWins.filter(w => {
      if (!w.owner || selfFilters.some(f => w.owner.includes(f))) return false;
      if (capturedOwners.has(w.owner)) return false;
      if (extraOwners.has(w.owner)) return false;
      extraOwners.add(w.owner);
      return true;
    });

    console.log('[sources ALL]', sources.map(s => s.name + '|empty:' + s.thumbnail.isEmpty()));
    console.log('[allWins]', allWins.map(w=>w.owner));
    console.log('[extra]', extra.map(w=>w.owner));

    // 批量截图 extra 窗口（一个进程完成所有截图）
    const extraWids = extra.map(w => String(w.windowId));
    const thumbMap = await captureWindows(extraWids);

    const result = await Promise.all([
      ...filtered.map(async s => {
        const windowId = s.id.split(':')[1];
        const appIcon = await getAppIcon(windowId);
        const thumb = s.thumbnail.isEmpty() ? null : s.thumbnail.toDataURL();
        return { id: s.id, windowId, name: s.name, thumbnail: thumb, appIcon };
      }),
      ...extra.map(w => {
        const wid = String(w.windowId);
        const thumbnail = thumbMap[wid] || null;
        if (!thumbnail) return null;
        const appIcon = w.icon ? 'data:image/png;base64,' + w.icon : null;
        return { id: 'window:' + wid + ':0', windowId: wid, name: w.owner, thumbnail, appIcon };
      })
    ]);
    return result.filter(Boolean);
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
    if (shareState.chatOpen) {
      if (!chatWin) createChatPanel();
    } else {
      if (chatWin) { chatWin.close(); chatWin = null; }
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
