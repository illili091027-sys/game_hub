/* ---------------- 화살표 탈출 (혼자하기 전용, 난이도 1~5) ----------------
   판 위에 구불구불한 화살표들이 빽빽하게 얽혀 있어요. 화살표를 누르면 머리가 가리키는 방향으로
   몸 전체가 뱀처럼 미끄러져 판 밖으로 빠져나가요. 가는 길에 다른 화살표가 있으면 부딪혀서
   제자리로 돌아오고 하트가 1개 줄어요(3개 다 잃으면 실패). 모든 화살표를 빼내면 클리어!
   판 만들기: 화살표를 하나씩 놓을 때마다 "머리 앞쪽 길(판 끝까지)이 이미 놓인 화살표에 막히지
   않는" 경우에만 놓습니다. 그러면 마지막에 놓은 것부터 거꾸로 빼면 반드시 풀리는 판이 돼요. */
/* minRay: 머리 앞쪽 길이 이 칸 수 이상인 화살표 위주로 놓아서(나중에 다른 화살표에 막히기 쉬움)
   서로 얽히고 순서가 중요한 어려운 판을 만들어요. */
var AR_LEVELS = {
  1: { w: 8, h: 10, minL: 2, maxL: 6, fill: 0.85, minRay: 2, name: '보통' },
  2: { w: 10, h: 13, minL: 3, maxL: 8, fill: 0.88, minRay: 3, name: '어려움' },
  3: { w: 12, h: 16, minL: 3, maxL: 11, fill: 0.9, minRay: 4, name: '아주 어려움' },
  4: { w: 14, h: 19, minL: 4, maxL: 14, fill: 0.92, minRay: 5, name: '지옥' },
  5: { w: 16, h: 22, minL: 4, maxL: 18, fill: 0.94, minRay: 6, name: '끝판왕' }
};
var AR_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
var AR_CELL = 10;
var AR = null;
var AR_RAF = null;
var AR_ANIMS = [];

function stopArrowsGame() { cancelAnimationFrame(AR_RAF); AR_RAF = null; AR_ANIMS = []; }

function startArrowsGame() {
  stopArrowsGame();
  AR = null;
  document.getElementById('ar-difficulty-select').style.display = '';
  document.getElementById('ar-game-area').style.display = 'none';
}

function arChooseLevel(lv) {
  document.getElementById('ar-difficulty-select').style.display = 'none';
  document.getElementById('ar-game-area').style.display = '';
  arNewBoard(lv);
}

