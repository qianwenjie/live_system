var selectedBg = 'none';
var stream = null;
var bgImages = {};
var segRaf = null;

var BG_LIST = [
  { id:'none', label:'不使用', img:null },
  { id:'meeting', label:'会议室', img:'bg-meeting.jpg' },
  { id:'study', label:'书房', img:'bg-study.jpg' },
  { id:'living', label:'客厅', img:'bg-living.jpg' }
];

BG_LIST.forEach(function(bg) {
  if (bg.img) { var img = new Image(); img.src = bg.img; bgImages[bg.id] = img; }
});

function buildGrid() {
  var grid = document.getElementById('bgGrid');
  grid.innerHTML = '';
  BG_LIST.forEach(function(bg) {
    var cell = document.createElement('div');
    cell.className = 'bg-cell';
    var active = bg.id === selectedBg ? ' active' : '';
    if (bg.img) {
      cell.innerHTML = '<div class="bg-item' + active + '" onclick="selectBg(\'' + bg.id + '\')"><img src="' + bg.img + '"></div><div class="bg-label">' + bg.label + '</div>';
    } else {
      cell.innerHTML = '<div class="bg-item' + active + '" onclick="selectBg(\'none\')"><span class="bg-none-text">不使用</span></div><div class="bg-label">' + bg.label + '</div>';
    }
    grid.appendChild(cell);
  });
}

function selectBg(id) {
  selectedBg = id;
  buildGrid();
  if (id === 'none') stopBgCanvas();
  else startBgCanvas();
}

var segmentation = null;

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true }).then(function(s) {
    stream = s;
    document.getElementById('camVideo').srcObject = s;
  }).catch(function() {});
}

function initSegmentation() {
  if (segmentation) return;
  segmentation = new SelfieSegmentation({
    locateFile: function(file) {
      return 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/' + file;
    }
  });
  segmentation.setOptions({ modelSelection: 1, selfieMode: false });
  segmentation.onResults(onSegResults);
}

function onSegResults(results) {
  var canvas = document.getElementById('bgCanvas');
  var w = canvas.width = results.image.width;
  var h = canvas.height = results.image.height;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (bgImages[selectedBg] && bgImages[selectedBg].complete) {
    ctx.drawImage(bgImages[selectedBg], 0, 0, w, h);
  }
  var off = document.createElement('canvas');
  off.width = w; off.height = h;
  var octx = off.getContext('2d');
  octx.filter = 'blur(6px)';
  octx.drawImage(results.segmentationMask, 0, 0, w, h);
  octx.filter = 'none';
  octx.globalCompositeOperation = 'source-in';
  octx.drawImage(results.image, 0, 0, w, h);
  ctx.drawImage(off, 0, 0);
}

function startBgCanvas() {
  var video = document.getElementById('camVideo');
  var canvas = document.getElementById('bgCanvas');
  canvas.style.display = 'block';
  video.style.opacity = '0';
  initSegmentation();
  function loop() {
    if (!stream || selectedBg === 'none') {
      segRaf = requestAnimationFrame(loop);
      return;
    }
    segmentation.send({ image: video }).then(function() {
      segRaf = requestAnimationFrame(loop);
    });
  }
  if (segRaf) cancelAnimationFrame(segRaf);
  loop();
}

function stopBgCanvas() {
  if (segRaf) { cancelAnimationFrame(segRaf); segRaf = null; }
  document.getElementById('bgCanvas').style.display = 'none';
  document.getElementById('camVideo').style.opacity = '1';
}

function stopCamera() {
  stopBgCanvas();
  if (segmentation) { segmentation.close(); segmentation = null; }
  if (stream) { stream.getTracks().forEach(function(t) { t.stop(); }); stream = null; }
}

function cancelVbg() {
  stopCamera();
  if (window.toolbarAPI) window.toolbarAPI.sendAction('close-vbg-modal');
}

function confirmVbg() {
  stopCamera();
  if (window.toolbarAPI) {
    window.toolbarAPI.sendAction('vbg:' + selectedBg);
    window.toolbarAPI.sendAction('close-vbg-modal');
  }
}

if (window.toolbarAPI && window.toolbarAPI.onVbgInit) {
  window.toolbarAPI.onVbgInit(function(bgId) {
    selectedBg = bgId || 'none';
    buildGrid();
    if (selectedBg !== 'none') startBgCanvas();
  });
}

window.addEventListener('beforeunload', function() { stopCamera(); });

buildGrid();
startCamera();
