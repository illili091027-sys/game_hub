/* ---------------- 사과게임 (사과 상자, Fruit Box 스타일) ---------------- */
/* 17x10(총 170개) 칸에 1~9 숫자가 적힌 사과가 랜덤으로 채워집니다. 화면을 드래그하면
   네모 박스가 생기는데, 박스 안에 들어간(아직 안 지워진) 사과 숫자의 합이 정확히 10이
   되면 박스가 빨갛게 바뀌고, 그 상태에서 손을 떼면 그 사과들이 사라지며 개당 1점을
   얻습니다. 오른쪽 세로 게이지가 다 빠지는 2분이 되면 게임이 끝나고, 170개를 시간 안에
   전부 지우면(올클리어) 걸린 시간이 따로 표시됩니다. */
var AP_COLS = 17;
var AP_ROWS = 10;
var AP_TOTAL = AP_COLS * AP_ROWS; // 170
var AP_ROUND_MS = 120000; // 2분
var AP_GAP = 3; // 사과끼리 살짝 띄우는 간격(px)

/* 자주 쓰이는 합이 10인 조합들(2/3/4개짜리). 이 조합들로 한 줄(17칸)씩 가로로 채워 넣으면
   보드 전체가 "이 줄을 가로로 드래그하면 지워지는" 구간들로 빈틈없이 나뉘게 되어, 완전
   무작위로 아무렇게나 숫자를 흩뿌릴 때보다 실제로 클리어할 수 있는 가능성이 훨씬 높아집니다
   (단, 어떤 조합을 어떤 순서로 쓸지/조합 안 숫자 순서는 그때그때 무작위라 매번 다른 판이 나옵니다). */
var AP_COMBO2 = [[1, 9], [2, 8], [3, 7], [4, 6], [5, 5]];
var AP_COMBO3 = [[1, 1, 8], [1, 2, 7], [1, 3, 6], [1, 4, 5], [2, 2, 6], [2, 3, 5], [2, 4, 4], [3, 3, 4]];
var AP_COMBO4 = [[1, 1, 1, 7], [1, 1, 2, 6], [1, 1, 3, 5], [1, 1, 4, 4], [1, 2, 2, 5], [1, 2, 3, 4], [1, 3, 3, 3], [2, 2, 2, 4], [2, 2, 3, 3]];

var AP_GRID = [];
var AP_CELL = 0;
var AP_SCORE = 0;
var AP_RUNNING = false;
var AP_START_TS = 0;
var AP_RAF = null;
var AP_FULL_CLEAR_ELAPSED = null;
var AP_DRAGGING = false;
var AP_DRAG_START = null;
var AP_CUR_CELLS = null;
var AP_CUR_SUM = 0;

/* ---- 온라인: 다른 사람 실시간 점수/진행 상황 ---- */
var AP_STATUS = 'waiting'; // waiting | playing | done
var AP_OPP_POLL_TIMER = null;
var AP_LAST_POST = 0;

function apLoadBest() {
  try {
    var v = parseInt(localStorage.getItem('gamehub_ap_best'), 10);
    return isNaN(v) ? 0 : v;
  } catch (e) { return 0; }
}
function apSaveBest(score) {
  try {
    var best = apLoadBest();
    if (score > best) { localStorage.setItem('gamehub_ap_best', String(score)); return score; }
    return best;
  } catch (e) { return score; }
}
function apBestText(v) { return v > 0 ? (v + '점') : '기록 없음'; }

function apOpponentKey(pid) { return roomKey('apple_p_' + pid); }

/* 한 줄(17칸)을 정확히 채우는 조합 길이 조합(2/3/4)을 무작위로 골라줍니다. 나머지가 1칸만
   남는 경우는 만들지 않도록 걸러서(2/3/4 중 아무거나로도 나머지가 항상 0이나 2 이상이 되게),
   조합이 끝까지 딱 맞아떨어지게 합니다. */
