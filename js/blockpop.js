/* ---------------- 블록 팡 (혼자 하기 · 블록 퍼즐) ----------------
   8×8 판에 블록 3개를 끌어다 놓아요 (돌리기 없음). 가로나 세로 한 줄을 꽉 채우면 팡! 사라져요.
   - 연속으로 줄을 지우면 콤보 (점수 배로), 판을 완전히 비우면 보너스
   - 남은 블록을 더 놓을 곳이 없으면 끝. 최고 점수는 이 기기에 저장돼요.
   - 블록 한 칸 한 칸은 사용자가 준 그림(data/block-tiles.js)으로 그려요. */
var BP = null, BP_RAF = null, BP_IMG = null;
var BP_N = 8;
var BP_SHAPES = [
  [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]], [[1, 0], [1, 1], [1, 2], [0, 2]], [[0, 0], [1, 0], [2, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [1, 2]], [[0, 0], [1, 0], [0, 1], [0, 2]], [[0, 1], [1, 1], [2, 1], [0, 0]], [[0, 1], [1, 1], [2, 1], [2, 0]],
  [[0, 0], [1, 0], [2, 0], [1, 1]], [[1, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [0, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [0, 1], [1, 1], [1, 2]], [[1, 0], [1, 1], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], [[2, 0], [2, 1], [2, 2], [1, 2], [0, 2]]
];
function bpBest() { try { return +localStorage.getItem('gamehub_blockpop_best') || 0; } catch (e) { return 0; } }

function stopBlockPop() { cancelAnimationFrame(BP_RAF); BP_RAF = null; }
function startBlockPop() {
  stopBlockPop();
  if (!BP_IMG && typeof BLOCK_TILES_SRC === 'string') { BP_IMG = new Image(); BP_IMG.src = BLOCK_TILES_SRC; }
  var cv = document.getElementById('bp-canvas');
  BP = { cv: cv, ctx: cv.getContext('2d'), board: [], slots: [], score: 0, shown: 0, combo: 0, since: 0, drag: null, fx: [], pops: [], over: false, best: bpBest() };
  for (var i = 0; i < BP_N * BP_N; i++) BP.board.push(-1);
  bpDeal();
  document.getElementById('bp-over').style.display = 'none';
  BP_RAF = requestAnimationFrame(bpFrame);
}
/* 난이도: 점수에 따라 3단계
   🌱 0~999점: 작은 블록 위주 + 줄을 바로 지울 수 있는 블록을 골라 줘요 + 점수 2배 → 초반엔 점수가 팍팍!
   🔥 1000~2999점: 보통 (골고루)
   💀 3000점~: 큰 블록(3×3, 5칸 막대, 큰 ㄱ자)이 자주 나오고, 놓을 곳을 봐주지 않아요 */
function bpStage() { return BP.score < 1000 ? 0 : (BP.score < 3000 ? 1 : 2); }
var BP_STAGE_NAME = ['🌱 쉬움 · 점수 2배!', '🔥 보통', '💀 어려움'];
var BP_WEIGHTS = [[6, 2, 0.25], [2, 2, 1], [1, 2, 2.6]];   /* [작은(1~3칸), 보통(4칸), 큰(5칸 이상)] */
function bpPickShape(stage) {
  var w = BP_WEIGHTS[stage], tot = 0, ws = BP_SHAPES.map(function (c) { var k = c.length <= 3 ? 0 : (c.length === 4 ? 1 : 2); tot += w[k]; return w[k]; });
  var r = Math.random() * tot;
  for (var i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return BP_SHAPES[i]; }
  return BP_SHAPES[0];
}
/* 이 블록을 어딘가에 놓으면 줄이 지워지는지 */
function bpCanClear(cells) {
  for (var y = 0; y < BP_N; y++) for (var x = 0; x < BP_N; x++) {
    if (!bpFits(cells, x, y)) continue;
    var L = bpLinesIf(cells, x, y);
    if (L.rows.length + L.cols.length) return true;
  }
  return false;
}
function bpDeal() {
  var stage = bpStage(), nt = typeof BLOCK_TILES_N === 'number' ? BLOCK_TILES_N : 12;
  var make = function () { return [0, 1, 2].map(function () { return { cells: bpPickShape(stage), tile: Math.floor(Math.random() * nt) }; }); };
  if (stage === 0) {
    /* 쉬움: 여러 세트 중 '다 놓을 수 있고, 줄을 지울 수 있는' 세트를 골라요 */
    var best = null, bestSc = -1;
    for (var t = 0; t < 40; t++) {
      var set = make(), sc = 0;
      set.forEach(function (p) { if (bpCanPlaceAnywhere(p.cells)) sc += 2; if (bpCanClear(p.cells)) sc += 3; });
      if (sc > bestSc) { bestSc = sc; best = set; }
    }
    BP.slots = best; return;
  }
  var tries = stage === 2 ? (Math.random() < 0.6 ? 30 : 1) : 30;   /* 어려움: 가끔은 놓을 곳을 안 봐줘요 */
  for (var t2 = 0; t2 < tries; t2++) {
    var set2 = make();
    if (set2.some(function (p) { return bpCanPlaceAnywhere(p.cells); }) || t2 === tries - 1) { BP.slots = set2; return; }
  }
}
function bpFits(cells, gx, gy) {
  return cells.every(function (c) { var x = gx + c[0], y = gy + c[1]; return x >= 0 && y >= 0 && x < BP_N && y < BP_N && BP.board[y * BP_N + x] < 0; });
}
function bpCanPlaceAnywhere(cells) {
  for (var y = 0; y < BP_N; y++) for (var x = 0; x < BP_N; x++) if (bpFits(cells, x, y)) return true;
  return false;
}
/* 놓으면 지워질 줄 미리 계산 */
function bpLinesIf(cells, gx, gy) {
  var b = BP.board.slice();
  cells.forEach(function (c) { b[(gy + c[1]) * BP_N + gx + c[0]] = 1; });
  var rows = [], cols = [];
  for (var i = 0; i < BP_N; i++) {
    var r = true, k = true;
    for (var j = 0; j < BP_N; j++) { if (b[i * BP_N + j] < 0) r = false; if (b[j * BP_N + i] < 0) k = false; }
    if (r) rows.push(i); if (k) cols.push(i);
  }
  return { rows: rows, cols: cols };
}
function bpPlace(si, gx, gy) {
  var p = BP.slots[si];
  p.cells.forEach(function (c) { BP.board[(gy + c[1]) * BP_N + gx + c[0]] = p.tile; });
  var stage0 = bpStage(), mult = stage0 === 0 ? 2 : 1;   /* 쉬움 구간은 점수 2배 */
  BP.score += p.cells.length * mult;
  var L = bpLinesIf([], 0, 0), n = L.rows.length + L.cols.length;
  if (n) {
    BP.combo++; BP.since = 0;
    var gain = (n * 10 * BP.combo + (n > 1 ? (n - 1) * 10 : 0)) * mult;
    var clear = {};
    L.rows.forEach(function (r) { for (var j = 0; j < BP_N; j++) clear[r * BP_N + j] = 1; });
    L.cols.forEach(function (c) { for (var j = 0; j < BP_N; j++) clear[j * BP_N + c] = 1; });
    Object.keys(clear).forEach(function (id) { BP.fx.push({ id: +id, tile: BP.board[id], at: Date.now() }); BP.board[id] = -1; });
    BP.score += gain;
    var txt = '+' + gain + (BP.combo > 1 ? '  콤보 ×' + BP.combo + '!' : '');
    if (BP.board.every(function (v) { return v < 0; })) { BP.score += 300; txt += '  ✨ 싹 비웠다! +300'; }
    BP.pops.push({ t: txt, at: Date.now(), x: (gx + 1) , y: gy });
    if (typeof mmSound === 'function') mmSound(BP.combo > 1 ? 'win' : 'catch');
  } else {
    BP.since++;
    if (BP.since >= 3) BP.combo = 0;   /* 3번 연속 못 지우면 콤보 끝 */
    if (typeof mmSound === 'function') mmSound('plop');
  }
  BP.slots[si] = null;
  if (bpStage() !== stage0) BP.pops.push({ t: bpStage() === 1 ? '🔥 난이도 UP! 이제 보통' : '💀 난이도 UP! 큰 블록 조심', at: Date.now() + 500 });
  if (BP.slots.every(function (s) { return !s; })) bpDeal();
  if (BP.score > BP.best) { BP.best = BP.score; BP.newBest = true; try { localStorage.setItem('gamehub_blockpop_best', BP.best); } catch (e) {} }
  /* 더 놓을 곳이 없으면 끝 */
  if (!BP.slots.some(function (s) { return s && bpCanPlaceAnywhere(s.cells); })) {
    BP.over = true;
    setTimeout(function () {
      document.getElementById('bp-over').style.display = '';
      document.getElementById('bp-over-score').textContent = BP.score;
      document.getElementById('bp-over-best').textContent = BP.best;
      if (typeof playFart === 'function') playFart();
      typeof soloCoin === 'function' && soloCoin(Math.min(40, Math.floor(BP.score / 100)) + (BP.newBest && BP.score >= 300 ? 20 : 0), BP.newBest ? '최고 기록!' : '블록 팡');
    }, 700);
  }
}

/* ---- 배치 (캔버스 좌표 400×600) ---- */
var BP_W = 400, BP_H = 600, BP_BX = 16, BP_BY = 70, BP_C = 46;   /* 판 왼쪽 위, 칸 크기 */
function bpSlotRect(i) { return { x: 14 + i * 126, y: BP_BY + BP_C * BP_N + 30, w: 120, h: 120 }; }
function bpFrame() {
  BP_RAF = requestAnimationFrame(bpFrame);
  if (!BP || !document.getElementById('blockpop').classList.contains('active')) return;
  bpDraw();
}
function bpTile(ctx, tile, x, y, s, alpha) {
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  var r = s * 0.14;
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + s, y, x + s, y + s, r); ctx.arcTo(x + s, y + s, x, y + s, r); ctx.arcTo(x, y + s, x, y, r); ctx.arcTo(x, y, x + s, y, r); ctx.closePath();
  ctx.clip();
  if (BP_IMG && BP_IMG.complete && BP_IMG.naturalWidth) ctx.drawImage(BP_IMG, tile * 96, 0, 96, 96, x, y, s, s);
  else { ctx.fillStyle = 'hsl(' + tile * 30 + ',60%,60%)'; ctx.fillRect(x, y, s, s); }
  /* 블록 느낌: 위 밝게, 아래 어둡게 테두리 */
  ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.stroke();
  ctx.restore();
}
function bpDraw() {
  var ctx = BP.ctx, now = Date.now();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  var g = ctx.createLinearGradient(0, 0, 0, BP_H); g.addColorStop(0, '#3d4f8f'); g.addColorStop(1, '#2c3870');
  ctx.fillStyle = g; ctx.fillRect(0, 0, BP_W, BP_H);
  /* 점수 (부드럽게 올라가요) */
  BP.shown += Math.ceil((BP.score - BP.shown) / 6);
  if (BP.shown > BP.score) BP.shown = BP.score;
  ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('👑 ' + BP.best, 16, 28);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(BP.shown, BP_W / 2, 50);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(BP_STAGE_NAME[bpStage()], 16, 50);
  if (BP.combo > 1) { ctx.fillStyle = '#ff8a80'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('콤보 ×' + BP.combo, BP_W - 16, 28); }
  /* 판 */
  ctx.fillStyle = '#1e2752'; ctx.fillRect(BP_BX - 4, BP_BY - 4, BP_C * BP_N + 8, BP_C * BP_N + 8);
  for (var y = 0; y < BP_N; y++) for (var x = 0; x < BP_N; x++) {
    var v = BP.board[y * BP_N + x], px = BP_BX + x * BP_C, py = BP_BY + y * BP_C;
    ctx.fillStyle = '#26306a'; ctx.fillRect(px + 1, py + 1, BP_C - 2, BP_C - 2);
    if (v >= 0) bpTile(ctx, v, px + 1, py + 1, BP_C - 2);
  }
  /* 끌고 있을 때: 놓일 자리 + 지워질 줄 반짝 */
  var d = BP.drag;
  if (d && d.gx != null) {
    var L = bpLinesIf(d.p.cells, d.gx, d.gy);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    L.rows.forEach(function (r) { ctx.fillRect(BP_BX, BP_BY + r * BP_C, BP_C * BP_N, BP_C); });
    L.cols.forEach(function (c) { ctx.fillRect(BP_BX + c * BP_C, BP_BY, BP_C, BP_C * BP_N); });
    d.p.cells.forEach(function (c) { bpTile(ctx, d.p.tile, BP_BX + (d.gx + c[0]) * BP_C + 1, BP_BY + (d.gy + c[1]) * BP_C + 1, BP_C - 2, 0.45); });
  }
  /* 지워지는 효과 */
  BP.fx = BP.fx.filter(function (f) {
    var t = (now - f.at) / 380; if (t >= 1) return false;
    var x = f.id % BP_N, y = Math.floor(f.id / BP_N), s = (BP_C - 2) * (1 - t * 0.6);
    var px = BP_BX + x * BP_C + (BP_C - s) / 2, py = BP_BY + y * BP_C + (BP_C - s) / 2 - t * 14;
    bpTile(ctx, f.tile, px, py, s, 1 - t);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - t)) + ')'; ctx.fillRect(px, py, s, s);
    return true;
  });
  /* 아래 블록 3개 */
  for (var i = 0; i < 3; i++) {
    var p = BP.slots[i];
    if (!p || (d && d.si === i)) continue;
    var r = bpSlotRect(i), sz = bpSize(p.cells), cs = Math.min(24, 104 / Math.max(sz.w, sz.h));
    var ox = r.x + (r.w - sz.w * cs) / 2, oy = r.y + (r.h - sz.h * cs) / 2;
    var can = bpCanPlaceAnywhere(p.cells);
    p.cells.forEach(function (c) { bpTile(ctx, p.tile, ox + c[0] * cs, oy + c[1] * cs, cs - 1, can ? 1 : 0.3); });
  }
  /* 끌고 있는 블록 (판 칸 크기로) */
  if (d) d.p.cells.forEach(function (c) { bpTile(ctx, d.p.tile, d.x + c[0] * BP_C, d.y + c[1] * BP_C, BP_C - 2); });
  /* 점수 글씨 */
  BP.pops = BP.pops.filter(function (q) {
    var t = (now - q.at) / 1100; if (t >= 1) return false;
    ctx.globalAlpha = 1 - t; ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,20,80,0.8)';
    var ty = BP_BY + BP_C * BP_N / 2 - t * 40;
    ctx.strokeText(q.t, BP_W / 2, ty); ctx.fillText(q.t, BP_W / 2, ty);
    ctx.globalAlpha = 1;
    return true;
  });
}
function bpSize(cells) { var w = 0, h = 0; cells.forEach(function (c) { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); }); return { w: w, h: h }; }

