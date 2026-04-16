// 注入暗色模式 t-* 样式
var style = document.createElement('style');
style.textContent = `
.t-student-list { flex:1; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:6px; }
.t-student-search { width:100%; padding:7px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); font-size:12px; color:rgba(255,255,255,0.9); outline:none; background:rgba(255,255,255,0.06); box-sizing:border-box; margin-bottom:4px; }
.t-student-search::placeholder { color:rgba(255,255,255,0.3); }
.t-student-search:focus { border-color:#4ade80; }
.t-student-row { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-radius:8px; background:rgba(255,255,255,0.05); }
.t-student-name { font-size:13px; color:rgba(255,255,255,0.85); }
.t-mute-btn { padding:4px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:transparent; font-size:12px; color:rgba(255,255,255,0.5); cursor:pointer; transition:.15s; white-space:nowrap; }
.t-mute-btn:hover { border-color:rgba(255,255,255,0.25); color:rgba(255,255,255,0.7); }
.t-mute-btn.muted { background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.3); color:#ef4444; }
.t-msg-list { flex:1; overflow-y:auto; padding:12px 14px; background:transparent; }
.t-msg-item { display:flex; justify-content:flex-start; margin-bottom:10px; }
.t-msg-self { justify-content:flex-end; }
.t-msg-self .t-msg-top { flex-direction:row-reverse; }
.t-msg-self .t-msg-userline { flex-direction:row-reverse; }
.t-msg-self .t-msg-bubble { background:rgba(31,139,115,0.25); border-color:rgba(31,139,115,0.35); color:#d1fae5; border-radius:14px 14px 4px 14px; }
.t-msg-body { min-width:0; max-width:88%; display:flex; flex-direction:column; }
.t-msg-self .t-msg-body { align-items:flex-end; }
.t-msg-top { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.t-msg-userline { display:flex; align-items:center; gap:6px; }
.t-msg-top strong { font-size:12px; color:rgba(255,255,255,0.85); }
.t-msg-top span { font-size:12px; color:rgba(255,255,255,0.35); }
.t-role-badge { width:18px; height:18px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:10px; color:#fff !important; flex-shrink:0; }
.t-teacher-badge { background:#f97316; }
.t-assistant-badge { background:#1f8b73; }
.t-msg-bubble { display:inline-block; max-width:100%; padding:9px 12px; border-radius:14px 14px 14px 4px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); font-size:13px; color:rgba(255,255,255,0.85); word-break:break-word; line-height:1.5; }
.t-chat-foot { padding:12px; border-top:1px solid rgba(255,255,255,0.08); flex-shrink:0; background:transparent; }
.t-input-row { display:flex; gap:8px; align-items:stretch; }
.t-chat-input { flex:1; resize:none; height:38px; padding:9px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.12); outline:none; background:rgba(255,255,255,0.06); font-size:13px; color:rgba(255,255,255,0.9); line-height:1.2; font-family:inherit; }
.t-chat-input::placeholder { color:rgba(255,255,255,0.3); }
.t-chat-input:focus { border-color:#4ade80; }
.t-send-btn { height:38px; padding:0 16px; border-radius:12px; background:#1f8b73; color:#fff; font-size:13px; font-weight:600; border:none; cursor:pointer; white-space:nowrap; transition:.18s; }
.t-send-btn:hover { background:#16a34a; }
::-webkit-scrollbar { width:5px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:4px; }
::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.25); }
`;
document.head.appendChild(style);

// 数据（从主窗口通过 IPC 同步，不再本地硬编码）
var allMuted = false;
var students = [];
var messages = [];

// 构建聊天视图
var chatView = document.getElementById('chatView');
chatView.innerHTML = '<div class="t-msg-list" id="msgList"></div>'
  + '<div class="t-chat-foot"><div class="t-input-row">'
  + '<textarea class="t-chat-input" id="msgInput" placeholder="输入消息" rows="1"></textarea>'
  + '<button class="t-send-btn" onclick="sendMsg()">发送</button>'
  + '</div></div>';
document.getElementById('msgInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
});

// 构建学生视图
var studentsView = document.getElementById('studentsView');
studentsView.innerHTML = '<div class="t-student-list">'
  + '<input class="t-student-search" id="studentSearch" placeholder="搜索学生姓名…" oninput="renderStudents()"/>'
  + '<div id="studentList"></div></div>';

