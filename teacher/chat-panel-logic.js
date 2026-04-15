// 注入剩余 t-* 样式
var style = document.createElement('style');
style.textContent = `
.t-student-list { flex:1; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:6px; }
.t-student-search { width:100%; padding:7px 10px; border-radius:8px; border:1px solid rgba(0,0,0,0.1); font-size:12px; color:#333; outline:none; background:rgba(255,255,255,0.7); box-sizing:border-box; margin-bottom:4px; }
.t-student-search:focus { border-color:#1f8b73; }
.t-student-row { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-radius:8px; background:rgba(255,255,255,0.6); }
.t-student-name { font-size:12px; color:#1a1a1a; }
.t-mute-btn { padding:3px 8px; border-radius:6px; border:1px solid #e5e7eb; background:rgba(255,255,255,0.8); font-size:11px; color:#555; cursor:pointer; transition:.15s; white-space:nowrap; }
.t-mute-btn.muted { background:#fff1f1; border-color:#fecaca; color:#e53e3e; }
.t-msg-list { flex:1; overflow-y:auto; padding:10px 12px; background:transparent; }
.t-msg-item { display:flex; justify-content:flex-start; margin-bottom:8px; }
.t-msg-self { justify-content:flex-end; }
.t-msg-self .t-msg-top { flex-direction:row-reverse; }
.t-msg-self .t-msg-userline { flex-direction:row-reverse; }
.t-msg-self .t-msg-bubble { background:#eaf7f2; border-color:#d4ece3; border-radius:14px 14px 4px 14px; }
.t-msg-body { min-width:0; max-width:88%; }
.t-msg-top { display:flex; align-items:center; gap:6px; margin-bottom:3px; }
.t-msg-userline { display:flex; align-items:center; gap:4px; }
.t-msg-time { font-size:10px; color:#aaa; }
.t-role-badge { width:16px; height:16px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:9px; color:#fff !important; flex-shrink:0; }
.t-teacher-badge { background:#f97316; }
.t-assistant-badge { background:#1f8b73; }
.t-msg-name { font-size:11px; color:#888; font-weight:500; }
.t-msg-bubble { display:inline-block; max-width:100%; padding:7px 10px; border-radius:14px 14px 14px 4px; background:rgba(255,255,255,0.85); border:1px solid #e8edf3; font-size:12px; color:#1a1a1a; word-break:break-word; line-height:1.5; }
.t-chat-foot { padding:10px 12px; border-top:1px solid rgba(0,0,0,0.06); flex-shrink:0; background:transparent; }
.t-input-row { display:flex; gap:8px; align-items:stretch; }
.t-chat-input { flex:1; resize:none; height:36px; padding:8px 10px; border-radius:10px; border:1px solid rgba(0,0,0,0.1); outline:none; background:rgba(255,255,255,0.8); font-size:12px; color:#1a1a1a; line-height:1.2; font-family:inherit; }
.t-chat-input:focus { border-color:#1f8b73; }
.t-send-btn { height:36px; padding:0 14px; border-radius:10px; background:#1f8b73; color:#fff; font-size:12px; font-weight:600; border:none; cursor:pointer; white-space:nowrap; transition:.18s; }
.t-send-btn:hover { background:#165f52; }
`;
document.head.appendChild(style);

// 数据
var allMuted = false;
var students = [
  { id:1, name:'张同学', muted:false },
  { id:2, name:'李同学', muted:false },
  { id:3, name:'王同学', muted:false }
];
var messages = [
  { id:1, user:'张同学', role:'student', time:'10:01', content:'老师好！' },
  { id:2, user:'李同学', role:'student', time:'10:02', content:'今天讲什么内容？' },
  { id:3, user:'王教授', role:'teacher', time:'10:03', content:'大家好，今天讲第三章' }
];

// 构建聊天视图
var chatView = document.getElementById('chatView');
chatView.innerHTML = '<div class="t-msg-list" id="msgList"></div><div class="t-chat-foot"><div class="t-input-row"><textarea class="t-chat-input" id="msgInput" placeholder="输入消息" rows="1"></textarea><button class="t-send-btn" onclick="sendMsg()">发送</button></div></div>';
document.getElementById('msgInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
});

// 构建学生视图
var studentsView = document.getElementById('studentsView');
studentsView.innerHTML = '<div class="t-student-list"><input class="t-student-search" id="studentSearch" placeholder="搜索学生姓名…" oninput="renderStudents()"/><div id="studentList"></div></div>';

function renderMessages() {
  var list = document.getElementById('msgList');
  list.innerHTML = '';
  messages.forEach(function(msg) {
    var isSelf = msg.role === 'teacher';
    var badge = msg.role === 'teacher' ? '<span class="t-role-badge t-teacher-badge">讲</span>' :
                msg.role === 'assistant' ? '<span class="t-role-badge t-assistant-badge">助</span>' : '';
    var item = document.createElement('article');
    item.className = 't-msg-item' + (isSelf ? ' t-msg-self' : '');
    item.innerHTML = '<div class="t-msg-body"><div class="t-msg-top"><div class="t-msg-userline">' + badge + '<strong>' + msg.user + '</strong></div><span style="font-size:11px;color:#999">' + msg.time + '</span></div><p class="t-msg-bubble">' + msg.content + '</p></div>';
    list.appendChild(item);
  });
  list.scrollTop = list.scrollHeight;
}

function renderStudents() {
  var search = (document.getElementById('studentSearch') || {}).value || '';
  var list = document.getElementById('studentList');
  list.innerHTML = '';
  students.filter(function(s) { return !search || s.name.includes(search); }).forEach(function(s) {
    var row = document.createElement('div');
    row.className = 't-student-row';
    row.innerHTML = '<span class="t-student-name">' + s.name + '</span><button class="t-mute-btn' + (s.muted ? ' muted' : '') + '" onclick="toggleMute(' + s.id + ')">' + (s.muted ? '已禁言' : '禁言') + '</button>';
    list.appendChild(row);
  });
}

function toggleMute(id) {
  var s = students.find(function(x) { return x.id === id; });
  if (s) { s.muted = !s.muted; renderStudents(); }
}

function toggleAllMute() {
  allMuted = !allMuted;
  students.forEach(function(s) { s.muted = allMuted; });
  document.getElementById('muteAllBtn').textContent = allMuted ? '取消禁言' : '全体禁言';
  renderStudents();
}

function sendMsg() {
  var input = document.getElementById('msgInput');
  var text = input.value.trim();
  if (!text) return;
  var now = new Date();
  var time = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  messages.push({ id: Date.now(), user:'王教授', role:'teacher', time:time, content:text });
  input.value = '';
  renderMessages();
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

renderMessages();
renderStudents();
