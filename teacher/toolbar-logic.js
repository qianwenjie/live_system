var state = { micOn:false, camOn:false, chatOpen:false, signal:3, seconds:0, appIcons:[] };
var micCtx=null, micAnalyser=null, micBuf=null, micRaf=null;
var currentMicId='', currentCamId='', currentVbg='none';

var VBG_LIST = [
  { id:'none',    label:'不使用', img:null },
  { id:'meeting', label:'背景1',  img:'bg-meeting.jpg' },
  { id:'study',   label:'背景2',  img:'bg-study.jpg' },
  { id:'living',  label:'背景3',  img:'bg-living.jpg' }
];

function toggle(type) { if (window.toolbarAPI) window.toolbarAPI.sendAction(type); }
function pad(n) { return String(n).padStart(2,'0'); }

/* 面板开关 */
function togglePanel(id, e) {
  e && e.stopPropagation();
  var panel = document.getElementById(id);
  var isOpen = panel.classList.contains('show');
  closeAll();
  if (!isOpen) {
    panel.classList.add('show');
    var arrow = id === 'micPanel' ? 'micArrow' : 'camArrow';
    document.getElementById(arrow).classList.add('open');
    if (id === 'micPanel') loadMicList();
    if (id === 'camPanel') loadCamList();
  }
}
function openVbg() {
  closeAll();
  buildVbgGrid();
  document.getElementById('vbgPanel').classList.add('show');
}
function closeAll() {
  ['micPanel','camPanel','vbgPanel'].forEach(function(id) {
    document.getElementById(id).classList.remove('show');
  });
  ['micArrow','camArrow'].forEach(function(id) {
    document.getElementById(id).classList.remove('open');
  });
}
document.addEventListener('click', closeAll);

/* 麦克风列表 */
function loadMicList() {
  navigator.mediaDevices.enumerateDevices().then(function(devs) {
    var mics = devs.filter(function(d) { return d.kind==='audioinput'; });
    var el = document.getElementById('micList');
    el.innerHTML = '';
    if (!mics.length) { el.innerHTML='<div class="popup-item" style="color:rgba(255,255,255,0.3)">未检测到麦克风</div>'; return; }
    mics.forEach(function(m) {
      var item = document.createElement('div');
      item.className = 'popup-item' + (m.deviceId===currentMicId?' active':'');
      item.innerHTML = '<span class="pi-check">'+(m.deviceId===currentMicId?'✓':'')+'</span>'+(m.label||'麦克风');
      item.onclick = function(e) { e.stopPropagation(); currentMicId=m.deviceId; closeAll(); loadMicList(); };
      el.appendChild(item);
    });
  });
}

/* 摄像头列表 */
function loadCamList() {
  navigator.mediaDevices.enumerateDevices().then(function(devs) {
    var cams = devs.filter(function(d) { return d.kind==='videoinput'; });
    var el = document.getElementById('camList');
    el.innerHTML = '';
    if (!cams.length) { el.innerHTML='<div class="popup-item" style="color:rgba(255,255,255,0.3)">未检测到摄像头</div>'; return; }
    cams.forEach(function(c) {
      var item = document.createElement('div');
      item.className = 'popup-item' + (c.deviceId===currentCamId?' active':'');
      item.innerHTML = '<span class="pi-check">'+(c.deviceId===currentCamId?'✓':'')+'</span>'+(c.label||'摄像头');
      item.onclick = function(e) { e.stopPropagation(); currentCamId=c.deviceId; closeAll(); };
      el.appendChild(item);
    });
  });
}

/* 虚拟背景网格 */
function buildVbgGrid() {
  var grid = document.getElementById('vbgGrid');
  grid.innerHTML = '';
  VBG_LIST.forEach(function(bg) {
    var wrap = document.createElement('div');
    wrap.innerHTML = '<div class="vbg-item'+(bg.id===currentVbg?' active':'')+'" onclick="selectVbg(\''+bg.id+'\')">'
      + (bg.img ? '<img src="'+bg.img+'" onerror="this.style.display=\'none\'">' : '<div class="vbg-none" style="width:100%;height:100%"><span>不使用</span></div>')
      + '</div><div class="vbg-label">'+bg.label+'</div>';
    grid.appendChild(wrap);
  });
}
function selectVbg(id) {
  currentVbg = id;
  if (window.toolbarAPI) window.toolbarAPI.sendAction('vbg:' + id);
  buildVbgGrid();
}