/* ---- 판 만들기 ---- */
function arGenerate(lv) {
  var cfg = AR_LEVELS[lv];
  var W = cfg.w, H = cfg.h;
  var occ = [];
  for (var r = 0; r < H; r++) { occ.push([]); for (var c = 0; c < W; c++) occ[r].push(-1); }
  var arrows = [];
  var filled = 0, target = Math.floor(W * H * cfg.fill);
  function inside(r, c) { return r >= 0 && r < H && c >= 0 && c < W; }
  for (var attempt = 0; attempt < W * H * 120 && filled < target; attempt++) {
    var r0 = Math.floor(Math.random() * H), c0 = Math.floor(Math.random() * W);
    if (occ[r0][c0] !== -1) continue;
    var L = cfg.minL + Math.floor(Math.random() * (cfg.maxL - cfg.minL + 1));
    var cells = [[r0, c0]];
    var used = {}; used[r0 + ',' + c0] = 1;
    var dir = AR_DIRS[Math.floor(Math.random() * 4)];
    for (var k = 1; k < L; k++) {
      var last = cells[cells.length - 1];
      var opts = AR_DIRS.filter(function (d) {
        if (d[0] === -dir[0] && d[1] === -dir[1]) return false;
        var nr = last[0] + d[0], nc = last[1] + d[1];
        return inside(nr, nc) && occ[nr][nc] === -1 && !used[nr + ',' + nc];
      });
      if (!opts.length) break;
      // 대체로 곧게, 가끔 꺾이게
      var straight = opts.filter(function (d) { return d[0] === dir[0] && d[1] === dir[1]; });
      var nd = (straight.length && Math.random() < 0.62) ? straight[0] : opts[Math.floor(Math.random() * opts.length)];
      dir = nd;
      var nr = last[0] + nd[0], nc = last[1] + nd[1];
      cells.push([nr, nc]);
      used[nr + ',' + nc] = 1;
    }
    if (cells.length < Math.min(2, cfg.minL)) continue;
    var head = cells[cells.length - 1];
    var hd = cells.length > 1 ? [head[0] - cells[cells.length - 2][0], head[1] - cells[cells.length - 2][1]] : dir;
    // 머리 앞쪽 길이 판 끝까지 비어있어야 함 (이미 놓인 화살표 + 자기 몸 모두)
    var ok = true, rayLen = 0;
    var rr = head[0] + hd[0], cc = head[1] + hd[1];
    while (inside(rr, cc)) {
      if (occ[rr][cc] !== -1 || used[rr + ',' + cc]) { ok = false; break; }
      rr += hd[0]; cc += hd[1]; rayLen++;
    }
    if (!ok) continue;
    // 판 끝을 바로 보고 있는(바로 빠질 수 있는) 화살표는 덜 만들기
    if (rayLen < cfg.minRay && Math.random() > 0.08) continue;
    var id = arrows.length;
    cells.forEach(function (p) { occ[p[0]][p[1]] = id; });
    arrows.push({ cells: cells, dir: hd, gone: false });
    filled += cells.length;
  }
  /* 2차: 남은 빈칸을 짧은 화살표(2~4칸)로 촘촘하게 채우기 - 모든 빈칸에서 모든 방향을 시도 */
  for (var pass = 0; pass < 3; pass++) {
    for (var sr = 0; sr < H; sr++) for (var sc = 0; sc < W; sc++) {
      if (occ[sr][sc] !== -1) continue;
      var tries = shuffleArray(AR_DIRS);
      for (var t = 0; t < tries.length; t++) {
        var maxLen = 2 + Math.floor(Math.random() * 3);
        var cs = [[sr, sc]], usd = {}; usd[sr + ',' + sc] = 1;
        var dd = tries[t];
        for (var k2 = 1; k2 < maxLen; k2++) {
          var lst = cs[cs.length - 1];
          var cand = shuffleArray(AR_DIRS).filter(function (d) {
            var nr2 = lst[0] + d[0], nc2 = lst[1] + d[1];
            return !(d[0] === -dd[0] && d[1] === -dd[1]) && inside(nr2, nc2) && occ[nr2][nc2] === -1 && !usd[nr2 + ',' + nc2];
          });
          if (!cand.length) break;
          dd = cand[0];
          var np = [lst[0] + dd[0], lst[1] + dd[1]];
          cs.push(np); usd[np[0] + ',' + np[1]] = 1;
        }
        if (cs.length < 2) continue;
        var hh = cs[cs.length - 1];
        var hdir = [hh[0] - cs[cs.length - 2][0], hh[1] - cs[cs.length - 2][1]];
        var ok2 = true, r3 = hh[0] + hdir[0], c3 = hh[1] + hdir[1];
        while (inside(r3, c3)) { if (occ[r3][c3] !== -1 || usd[r3 + ',' + c3]) { ok2 = false; break; } r3 += hdir[0]; c3 += hdir[1]; }
        if (!ok2) continue;
        var ray2 = 0, r4 = hh[0] + hdir[0], c4 = hh[1] + hdir[1];
        while (inside(r4, c4)) { ray2++; r4 += hdir[0]; c4 += hdir[1]; }
        if (ray2 < 2 && Math.random() > 0.25) continue;
        var id2 = arrows.length;
        cs.forEach(function (p2) { occ[p2[0]][p2[1]] = id2; });
        arrows.push({ cells: cs, dir: hdir, gone: false });
        break;
      }
    }
  }
  return { w: W, h: H, arrows: arrows };
}

/* 판 난이도 재기: 처음부터 바로 빠질 수 있는 화살표 수와, 한 번에 뺄 수 있는 것들을 다 빼는 걸
   몇 번 반복해야 끝나는지(층 수). 층이 많고 처음에 빠지는 게 적을수록 어려운 판. */