function apPartitionRow(total) {
  var LENS = [2, 3, 4];
  var WEIGHTS = { 2: 5, 3: 4, 4: 2 }; // 2/3개 조합을 더 자주, 4개는 종종
  var parts = [];
  var remaining = total;
  while (remaining > 0) {
    var candidates = LENS.filter(function (l) { return l <= remaining && (remaining - l) !== 1; });
    if (!candidates.length) candidates = [Math.min(remaining, 4)];
    var totalW = candidates.reduce(function (s, l) { return s + WEIGHTS[l]; }, 0);
    var r = Math.random() * totalW;
    var chosen = candidates[candidates.length - 1];
    for (var i = 0; i < candidates.length; i++) {
      r -= WEIGHTS[candidates[i]];
      if (r <= 0) { chosen = candidates[i]; break; }
    }
    parts.push(chosen);
    remaining -= chosen;
  }
  return parts;
}

function apPickCombo(len) {
  var pool = len === 2 ? AP_COMBO2 : len === 3 ? AP_COMBO3 : AP_COMBO4;
  var combo = pool[Math.floor(Math.random() * pool.length)];
  return shuffleArray(combo);
}

/* 완전 무작위로 숫자를 하나씩 흩뿌리면 운이 나쁠 때 거의 못 지우는 판이 나올 수 있어서,
   먼저 합이 10인 조합들로 숫자 "구성"만 만들어둡니다(1~9 숫자의 전체 비율이 한쪽으로 너무
   치우치지 않게). 그다음 그 숫자들을 보드 전체에 완전히 섞어서 배치합니다 - 조합을 만든
   순서/줄 그대로 놓아두면 그냥 왼쪽부터 쭉 드래그하기만 하면 다 풀리는 너무 쉬운 판이
   되기 때문에(사용자 피드백), 실제로는 어디에 어떤 숫자가 있는지 직접 찾아야 하는 정도의
   난이도가 되도록 위치를 섞습니다. 총합은 조합 하나하나가 이미 10이라 섞은 뒤에도 항상
   10의 배수 그대로 유지됩니다. */
function apGenerateBoard() {
  var vals = [];
  for (var r = 0; r < AP_ROWS; r++) {
    var parts = apPartitionRow(AP_COLS);
    for (var p = 0; p < parts.length; p++) {
      var combo = apPickCombo(parts[p]);
      for (var k = 0; k < combo.length; k++) vals.push(combo[k]);
    }
  }
  vals = shuffleArray(vals);
  return vals.map(function (v) { return { value: v, cleared: false, el: null }; });
}

function startAppleGame() {
  document.getElementById('ap-best-intro').textContent = apBestText(apLoadBest());
  document.getElementById('ap-intro').style.display = '';
  document.getElementById('ap-game-area').style.display = 'none';
  document.getElementById('ap-final-area').style.display = 'none';
  document.getElementById('ap-opponents').style.display = playMode === 'online' ? '' : 'none';
  AP_STATUS = 'waiting';
  AP_RUNNING = false;
  if (playMode === 'online') { apPostState(true); apStartOppPoll(); } else { apStopOppPoll(); }
}

function apBeginGame() {
  document.getElementById('ap-intro').style.display = 'none';
  document.getElementById('ap-final-area').style.display = 'none';
  document.getElementById('ap-game-area').style.display = '';
  AP_GRID = apGenerateBoard();
  AP_SCORE = 0;
  AP_FULL_CLEAR_ELAPSED = null;
  document.getElementById('ap-score-val').textContent = '0';
  document.getElementById('ap-timer-text').textContent = '2:00';
  var fill = document.getElementById('ap-gauge-fill');
  fill.style.height = '100%';
  fill.classList.remove('ap-gauge-urgent');
  AP_STATUS = 'playing';
  apRenderBoard();
  apSetupPointerHandlers();
  AP_START_TS = performance.now();
  AP_RUNNING = true;
  apPostState(true);
  AP_RAF = requestAnimationFrame(apFrame);
}