function renderMessages() {
  var list = document.getElementById('msgList');
  list.innerHTML = '';
  messages.forEach(function(msg) {
    var isSelf = msg.role === 'teacher';
    var badge = '';
    if (msg.role === 'teacher') badge = '<span class="t-role-badge t-teacher-badge">讲</span>';
    else if (msg.role === 'assistant' || msg.role === 'system') badge = '<span class="t-role-badge t-assistant-badge">助</span>';
    var item = document.createElement('article');
    item.className = 't-msg-item' + (isSelf ? ' t-msg-self' : '');
    item.innerHTML = '<div class="t-msg-body"><div class="t-msg-top">'
      + '<div class="t-msg-userline">' + badge + '<strong>' + msg.user + '</strong></div>'
      + '<span>' + msg.time + '</span></div>'
      + '<p class="t-msg-bubble">' + msg.content + '</p></div>';
    list.appendChild(item);
  });
  list.scrollTop = list.scrollHeight;
}

function renderStudents() {
  var search = (document.getElementById('studentSearch') || {}).value || '';
  var list = document.getElementById('studentList');
  list.innerHTML = '';
  var count = document.getElementById('studentCount');
  if (count) count.textContent = students.length;
  students.filter(function(s) {
    return !search || s.name.includes(search);
  }).forEach(function(s) {
    var row = document.createElement('div');
    row.className = 't-student-row';
    row.innerHTML = '<span class="t-student-name">' + s.name + '</span>'
      + '<button class="t-mute-btn' + (s.muted ? ' muted' : '') + '"'
      + ' onclick="toggleMute(\'' + s.id + '\')">'
      + (s.muted ? '已禁言' : '禁言') + '</button>';
    list.appendChild(row);
  });
}

function toggleMute(id) {
  var s = students.find(function(x) { return x.id === id; });
  if (s) {
    s.muted = !s.muted;
    renderStudents();
    if (window.toolbarAPI && window.toolbarAPI.sendChatMute) {
      window.toolbarAPI.sendChatMute({ type:'single', studentId:id, muted:s.muted });
    }
  }
}

function toggleAllMute() {
  allMuted = !allMuted;
  students.forEach(function(s) { s.muted = allMuted; });
  document.getElementById('muteAllBtn').textContent = allMuted ? '取消禁言' : '全体禁言';
  renderStudents();
  if (window.toolbarAPI && window.toolbarAPI.sendChatMute) {
    window.toolbarAPI.sendChatMute({ type:'all', allMuted:allMuted });
  }
}

function sendMsg() {
  var input = document.getElementById('msgInput');
  var text = input.value.trim();
  if (!text) return;
  var d = new Date();
  var time = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  var msg = { id: Date.now(), user:'王教授', role:'teacher', time:time, content:text };
  messages.push(msg);
  input.value = '';
  renderMessages();
  // 同步到主窗口
  if (window.toolbarAPI && window.toolbarAPI.sendChatNewMsg) {
    window.toolbarAPI.sendChatNewMsg(msg);
  }
}

function switchTab(tab) {
  document.getElementById('tabChat').classList.toggle('active', tab === 'chat');
  document.getElementById('tabStudents').classList.toggle('active', tab === 'students');
  document.getElementById('chatView').style.display = tab === 'chat' ? 'flex' : 'none';
  document.getElementById('studentsView').style.display = tab === 'students' ? 'flex' : 'none';
}

function closePanel() {
  if (window.toolbarAPI) window.toolbarAPI.sendAction('chat');
}

// 监听主窗口推送的初始化数据
if (window.toolbarAPI) {
  window.toolbarAPI.onChatInit(function(data) {
    messages = data.messages || [];
    students = data.students || [];
    allMuted = data.allMuted || false;
    document.getElementById('muteAllBtn').textContent = allMuted ? '取消禁言' : '全体禁言';
    renderMessages();
    renderStudents();
  });
  // 监听主窗口新消息
  window.toolbarAPI.onChatNewMsg(function(msg) {
    messages.push(msg);
    renderMessages();
  });
  // 监听主窗口禁言同步
  window.toolbarAPI.onChatMuteSync(function(data) {
    if (data.type === 'all') {
      allMuted = data.allMuted;
      students.forEach(function(s) { s.muted = allMuted; });
      document.getElementById('muteAllBtn').textContent = allMuted ? '取消禁言' : '全体禁言';
    } else if (data.type === 'single') {
      var s = students.find(function(x) { return x.id === data.studentId; });
      if (s) s.muted = data.muted;
    }
    renderStudents();
  });
  // 主动请求主窗口数据
  window.toolbarAPI.requestChatData();
}

renderMessages();
renderStudents();