/* 状态更新 */
function updateTimer() {
  var s=state.seconds;
  document.getElementById('timer').textContent=pad(Math.floor(s/3600))+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60);
}
function updateSignal() {
  var sig=state.signal;
  ['s1','s2','s3','s4'].forEach(function(id,i){ document.getElementById(id).classList.toggle('on',i<sig); });
  document.getElementById('signalLabel').textContent=['','信号弱','信号中','信号强','信号强'][sig]||'信号弱';
}
function updateMic() {
  document.getElementById('micBtn').classList.toggle('off',!state.micOn);
  document.getElementById('micSlash').style.display=state.micOn?'none':'block';
  if (state.micOn) startMicMeter(); else stopMicMeter();
}
function updateCam() {
  document.getElementById('camBtn').classList.toggle('off',!state.camOn);
  document.getElementById('camSlash').style.display=state.camOn?'none':'block';
}
function updateChat() {
  document.getElementById('chatLabel').textContent=state.chatOpen?'收起互动':'互动区';
}
function updateShareLabel(label, icons) {
  var shareLabel=document.getElementById('shareLabel');
  var wrap=document.getElementById('appIconsWrap');
  if (icons&&icons.length>0) {
    shareLabel.style.display='none'; wrap.style.display='flex'; wrap.innerHTML='';
    icons.slice(0,4).forEach(function(src){ if(!src)return; var img=document.createElement('img'); img.src=src; img.className='app-icon-img'; wrap.appendChild(img); });
    if (icons.length>4) { var m=document.createElement('span'); m.className='app-icon-more'; m.textContent='+'+(icons.length-4); wrap.appendChild(m); }
  } else { wrap.style.display='none'; shareLabel.style.display=''; shareLabel.textContent=label||'共享中'; }
}

/* 麦克风音量 */
function startMicMeter() {
  if (micCtx) return;
  navigator.mediaDevices.getUserMedia({audio:true,video:false}).then(function(stream){
    micCtx=new AudioContext(); var src=micCtx.createMediaStreamSource(stream);
    micAnalyser=micCtx.createAnalyser(); micAnalyser.fftSize=256; micAnalyser.smoothingTimeConstant=0.6;
    src.connect(micAnalyser); micBuf=new Uint8Array(micAnalyser.frequencyBinCount);
    function tick(){
      if(!state.micOn){stopMicMeter();return;}
      micAnalyser.getByteFrequencyData(micBuf);
      var sum=0; for(var i=0;i<micBuf.length;i++) sum+=micBuf[i];
      var h=Math.min(1,sum/micBuf.length/128*2)*13;
      var rect=document.getElementById('micLevelRect');
      if(rect){rect.setAttribute('y',13.5-h);rect.setAttribute('height',h);}
      micRaf=requestAnimationFrame(tick);
    } tick();
  }).catch(function(){});
}
function stopMicMeter() {
  if(micRaf){cancelAnimationFrame(micRaf);micRaf=null;}
  if(micCtx){micCtx.close();micCtx=null;}
  micAnalyser=null; micBuf=null;
  var rect=document.getElementById('micLevelRect');
  if(rect){rect.setAttribute('y',13.5);rect.setAttribute('height',0);}
}

if (window.toolbarAPI) {
  window.toolbarAPI.onStateUpdate(function(s){
    Object.assign(state,s); updateMic(); updateCam(); updateSignal(); updateChat();
    updateShareLabel(s.screenLabel,s.appIcons);
  });
  window.toolbarAPI.onTimerTick(function(d){
    state.seconds=d.seconds; state.signal=d.signal; updateTimer(); updateSignal();
  });
}
updateTimer(); updateSignal(); updateMic(); updateCam();