function apRenderBoard() {
  var wrap = document.getElementById('ap-board-wrap');
  wrap.innerHTML = '';
  /* 화면(특히 전체화면처럼 넓은 화면)에 맞춰 판이 커질 수 있도록 CSS의 max-width(뷰포트 기준)를
     그대로 따르고, 혹시 레이아웃이 아직 안 잡혀 clientWidth가 이상하게 작게 잡히는 경우에만
     대비해 최소한의 안전장치(900px)만 둡니다. */
  var w = Math.min(wrap.clientWidth || 340, 900);
  AP_CELL = Math.floor(w / AP_COLS);
  var h = AP_CELL * AP_ROWS;
  wrap.style.height = h + 'px';
  document.getElementById('ap-gauge-wrap').style.height = h + 'px';
  /* 사과 크기(칸 크기)에 맞춰 숫자 크기/여백도 같이 커지고 작아지게 합니다 - 판이 커지는
     화면에서 숫자가 너무 작아 보이지 않도록. */
  var fontPx = Math.max(11, Math.round((AP_CELL - AP_GAP) * 0.4));
  var padPx = Math.round((AP_CELL - AP_GAP) * 0.22);
  var frag = document.createDocumentFragment();
  for (var r = 0; r < AP_ROWS; r++) {
    for (var c = 0; c < AP_COLS; c++) {
      var idx = r * AP_COLS + c;
      var cellData = AP_GRID[idx];
      if (cellData.cleared) { cellData.el = null; continue; } // 화면 크기 변경으로 다시 그릴 때 이미 지운 사과는 되살리지 않음
      var el = document.createElement('div');
      el.className = 'ap-apple';
      el.textContent = cellData.value;
      /* 칸 격자(AP_CELL) 기준 위치는 그대로 두고, 사과 자체만 살짝 작게 그려서 사과끼리
         간격이 보이게 합니다 - 드래그 판정은 여전히 원래 칸 격자 기준이라 게임성엔 영향 없어요. */
      el.style.left = (c * AP_CELL + AP_GAP / 2) + 'px';
      el.style.top = (r * AP_CELL + AP_GAP / 2) + 'px';
      el.style.width = (AP_CELL - AP_GAP) + 'px';
      el.style.height = (AP_CELL - AP_GAP) + 'px';
      el.style.fontSize = fontPx + 'px';
      /* 숫자를 사과 위쪽(잎/꼭지 바로 아래, 가장 넓은 부분)에 적히도록 안쪽 여백을 줍니다.
         절대 위치 요소에 CSS %padding을 쓰면 자기 크기가 아니라 부모(보드 전체) 너비 기준으로
         계산돼버려서 숫자가 화면 밖으로 튕겨나가므로, 실제 칸 크기를 아는 여기서 픽셀로 계산합니다. */
      el.style.paddingTop = padPx + 'px';
      frag.appendChild(el);
      cellData.el = el;
    }
  }
  wrap.appendChild(frag);
  var box = document.createElement('div');
  box.className = 'ap-selbox';
  box.id = 'ap-selbox';
  box.style.display = 'none';
  wrap.appendChild(box);
}

/* 드래그 박스가 걸쳐진 칸들을(칸 경계 기준) 모두 골라냅니다 - 칸을 완전히 덮지 않고
   살짝만 걸쳐도 선택되는, 흔한 드래그 선택 방식입니다. */
function apCellsInRect(x0, y0, x1, y1) {
  var left = Math.min(x0, x1), right = Math.max(x0, x1);
  var top = Math.min(y0, y1), bottom = Math.max(y0, y1);
  var cells = [];
  if (right <= left || bottom <= top || !AP_CELL) return cells;
  var c0 = Math.max(0, Math.floor(left / AP_CELL));
  var c1 = Math.min(AP_COLS - 1, Math.floor((right - 0.001) / AP_CELL));
  var r0 = Math.max(0, Math.floor(top / AP_CELL));
  var r1 = Math.min(AP_ROWS - 1, Math.floor((bottom - 0.001) / AP_CELL));
  for (var r = r0; r <= r1; r++) {
    for (var c = c0; c <= c1; c++) {
      var cd = AP_GRID[r * AP_COLS + c];
      if (cd && !cd.cleared) cells.push(cd);
    }
  }
  return cells;
}