function arMeasure(b) {
  var W = b.w, H = b.h;
  var occ = [];
  for (var r = 0; r < H; r++) { occ.push([]); for (var c = 0; c < W; c++) occ[r].push(-1); }
  b.arrows.forEach(function (a, i) { a.cells.forEach(function (p) { occ[p[0]][p[1]] = i; }); });
  var gone = b.arrows.map(function () { return false; });
  function free(i) {
    var a = b.arrows[i], h = a.cells[a.cells.length - 1];
    var r = h[0] + a.dir[0], c = h[1] + a.dir[1];
    while (r >= 0 && r < H && c >= 0 && c < W) { var o = occ[r][c]; if (o !== -1 && o !== i && !gone[o]) return false; r += a.dir[0]; c += a.dir[1]; }
    return true;
  }
  var first = 0, layers = 0;
  b.arrows.forEach(function (_, i) { if (free(i)) first++; });
  while (gone.some(function (g) { return !g; })) {
    var rem = [];
    b.arrows.forEach(function (_, i) { if (!gone[i] && free(i)) rem.push(i); });
    if (!rem.length) return { first: first, layers: -1 };
    rem.forEach(function (i) { gone[i] = true; });
    layers++;
  }
  return { first: first, layers: layers };
}

function arGenerateHard(lv) {
  var best = null, bestScore = -1e9;
  var tries = lv >= 4 ? 6 : 10;
  for (var t = 0; t < tries; t++) {
    var b = arGenerate(lv);
    var m = arMeasure(b);
    if (m.layers < 0) continue;
    var fill = b.arrows.reduce(function (s2, a) { return s2 + a.cells.length; }, 0) / (b.w * b.h);
    var score = m.layers * 4 - (m.first / b.arrows.length) * 30 + fill * 10;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best || arGenerate(lv);
}

function arNewBoard(lv, keep) {
  stopArrowsGame();
  var b = keep || arGenerateHard(lv);
  AR = {
    level: lv, w: b.w, h: b.h,
    arrows: b.arrows.map(function (a) { return { cells: a.cells.map(function (p) { return p.slice(); }), dir: a.dir.slice(), gone: false }; }),
    original: b,
    hearts: 3, hints: 3, done: false, failed: false, busy: {}
  };
  document.getElementById('ar-level-label').textContent = lv + '단계 · ' + AR_LEVELS[lv].name;
  document.getElementById('ar-msg').innerHTML = '';
  document.getElementById('ar-msg').className = 'sd-msg';
  arRenderAll();
  arUpdateHud();
}

function arRestart() { if (AR) arNewBoard(AR.level, AR.original); }
function arNewGameBtn() { if (AR) arNewBoard(AR.level); }

function arOccAt(r, c) {
  for (var i = 0; i < AR.arrows.length; i++) {
    var a = AR.arrows[i];
    if (a.gone) continue;
    for (var k = 0; k < a.cells.length; k++) if (a.cells[k][0] === r && a.cells[k][1] === c) return i;
  }
  return -1;
}

/* 머리 앞쪽으로 몇 칸 비어있는지. 막힌 게 없으면 -1 */
function arBlockDistance(i) {
  var a = AR.arrows[i];
  var h = a.cells[a.cells.length - 1];
  var r = h[0] + a.dir[0], c = h[1] + a.dir[1], d = 0;
  while (r >= 0 && r < AR.h && c >= 0 && c < AR.w) {
    var o = arOccAt(r, c);
    if (o !== -1 && o !== i) return d;
    d++; r += a.dir[0]; c += a.dir[1];
  }
  return -1;
}

/* ---- 그리기 (SVG) ---- */
function arPt(p) { return [p[1] * AR_CELL + AR_CELL / 2, p[0] * AR_CELL + AR_CELL / 2]; }

function arRenderAll() {
  var svg = document.getElementById('ar-svg');
  svg.setAttribute('viewBox', '-4 -4 ' + (AR.w * AR_CELL + 8) + ' ' + (AR.h * AR_CELL + 8));
  var html = '';
  AR.arrows.forEach(function (a, i) {
    html += '<g class="ar-arrow" data-i="' + i + '"' + (a.gone ? ' style="display:none"' : '') + '>' + arArrowShape(a.cells.map(arPt), a.dir) + '</g>';
  });
  svg.innerHTML = html;
  arFitBoard();
}

/* 판이 화면 높이 안에 다 들어오도록 너비를 맞춤 */
function arFitBoard() {
  if (!AR) return;
  var board = document.getElementById('ar-board');
  var availH = Math.max(260, window.innerHeight - 250);
  var w = availH * (AR.w * AR_CELL + 8) / (AR.h * AR_CELL + 8) + 28;
  board.style.maxWidth = Math.min(560, Math.max(240, w)) + 'px';
}
window.addEventListener('resize', function () { if (document.getElementById('arrows') && document.getElementById('arrows').classList.contains('active')) arFitBoard(); });

/* 점들(pts)로 몸통 선 + 머리 삼각형 + 넓은 터치 영역 */
function arArrowShape(pts, dir) {
  var poly = pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' ');
  var h = pts[pts.length - 1];
  var hx = h[0] + dir[1] * 3.2, hy = h[1] + dir[0] * 3.2;
  var tip = (hx + dir[1] * 2.6).toFixed(2) + ',' + (hy + dir[0] * 2.6).toFixed(2);
  // 머리 삼각형 꼭짓점 (가로/세로 방향별)
  var b1, b2;
  if (dir[0] === 0) { b1 = [hx - dir[1] * 1.2, hy - 2.6]; b2 = [hx - dir[1] * 1.2, hy + 2.6]; }
  else { b1 = [hx - 2.6, hy - dir[0] * 1.2]; b2 = [hx + 2.6, hy - dir[0] * 1.2]; }
  var lineEnd = [h[0] + dir[1] * 2.2, h[1] + dir[0] * 2.2];
  return '<polyline class="ar-hit" points="' + poly + ' ' + lineEnd[0].toFixed(2) + ',' + lineEnd[1].toFixed(2) + '" />' +
    '<polyline class="ar-body" points="' + poly + ' ' + lineEnd[0].toFixed(2) + ',' + lineEnd[1].toFixed(2) + '" />' +
    '<polygon class="ar-head" points="' + tip + ' ' + b1[0].toFixed(2) + ',' + b1[1].toFixed(2) + ' ' + b2[0].toFixed(2) + ',' + b2[1].toFixed(2) + '" />';
}

