/* ---------------- 영어 낱말 찾기 (혼자하기 전용, 난이도 1~5) ----------------
   알파벳이 빼곡한 판에서 숨어있는 영어 단어를 찾아 손가락/마우스로 처음 글자부터 끝 글자까지
   쭉 끌면(또는 첫 글자, 끝 글자를 차례로 누르면) 찾은 것으로 표시됩니다.
   난이도가 오를수록 판이 커지고 단어 수가 많아지며, 숨는 방향도 늘어납니다
   (1단계: →↓ / 2단계: + ↘ / 3단계: + ↗ ← / 4~5단계: 8방향 전부, 거꾸로 숨은 단어 포함).
   3단계부터는 빈칸 채우는 글자도 단어에 들어있는 글자 위주로 섞어서 헷갈리게 만듭니다. */
var WS_LEVELS = {
  1: { size: 8, count: 8, tiers: [1], dirs: [[0, 1], [1, 0]], name: '왕초보' },
  2: { size: 10, count: 12, tiers: [1, 2], dirs: [[0, 1], [1, 0], [1, 1]], name: '초보' },
  3: { size: 12, count: 17, tiers: [2, 3], dirs: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1]], name: '중수' },
  4: { size: 14, count: 23, tiers: [3, 4], dirs: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]], name: '고수' },
  5: { size: 16, count: 30, tiers: [4, 5, 3], dirs: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]], name: '끝판왕' }
};
var WS_HIGHLIGHT_COLORS = ['#F2C744', '#6FC3DF', '#F2836B', '#B79CE8', '#6FC364', '#E89CC8', '#F2A65A', '#7FD8BE'];
var WS_MAX_HINTS = 3;

var WS = null; // 현재 판 상태
var WS_TIMER = null;
var WS_BEST = {}; // 레벨별 최고 기록(이 화면을 나가면 사라짐)

function stopWordSearch() {
  clearInterval(WS_TIMER);
  WS_TIMER = null;
}

function startWordSearch() {
  stopWordSearch();
  WS = null;
  document.getElementById('ws-difficulty-select').style.display = '';
  document.getElementById('ws-game-area').style.display = 'none';
}

function wsBackToDifficulty() { startWordSearch(); }

function wsChooseLevel(level) {
  document.getElementById('ws-difficulty-select').style.display = 'none';
  document.getElementById('ws-game-area').style.display = '';
  wsNewBoard(level);
}

function wsNewGameBtn() { wsNewBoard(WS ? WS.level : 1); }

/* ---- 판 만들기 ---- */
function wsPickCandidates(cfg) {
  var seen = {};
  var list = [];
  cfg.tiers.forEach(function (t, ti) {
    shuffleArray(WS_WORD_TIERS[t] || []).forEach(function (pair) {
      var w = pair[0].toUpperCase();
      if (!/^[A-Z]+$/.test(w) || w.length > cfg.size || seen[w]) return;
      seen[w] = true;
      list.push({ word: w, meaning: pair[1], prio: ti });
    });
  });
  // 앞쪽 티어(그 레벨의 메인 단어)를 먼저 쓰고, 모자라면 다음 티어에서 채움
  list.sort(function (a, b) { return a.prio - b.prio; });
  return list;
}