function apSetupPointerHandlers() {
  var wrap = document.getElementById('ap-board-wrap');
  if (!wrap || wrap._apBound) return;
  wrap._apBound = true;

  function relPos(e) {
    var rect = wrap.getBoundingClientRect();
    var x = Math.max(0, Math.min(wrap.clientWidth, e.clientX - rect.left));
    var y = Math.max(0, Math.min(wrap.clientHeight, e.clientY - rect.top));
    return { x: x, y: y };
  }

  wrap.addEventListener('pointerdown', function (e) {
    if (!AP_RUNNING) return;
    e.preventDefault();
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    var p = relPos(e);
    AP_DRAGGING = true;
    AP_DRAG_START = p;
    var box = document.getElementById('ap-selbox');
    box.style.display = '';
    box.style.left = p.x + 'px';
    box.style.top = p.y + 'px';
    box.style.width = '0px';
    box.style.height = '0px';
    box.classList.remove('ap-selbox-hit');
    AP_CUR_CELLS = null;
    AP_CUR_SUM = 0;
  }, { passive: false });

  wrap.addEventListener('pointermove', function (e) {
    if (!AP_DRAGGING) return;
    e.preventDefault();
    var p = relPos(e);
    var left = Math.min(AP_DRAG_START.x, p.x);
    var top = Math.min(AP_DRAG_START.y, p.y);
    var w = Math.abs(p.x - AP_DRAG_START.x);
    var h = Math.abs(p.y - AP_DRAG_START.y);
    var box = document.getElementById('ap-selbox');
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = w + 'px';
    box.style.height = h + 'px';
    var cells = apCellsInRect(AP_DRAG_START.x, AP_DRAG_START.y, p.x, p.y);
    var sum = cells.reduce(function (s, cd) { return s + cd.value; }, 0);
    if (sum === 10 && cells.length > 0) box.classList.add('ap-selbox-hit');
    else box.classList.remove('ap-selbox-hit');
    AP_CUR_CELLS = cells;
    AP_CUR_SUM = sum;
  }, { passive: false });

  function finishDrag(e) {
    if (!AP_DRAGGING) return;
    AP_DRAGGING = false;
    var box = document.getElementById('ap-selbox');
    box.style.display = 'none';
    if (AP_CUR_SUM === 10 && AP_CUR_CELLS && AP_CUR_CELLS.length > 0) apClearCells(AP_CUR_CELLS);
    AP_CUR_CELLS = null;
    AP_CUR_SUM = 0;
  }
  wrap.addEventListener('pointerup', finishDrag);
  wrap.addEventListener('pointercancel', finishDrag);
}

function apClearCells(cells) {
  cells.forEach(function (cd) {
    cd.cleared = true;
    if (cd.el) cd.el.classList.add('ap-apple-cleared');
  });
  AP_SCORE += cells.length;
  document.getElementById('ap-score-val').textContent = String(AP_SCORE);
  setTimeout(function () {
    cells.forEach(function (cd) {
      if (cd.el && cd.el.parentNode) cd.el.parentNode.removeChild(cd.el);
      cd.el = null;
    });
  }, 180);
}

function apFrame() {
  if (!AP_RUNNING) return;
  var elapsed = performance.now() - AP_START_TS;
  var remaining = Math.max(0, AP_ROUND_MS - elapsed);
  var pct = remaining / AP_ROUND_MS;
  var fill = document.getElementById('ap-gauge-fill');
  if (fill) {
    fill.style.height = (pct * 100) + '%';
    if (pct < 0.15) fill.classList.add('ap-gauge-urgent'); else fill.classList.remove('ap-gauge-urgent');
  }
  var secs = Math.ceil(remaining / 1000);
  document.getElementById('ap-timer-text').textContent = Math.floor(secs / 60) + ':' + (secs % 60 < 10 ? '0' : '') + (secs % 60);
  apPostState(false);
  if (AP_SCORE >= AP_TOTAL) { AP_FULL_CLEAR_ELAPSED = elapsed; apEndGame(); return; }
  if (remaining <= 0) { apEndGame(); return; }
  AP_RAF = requestAnimationFrame(apFrame);
}

function apEndGame() {
  AP_RUNNING = false;
  if (AP_RAF) cancelAnimationFrame(AP_RAF);
  AP_STATUS = 'done';
  var best = apSaveBest(AP_SCORE);
  document.getElementById('ap-game-area').style.display = 'none';
  document.getElementById('ap-final-area').style.display = '';
  document.getElementById('ap-final-score').textContent = AP_SCORE + '점';
  document.getElementById('ap-final-best').textContent = apBestText(best);
  var row = document.getElementById('ap-final-fullclear-row');
  if (AP_FULL_CLEAR_ELAPSED !== null) {
    row.style.display = '';
    document.getElementById('ap-final-fullclear-time').textContent = (AP_FULL_CLEAR_ELAPSED / 1000).toFixed(2) + '초';
  } else {
    row.style.display = 'none';
  }
  apPostState(true);
}

function apRestart() { startAppleGame(); }