(function bpSetupInput() {
  var cv = document.getElementById('bp-canvas');
  if (!cv) return;
  var pos = function (e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * BP_W, (e.clientY - r.top) / r.height * BP_H]; };
  cv.addEventListener('pointerdown', function (e) {
    if (!BP || BP.over) return;
    var q = pos(e);
    for (var i = 0; i < 3; i++) {
      var r = bpSlotRect(i);
      if (BP.slots[i] && q[0] >= r.x && q[0] < r.x + r.w && q[1] >= r.y - 10 && q[1] < r.y + r.h + 10) {
        e.preventDefault();
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
        var sz = bpSize(BP.slots[i].cells);
        /* 손가락에 가리지 않게 블록은 손가락보다 위에 떠요 */
        var lift = e.pointerType === 'mouse' ? 0 : 70;
        BP.drag = { si: i, p: BP.slots[i], ox: sz.w * BP_C / 2, oy: sz.h * BP_C / 2 + lift, x: 0, y: 0, gx: null, gy: null };
        bpMove(q);
        return;
      }
    }
  });
  var bpMove = function (q) {
    var d = BP.drag; if (!d) return;
    d.x = q[0] - d.ox; d.y = q[1] - d.oy;
    var gx = Math.round((d.x - BP_BX) / BP_C), gy = Math.round((d.y - BP_BY) / BP_C);
    if (bpFits(d.p.cells, gx, gy)) { d.gx = gx; d.gy = gy; } else { d.gx = d.gy = null; }
  };
  cv.addEventListener('pointermove', function (e) { if (BP && BP.drag) bpMove(pos(e)); });
  var up = function () {
    if (!BP || !BP.drag) return;
    var d = BP.drag; BP.drag = null;
    if (d.gx != null) bpPlace(d.si, d.gx, d.gy);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', function () { if (BP) BP.drag = null; });
})();