function arUpdateHud() {
  var hearts = '';
  for (var i = 0; i < 3; i++) hearts += i < AR.hearts ? '❤️' : '🤍';
  document.getElementById('ar-hearts').textContent = hearts;
  document.getElementById('ar-hint-btn').textContent = '💡 힌트 ' + AR.hints;
  document.getElementById('ar-hint-btn').disabled = AR.hints <= 0 || AR.done || AR.failed;
  var left = AR.arrows.filter(function (a) { return !a.gone; }).length;
  var total = AR.arrows.length;
  document.getElementById('ar-progress-fill').style.width = ((total - left) / total * 100) + '%';
  document.getElementById('ar-count').textContent = '남은 화살표 ' + left + '개';
}

/* 몸통이 경로(path: 점 배열) 위에서 offset만큼 앞으로 이동했을 때의 점들 */
function arWindow(path, start, len) {
  var pts = [];
  function at(t) {
    var i = Math.max(0, Math.min(path.length - 1, Math.floor(t)));
    var f = t - i;
    if (i >= path.length - 1) return path[path.length - 1];
    return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f];
  }
  pts.push(at(start));
  for (var k = Math.ceil(start); k < start + len - 1; k++) if (k > start) pts.push(path[k]);
  pts.push(at(start + len - 1));
  return pts;
}

/* ---- 누르기 ---- */
function arTap(i) {
  if (!AR || AR.done || AR.failed || AR.busy[i]) return;
  var a = AR.arrows[i];
  if (a.gone) return;
  var d = arBlockDistance(i);
  var cellPath = a.cells.map(function (p) { return p.slice(); });
  var h = a.cells[a.cells.length - 1];
  var extra = d === -1 ? (Math.max(AR.w, AR.h) + a.cells.length + 2) : d;
  for (var k = 1; k <= extra; k++) cellPath.push([h[0] + a.dir[0] * k, h[1] + a.dir[1] * k]);
  var path = cellPath.map(arPt);
  var g = document.querySelector('#ar-svg .ar-arrow[data-i="' + i + '"]');
  AR.busy[i] = true;
  if (d === -1) {
    a.gone = true; // 바로 빠진 것으로 처리(다른 화살표 판정에 반영)
    arUpdateHud();
    AR_ANIMS.push({ i: i, g: g, path: path, len: a.cells.length, dir: a.dir, t: 0, dist: extra, mode: 'exit' });
  } else {
    var bumpDist = d + 0.35;
    g.classList.add('ar-bad');
    AR_ANIMS.push({ i: i, g: g, path: path, len: a.cells.length, dir: a.dir, t: 0, dist: bumpDist, mode: 'bump' });
    AR.hearts--;
    arUpdateHud();
    var board = document.getElementById('ar-board');
    board.classList.remove('ar-shake'); void board.offsetWidth; board.classList.add('ar-shake');
    if (AR.hearts <= 0) {
      AR.failed = true;
      setTimeout(arFail, 650);
    }
  }
  if (!AR_RAF) AR_RAF = requestAnimationFrame(arAnimTick);
}

