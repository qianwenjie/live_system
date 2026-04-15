// 注入剩余 t-* 样式
var style = document.createElement('style');
style.textContent = `
.t-student-list { flex:1; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:6px; }
.t-student-search { width:100%; padding:7px 10px; border-radius:8px; border:1px solid #e5e7eb; font-size:12px; color:#333; outline:none; background:#f8fbfd; box-sizing:border-box; margin-bottom:4px; }
.t-student-search:focus { border-color:#1f8b73; }
.t-student-row { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-radius:8px; background:#f9fafb; }
.t-student-name { font-size:13px; color:#1a1a1a; }
.t-mute-btn { padding:4px 10px; border-radius:6px; border:1px solid #e5e7eb; background:#fff; font-size:12px; color:#555; cursor:pointer; transition:.15s; white-space:nowrap; }
.t-mute-btn.muted { background:#fff1f1; border-color:#fecaca; color:#e53e3e; }
.t-msg-list { flex:1; overflow-y:auto; padding:12px 14px; background:#fff; }
.t-msg-item { display:flex; justify-content:flex-start; margin-bottom:10px; }
.t-msg-self { justify-content:flex-end; }
.t-msg-self .t-msg-top { flex-direction:row-reverse; }
.t-msg-self .t-msg-userline { flex-direction:row-reverse; }
.t-msg-self .t-msg-bubble { background:#eaf7f2; border-color:#d4ece3; border-radius:14px 14px 4px 14px; }
.t-msg-body { min-width:0; max-width:88%; }
.t-msg-top { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.t-msg-userline { display:flex; align-items:center; gap:6px; }
.t-role-badge { width:18px; height:18px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:10px; color:#fff !important; flex-shrink:0; }
.t-teacher-badge { background:#f97316; }
.t-assistant-badge { background:#1f8b73; }
.t-msg-bubble { display:inline-block; max-width:100%; padding:9px 12px; border-radius:14px 14px 14px 4px; background:#fff; border:1px solid #e8edf3; font-size:13px; color:#1a1a1a; word-break:break-word; line-height:1.5; }
.t-chat-foot { padding:12px; border-top:1px solid #e5e7eb; flex-shrink:0; }
.t-input-row { display:flex; gap:8px; align-items:stretch; }
.t-chat-input { flex:1; resize:none; height:38px; padding:9px 12px; border-radius:12px; border:1px solid #e5e7eb; outline:none; background:#f8fbfd; font-size:13px; color:#1a1a1a; line-height:1.2; font-family:inherit; }
.t-chat-input:focus { border-color:#1f8b73; }
.t-send-btn { height:38px; padding:0 16px; border-radius:12px; background:#1f8b73; color:#fff; font-size:13px; font-weight:600; border:none; cursor:pointer; white-space:nowrap; transition:.18s; }
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