/* ---- 온라인: 실시간 상태 방송/표시 ---- */
function apPostState(force) {
  if (playMode !== 'online' || !roomJoined || !myPlayerId) return;
  var now = performance.now();
  if (!force && now - AP_LAST_POST < 500) return;
  AP_LAST_POST = now;
  var remaining = AP_RUNNING ? Math.max(0, AP_ROUND_MS - (performance.now() - AP_START_TS)) : 0;
  DBset(apOpponentKey(myPlayerId), {
    name: me.name,
    status: AP_STATUS,
    score: AP_SCORE,
    remainingMs: remaining,
    fullClearElapsed: AP_FULL_CLEAR_ELAPSED,
    ts: Date.now()
  });
}

function apRenderOpponents() {
  var panel = document.getElementById('ap-opponents');
  if (!panel) return;
  if (playMode !== 'online' || !roomJoined || !roomPlayersList) { panel.innerHTML = ''; return; }
  Promise.all(roomPlayersList.map(function (p) {
    return DBget(apOpponentKey(p.id)).then(function (data) { return { name: p.name, isMe: p.id === myPlayerId, data: data }; });
  })).then(function (results) {
    var entries = results.map(function (r) {
      var d = r.data;
      if (!d || d.status === 'waiting') return { name: r.name, isMe: r.isMe, label: '아직 시작 전', sortKey: [2, 0] };
      if (d.status === 'done') {
        var label = d.score + '점 완료';
        if (d.fullClearElapsed) label += ' (올클리어! ' + (d.fullClearElapsed / 1000).toFixed(2) + '초)';
        return { name: r.name, isMe: r.isMe, label: label, sortKey: [0, -d.score] };
      }
      var secs = Math.ceil((d.remainingMs || 0) / 1000);
      var mm = Math.floor(secs / 60), ss = secs % 60;
      return { name: r.name, isMe: r.isMe, label: d.score + '점 진행 중 (남은 시간 ' + mm + ':' + (ss < 10 ? '0' : '') + ss + ')', sortKey: [1, -d.score] };
    });
    entries.sort(function (a, b) { return a.sortKey[0] - b.sortKey[0] || a.sortKey[1] - b.sortKey[1]; });
    renderRankBoard('ap-opponents', entries);
  });
}

function apStartOppPoll() {
  apStopOppPoll();
  if (playMode !== 'online') return;
  apRenderOpponents();
  AP_OPP_POLL_TIMER = setInterval(apRenderOpponents, 1000);
}
function apStopOppPoll() {
  clearInterval(AP_OPP_POLL_TIMER);
  AP_OPP_POLL_TIMER = null;
}

function stopAppleGame() {
  AP_RUNNING = false;
  if (AP_RAF) cancelAnimationFrame(AP_RAF);
  AP_DRAGGING = false;
  apStopOppPoll();
}

/* 게임 도중에 전체화면으로 바꾸는 등 화면 크기가 달라지면 판을 다시 그려서 새 크기에 맞춥니다
   (이미 지운 사과는 되살아나지 않음). 리사이즈 이벤트가 여러 번 연달아 오는 걸 막기 위해
   살짝 디바운스합니다. */
var AP_RESIZE_TIMER = null;
window.addEventListener('resize', function () {
  clearTimeout(AP_RESIZE_TIMER);
  AP_RESIZE_TIMER = setTimeout(function () {
    var view = document.getElementById('apple');
    var gameArea = document.getElementById('ap-game-area');
    if (!view || !view.classList.contains('active') || !gameArea || gameArea.style.display === 'none') return;
    apRenderBoard();
  }, 200);
});

/* 실제 사과처럼 보이도록 data/apple-data.js에 있는 사과 이미지를 배경으로 씁니다. 170개
   칸마다 각자 style을 넣으면 똑같은 긴 데이터 문자열이 170번 중복돼서 메모리를 낭비하니,
   CSS 클래스 규칙 하나로만 한 번 넣고 모든 .ap-apple이 그 클래스를 공유하게 합니다. */
(function apInjectAppleImageStyle() {
  if (typeof AP_APPLE_IMG === 'undefined' || !AP_APPLE_IMG) return;
  var style = document.createElement('style');
  style.textContent = '.ap-apple { background-image: url("' + AP_APPLE_IMG + '"); }';
  document.head.appendChild(style);
})();