var AR_LAST_TS = 0;
function arAnimTick(ts) {
  var dt = AR_LAST_TS ? Math.min(0.05, (ts - AR_LAST_TS) / 1000) : 0.016;
  AR_LAST_TS = ts;
  AR_ANIMS.forEach(function (an) {
    var speed = an.mode === 'exit' ? 22 : 16; // 칸/초
    an.t += dt * speed;
    var offset;
    if (an.mode === 'exit') offset = Math.min(an.t, an.dist);
    else {
      // 앞으로 갔다가 부딪히고 되돌아옴
      var go = an.dist;
      offset = an.t <= go ? an.t : Math.max(0, go - (an.t - go) * 1.2);
      if (an.t > go * 2.2) an.done = true;
    }
    var pts = arWindow(an.path, offset, an.len);
    if (an.g) an.g.innerHTML = arArrowShape(pts, an.dir);
    if (an.mode === 'exit' && an.t >= an.dist) { an.done = true; if (an.g) an.g.style.display = 'none'; }
    if (an.done) {
      delete AR.busy[an.i];
      if (an.mode === 'bump' && an.g) {
        an.g.innerHTML = arArrowShape(AR.arrows[an.i].cells.map(arPt), an.dir);
        setTimeout(function () { an.g.classList.remove('ar-bad'); }, 250);
      }
    }
  });
  AR_ANIMS = AR_ANIMS.filter(function (an) { return !an.done; });
  if (AR && !AR.done && !AR.failed && AR.arrows.every(function (a) { return a.gone; }) && !AR_ANIMS.length) arWin();
  if (AR_ANIMS.length) AR_RAF = requestAnimationFrame(arAnimTick);
  else { AR_RAF = null; AR_LAST_TS = 0; }
}

function arWin() {
  AR.done = true;
  arUpdateHud();
  var msg = document.getElementById('ar-msg');
  msg.className = 'sd-msg win';
  msg.innerHTML = '🎉 ' + AR.level + '단계 클리어! (남은 하트 ' + AR.hearts + '개)' +
    (AR.level < 5 ? '<br><button class="btn btn-primary ws-next-btn" onclick="arChooseLevel(' + (AR.level + 1) + ')">다음 단계 →</button>' : '<br>끝판왕까지 다 깼어요! 👑') +
    ' <button class="btn btn-ghost ws-next-btn" onclick="arNewGameBtn()">같은 단계 새 판</button>';
}

function arFail() {
  var msg = document.getElementById('ar-msg');
  msg.className = 'sd-msg over';
  msg.innerHTML = '💔 하트를 다 잃었어요!<br><button class="btn btn-primary ws-next-btn" onclick="arRestart()">같은 판 다시</button> <button class="btn btn-ghost ws-next-btn" onclick="arNewGameBtn()">새 판</button>';
  arUpdateHud();
}

function arUseHint() {
  if (!AR || AR.done || AR.failed || AR.hints <= 0) return;
  var can = [];
  AR.arrows.forEach(function (a, i) { if (!a.gone && !AR.busy[i] && arBlockDistance(i) === -1) can.push(i); });
  if (!can.length) return;
  AR.hints--;
  var i = can[Math.floor(Math.random() * can.length)];
  var g = document.querySelector('#ar-svg .ar-arrow[data-i="' + i + '"]');
  if (g) { g.classList.remove('ar-hint'); void g.getBoundingClientRect(); g.classList.add('ar-hint'); setTimeout(function () { g.classList.remove('ar-hint'); }, 2400); }
  arUpdateHud();
}

(function arSetupInput() {
  var svg = document.getElementById('ar-svg');
  if (!svg) return;
  svg.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('.ar-arrow');
    if (!g) return;
    arTap(+g.getAttribute('data-i'));
  });
})();
