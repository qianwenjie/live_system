const { app, BrowserWindow, ipcMain, session, desktopCapturer, screen, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let win, toolbarWin, pipWin, chatWin, vbgWin;
let borderProcs = [];
let liveSeconds = 0, networkSignal = 3, timerInterval = null;
let shareState = { micOn: false, camOn: false, chatOpen: false };
let currentVbgId = 'none';

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
  // win.webContents.openDevTools({ mode: 'detach' });
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
  // 窗口加高到 320px，透明区域用于显示自定义下拉面板
  toolbarWin = new BrowserWindow({
    width: 660, height: 320,
    x: Math.round((width - 660) / 2),
    y: height - 320 - 14,
    frame: false, transparent: true, hasShadow: false,
    alwaysOnTop: true, resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload-toolbar.js')
    }
  });
  toolbarWin.loadFile(path.join(__dirname, 'toolbar.html'));
  toolbarWin.setAlwaysOnTop(true, 'screen-saver');
  toolbarWin.setIgnoreMouseEvents(true, { forward: true });
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
    if (currentVbgId !== 'none') {
      pipWin.webContents.send('vbg-change', currentVbgId);
    }
  });
  pipWin.on('closed', () => { pipWin = null; });
}

function createChatPanel() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const panelW = 320, panelH = Math.min(640, height - 100);
  chatWin = new BrowserWindow({
    width: panelW, height: panelH,
    x: width - panelW - 12, y: Math.round((height - panelH) / 2),
    frame: false, transparent: true, hasShadow: false,
    alwaysOnTop: true, resizable: false, skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload-toolbar.js')
    }
  });
  chatWin.loadFile(path.join(__dirname, 'chat-panel.html'));
  chatWin.setAlwaysOnTop(true, 'screen-saver');
  chatWin.on('closed', () => {
    chatWin = null; shareState.chatOpen = false;
    if (toolbarWin) toolbarWin.webContents.send('state-update', shareState);
  });
}

function closePip() {
  if (!pipWin) return;
  const w = pipWin;
  pipWin = null;
  try {
    w.webContents.executeJavaScript('if(typeof stopStream==="function")stopStream()')
      .catch(() => {})
      .finally(() => { try { w.close(); } catch(e) {} });
  } catch(e) {
    try { w.close(); } catch(e2) {}
  }
}

function createVbgModal(curBg) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const mW = 480, mH = 520;
  vbgWin = new BrowserWindow({
    width: mW, height: mH,
    x: Math.round((width - mW) / 2), y: Math.round((height - mH) / 2),
    frame: false, transparent: true, hasShadow: false,
    alwaysOnTop: true, resizable: false, skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload-toolbar.js')
    }
  });
  vbgWin.loadFile(path.join(__dirname, 'vbg-modal.html'));
  vbgWin.setAlwaysOnTop(true, 'screen-saver');
  vbgWin.webContents.once('did-finish-load', () => {
    vbgWin.webContents.send('vbg-init', curBg || 'none');
  });
  vbgWin.on('closed', () => { vbgWin = null; });
}

function activateWindows(windowIds) {
  if (!windowIds || !windowIds.length) return;
  const bin = path.join(__dirname, 'native', 'corner-overlay');
  const p = spawn(bin, ['activate', ...windowIds.map(String)]);
  p.on('error', () => {});
}

function startShareMode(data) {
  shareState = { micOn: data.micOn || false, camOn: data.camOn || false, chatOpen: false, screenLabel: data.screenLabel || '共享中', appIcons: data.appIcons || [] };
  currentVbgId = data.vbgId || 'none';
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
  if (pipWin) {
    try {
      pipWin.webContents.executeJavaScript('if(typeof stopStream==="function")stopStream()').catch(() => {});
    } catch(e) {}
    try { pipWin.close(); } catch(e) {}
    pipWin = null;
  }
  if (chatWin) { chatWin.close(); chatWin = null; }
  if (vbgWin) { vbgWin.close(); vbgWin = null; }
  currentVbgId = 'none';
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
    const seen = new Set();
    return result.filter(Boolean).filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
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
  // 虚拟背景切换
  if (action.startsWith('vbg:')) {
    const bgId = action.slice(4);
    currentVbgId = bgId;
    if (pipWin) pipWin.webContents.send('vbg-change', bgId);
    if (toolbarWin) toolbarWin.webContents.send('vbg-applied', bgId);
    if (win) win.webContents.send('toolbar-action', 'vbg-sync:' + bgId);
    return;
  }
  // 打开虚拟背景弹窗
  if (action.startsWith('open-vbg')) {
    const curBg = action.includes(':') ? action.split(':')[1] : 'none';
    if (vbgWin) { vbgWin.focus(); return; }
    createVbgModal(curBg);
    return;
  }
  // 关闭虚拟背景弹窗
  if (action === 'close-vbg-modal') {
    if (vbgWin) { vbgWin.close(); vbgWin = null; }
    return;
  }
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
    if (!shareState.camOn && pipWin) closePip();
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
  if (action === 'virtual-bg') {
    if (win) { win.show(); win.webContents.send('toolbar-action', 'virtual-bg'); }
    return;
  }
});

// IPC: 原生设备选择菜单
ipcMain.on('show-device-menu', (e, type, devices, currentId) => {
  const template = devices.map(d => ({
    label: d.label || (type === 'mic' ? '麦克风' : '摄像头'),
    type: 'radio',
    checked: d.id === currentId,
    click: () => {
      if (toolbarWin) toolbarWin.webContents.send('device-selected', type, d.id);
    }
  }));
  if (!template.length) template.push({ label: '未检测到设备', enabled: false });
  const menu = Menu.buildFromTemplate(template);
  const win = BrowserWindow.fromWebContents(e.sender);
  menu.popup({ window: win });
});

// IPC: 虚拟背景切换，转发给 pip 窗口
ipcMain.on('vbg-change', (e, bgId) => {
  if (pipWin) pipWin.webContents.send('vbg-change', bgId);
});

// IPC: 透明区域点击穿透
ipcMain.on('set-ignore-mouse-events', (e, ignore, opts) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.setIgnoreMouseEvents(ignore, opts || {});
});

// IPC: 聊天同步 — 主窗口回传初始数据
ipcMain.on('chat-data', (e, data) => {
  if (chatWin) chatWin.webContents.send('chat-init', data);
});

// IPC: 聊天面板主动请求数据
ipcMain.on('chat-request-data', () => {
  if (win) win.webContents.send('chat-request');
});

// IPC: 聊天面板发消息 → 转发给主窗口
ipcMain.on('chat-new-msg-from-panel', (e, msg) => {
  if (win) win.webContents.send('chat-new-msg', msg);
});

// IPC: 主窗口发消息 → 转发给聊天面板
ipcMain.on('chat-new-msg-from-main', (e, msg) => {
  if (chatWin) chatWin.webContents.send('chat-new-msg', msg);
});

// IPC: 聊天面板禁言操作 → 转发给主窗口
ipcMain.on('chat-mute-from-panel', (e, data) => {
  if (win) win.webContents.send('chat-mute-sync', data);
});

// IPC: 全屏切换
ipcMain.on('toggle-fullscreen', () => {
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
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