function wsTryGenerate(level) {
  var cfg = WS_LEVELS[level];
  var n = cfg.size;
  var grid = [];
  for (var r = 0; r < n; r++) { grid.push([]); for (var c = 0; c < n; c++) grid[r].push(''); }
  var candidates = wsPickCandidates(cfg).slice(0, cfg.count * 5);
  var chosen = [];
  // 긴 단어부터 놓아야 빽빽하게 들어갑니다
  var ordered = candidates.slice(0, Math.round(cfg.count * 1.8)).sort(function (a, b) { return b.word.length - a.word.length; })
    .concat(candidates.slice(Math.round(cfg.count * 1.8)));
  for (var i = 0; i < ordered.length && chosen.length < cfg.count; i++) {
    var cand = ordered[i];
    // 다른 단어 안에 통째로 들어가는 단어(예: RANGE ⊂ ORANGE)는 헷갈려서 제외
    var clash = chosen.some(function (ch) { return ch.word.indexOf(cand.word) !== -1 || cand.word.indexOf(ch.word) !== -1; });
    if (clash) continue;
    var best = null;
    var bestScore = -1;
    var dirs = shuffleArray(cfg.dirs);
    for (var tries = 0; tries < 450; tries++) {
      var d = dirs[tries % dirs.length];
      var len = cand.word.length;
      var r0 = Math.floor(Math.random() * n);
      var c0 = Math.floor(Math.random() * n);
      var r1 = r0 + d[0] * (len - 1), c1 = c0 + d[1] * (len - 1);
      if (r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue;
      var ok = true, overlap = 0;
      for (var k = 0; k < len; k++) {
        var cell = grid[r0 + d[0] * k][c0 + d[1] * k];
        if (cell && cell !== cand.word[k]) { ok = false; break; }
        if (cell) overlap++;
      }
      if (!ok || overlap === len) continue;
      var score = overlap * 3 + Math.random();
      if (score > bestScore) { bestScore = score; best = { r: r0, c: c0, d: d }; }
    }
    if (!best) continue;
    for (var k2 = 0; k2 < cand.word.length; k2++) grid[best.r + best.d[0] * k2][best.c + best.d[1] * k2] = cand.word[k2];
    chosen.push({ word: cand.word, meaning: cand.meaning, r: best.r, c: best.c, dr: best.d[0], dc: best.d[1], found: false, color: null });
  }
  var pool = chosen.map(function (w) { return w.word; }).join('');
  var abc = 'ABCDEFGHIJKLMNOPRSTUVWY';
  for (var rr = 0; rr < n; rr++) for (var cc = 0; cc < n; cc++) {
    if (grid[rr][cc]) continue;
    var useDecoy = level >= 3 && Math.random() < (level >= 4 ? 0.65 : 0.45);
    grid[rr][cc] = useDecoy ? pool[Math.floor(Math.random() * pool.length)] : abc[Math.floor(Math.random() * abc.length)];
  }
  return { grid: grid, words: chosen, size: n };
}

function wsNewBoard(level) {
  var cfg = WS_LEVELS[level];
  var best = null;
  for (var attempt = 0; attempt < 25; attempt++) {
    var b = wsTryGenerate(level);
    if (!best || b.words.length > best.words.length) best = b;
    if (b.words.length >= cfg.count) break;
  }
  best.words.sort(function (a, b) { return a.word < b.word ? -1 : 1; });
  WS = {
    level: level, size: best.size, grid: best.grid, words: best.words,
    startAt: Date.now(), done: false, hints: WS_MAX_HINTS, colorIdx: 0,
    drag: null, anchor: null
  };
  document.getElementById('ws-level-pill').textContent = level + '단계 · ' + cfg.name;
  document.getElementById('ws-msg').textContent = '';
  document.getElementById('ws-msg').className = 'sd-msg';
  wsRenderBoard();
  wsRenderWords();
  wsUpdateStats();
  stopWordSearch();
  WS_TIMER = setInterval(wsUpdateStats, 500);
}

/* ---- 화면 그리기 ---- */
function wsRenderBoard() {
  var cells = document.getElementById('ws-cells');
  var board = document.getElementById('ws-board');
  board.style.setProperty('--ws-n', WS.size);
  board.className = 'ws-board ws-lv' + WS.level;
  var html = '';
  for (var r = 0; r < WS.size; r++) for (var c = 0; c < WS.size; c++) {
    html += '<div class="ws-cell" data-r="' + r + '" data-c="' + c + '">' + WS.grid[r][c] + '</div>';
  }
  cells.innerHTML = html;
  wsDrawHighlights();
}

function wsCellEl(r, c) { return document.querySelector('#ws-cells .ws-cell[data-r="' + r + '"][data-c="' + c + '"]'); }

function wsLineSvg(r0, c0, r1, c1, color, extraClass) {
  return '<line class="' + (extraClass || '') + '" x1="' + (c0 + 0.5) + '" y1="' + (r0 + 0.5) + '" x2="' + (c1 + 0.5) + '" y2="' + (r1 + 0.5) +
    '" stroke="' + color + '" stroke-width="0.74" stroke-linecap="round" />';
}

function wsDrawHighlights() {
  var svg = document.getElementById('ws-svg');
  svg.setAttribute('viewBox', '0 0 ' + WS.size + ' ' + WS.size);
  var html = '';
  WS.words.forEach(function (w) {
    if (!w.found) return;
    var len = w.word.length - 1;
    html += wsLineSvg(w.r, w.c, w.r + w.dr * len, w.c + w.dc * len, w.color, 'ws-found-line');
  });
  var sel = WS.drag || (WS.anchor ? { r0: WS.anchor.r, c0: WS.anchor.c, r1: WS.anchor.r, c1: WS.anchor.c } : null);
  if (sel) html += wsLineSvg(sel.r0, sel.c0, sel.r1, sel.c1, 'rgba(245,243,231,0.55)', 'ws-sel-line');
  svg.innerHTML = html;
}

function wsRenderWords() {
  var meaningMode = document.getElementById('ws-meaning-mode').checked;
  var el = document.getElementById('ws-words');
  el.classList.toggle('meaning-mode', meaningMode);
  el.innerHTML = WS.words.map(function (w) {
    var main = (meaningMode && !w.found) ? (esc(w.meaning) + ' <span class="ws-len">(' + w.word.length + '글자)</span>') : w.word;
    var sub = (meaningMode && !w.found) ? '' : '<span class="ws-mean">' + esc(w.meaning) + '</span>';
    return '<div class="ws-word' + (w.found ? ' found' : '') + '"' + (w.found ? ' style="--wc:' + w.color + '"' : '') + '>' +
      '<span class="ws-en">' + main + '</span>' + sub + '</div>';
  }).join('');
}

function wsFmtTime(ms) {
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  s = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function wsUpdateStats() {
  if (!WS) return;
  var foundCount = WS.words.filter(function (w) { return w.found; }).length;
  document.getElementById('ws-found-val').textContent = foundCount + '/' + WS.words.length;
  document.getElementById('ws-hint-val').textContent = WS.hints;
  document.getElementById('ws-hint-btn').disabled = WS.done || WS.hints <= 0;
  if (!WS.done) document.getElementById('ws-time-val').textContent = wsFmtTime(Date.now() - WS.startAt);
}

/* ---- 고르기(끌기/두 번 누르기) ---- */
function wsPointToCell(e) {
  var rect = document.getElementById('ws-cells').getBoundingClientRect();
  var cw = rect.width / WS.size, ch = rect.height / WS.size;
  var c = Math.floor((e.clientX - rect.left) / cw);
  var r = Math.floor((e.clientY - rect.top) / ch);
  return { r: Math.max(0, Math.min(WS.size - 1, r)), c: Math.max(0, Math.min(WS.size - 1, c)) };
}

/* 시작 칸에서 손가락 방향을 8방향 중 가장 가까운 쪽으로 맞춰 일직선으로만 고르게 합니다. */
function wsSnap(r0, c0, r1, c1) {
  var dr = r1 - r0, dc = c1 - c0;
  if (!dr && !dc) return { r: r0, c: c0 };
  var ang = Math.atan2(dr, dc);
  var oct = Math.round(ang / (Math.PI / 4));
  var sr = Math.round(Math.sin(oct * Math.PI / 4)), sc = Math.round(Math.cos(oct * Math.PI / 4));
  var len = (sr && sc) ? Math.round((Math.abs(dr) + Math.abs(dc)) / 2) : Math.max(Math.abs(dr), Math.abs(dc));
  while (len > 0) {
    var rr = r0 + sr * len, cc = c0 + sc * len;
    if (rr >= 0 && rr < WS.size && cc >= 0 && cc < WS.size) return { r: rr, c: cc };
    len--;
  }
  return { r: r0, c: c0 };
}

function wsSelectionText(r0, c0, r1, c1) {
  var dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
  var len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
  var s = '';
  for (var k = 0; k <= len; k++) s += WS.grid[r0 + dr * k][c0 + dc * k];
  return s;
}

function wsTryCommit(r0, c0, r1, c1) {
  var text = wsSelectionText(r0, c0, r1, c1);
  var rev = text.split('').reverse().join('');
  var hit = WS.words.filter(function (w) { return !w.found && (w.word === text || w.word === rev); })[0];
  if (!hit) {
    var board = document.getElementById('ws-board');
    board.classList.remove('ws-shake');
    void board.offsetWidth;
    if (text.length > 1) board.classList.add('ws-shake');
    return false;
  }
  hit.found = true;
  hit.color = WS_HIGHLIGHT_COLORS[WS.colorIdx++ % WS_HIGHLIGHT_COLORS.length];
  // 실제로 고른 위치로 표시(같은 단어가 우연히 두 군데 생겨도 고른 곳에 칠해짐)
  var forward = hit.word === text;
  hit.r = forward ? r0 : r1; hit.c = forward ? c0 : c1;
  hit.dr = (forward ? 1 : -1) * Math.sign(r1 - r0); hit.dc = (forward ? 1 : -1) * Math.sign(c1 - c0);
  var msg = document.getElementById('ws-msg');
  msg.className = 'sd-msg';
  msg.textContent = '✨ ' + hit.word + ' = ' + hit.meaning;
  wsRenderWords();
  wsUpdateStats();
  if (WS.words.every(function (w) { return w.found; })) wsFinish();
  return true;
}

function wsFinish() {
  WS.done = true;
  stopWordSearch();
  var t = Date.now() - WS.startAt;
  var prevBest = WS_BEST[WS.level];
  var isBest = !prevBest || t < prevBest;
  if (isBest) WS_BEST[WS.level] = t;
  document.getElementById('ws-time-val').textContent = wsFmtTime(t);
  var msg = document.getElementById('ws-msg');
  msg.className = 'sd-msg over';
  msg.innerHTML = '🎉 ' + WS.level + '단계 클리어! 기록 <b>' + wsFmtTime(t) + '</b>' +
    (isBest ? (prevBest ? ' (최고 기록 갱신!)' : '') : (' · 최고 ' + wsFmtTime(prevBest))) +
    (WS.level < 5 ? '<br><button class="btn btn-primary ws-next-btn" onclick="wsChooseLevel(' + (WS.level + 1) + ')">다음 단계 도전 →</button>' : '<br>끝판왕까지 다 깼어요! 👑');
  wsUpdateStats();
}

function wsUseHint() {
  if (!WS || WS.done || WS.hints <= 0) return;
  var left = WS.words.filter(function (w) { return !w.found; });
  if (!left.length) return;
  WS.hints--;
  var w = left[Math.floor(Math.random() * left.length)];
  var cell = wsCellEl(w.r, w.c);
  if (cell) {
    cell.classList.remove('ws-hint');
    void cell.offsetWidth;
    cell.classList.add('ws-hint');
    setTimeout(function () { cell.classList.remove('ws-hint'); }, 2600);
  }
  var msg = document.getElementById('ws-msg');
  msg.className = 'sd-msg';
  msg.textContent = '💡 깜빡이는 칸에서 "' + w.meaning + '" 단어가 시작돼요!';
  wsUpdateStats();
}

(function wsSetupInput() {
  var cells = document.getElementById('ws-cells');
  if (!cells) return;
  cells.addEventListener('pointerdown', function (e) {
    if (!WS || WS.done) return;
    e.preventDefault();
    var p = wsPointToCell(e);
    try { cells.setPointerCapture(e.pointerId); } catch (err) {}
    if (WS.anchor && (WS.anchor.r !== p.r || WS.anchor.c !== p.c)) {
      // 첫 글자를 누른 뒤 끝 글자를 누르는 방식
      var a = WS.anchor;
      var end = wsSnap(a.r, a.c, p.r, p.c);
      WS.anchor = null;
      WS.drag = null;
      if (end.r === p.r && end.c === p.c) wsTryCommit(a.r, a.c, end.r, end.c);
      wsDrawHighlights();
      WS.ignoreUp = true;
      return;
    }
    WS.ignoreUp = false;
    WS.drag = { r0: p.r, c0: p.c, r1: p.r, c1: p.c, moved: false };
    wsDrawHighlights();
  });
  cells.addEventListener('pointermove', function (e) {
    if (!WS || !WS.drag) return;
    var p = wsPointToCell(e);
    var end = wsSnap(WS.drag.r0, WS.drag.c0, p.r, p.c);
    if (end.r !== WS.drag.r1 || end.c !== WS.drag.c1) {
      WS.drag.r1 = end.r; WS.drag.c1 = end.c;
      if (end.r !== WS.drag.r0 || end.c !== WS.drag.c0) WS.drag.moved = true;
      wsDrawHighlights();
    }
  });
  function up() {
    if (!WS) return;
    if (WS.ignoreUp) { WS.ignoreUp = false; return; }
    var d = WS.drag;
    if (!d) return;
    WS.drag = null;
    if (d.r1 === d.r0 && d.c1 === d.c0) {
      // 그냥 한 번 누름 → 시작 글자로 기억(같은 칸을 다시 누르면 취소)
      WS.anchor = (WS.anchor && WS.anchor.r === d.r0 && WS.anchor.c === d.c0) ? null : { r: d.r0, c: d.c0 };
    } else {
      WS.anchor = null;
      wsTryCommit(d.r0, d.c0, d.r1, d.c1);
    }
    wsDrawHighlights();
  }
  cells.addEventListener('pointerup', up);
  cells.addEventListener('pointercancel', function () { if (WS) { WS.drag = null; wsDrawHighlights(); } });
  document.getElementById('ws-meaning-mode').addEventListener('change', function () { if (WS) wsRenderWords(); });
})();
