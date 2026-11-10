/* ---------------- 도시락 칼질 (혼자 하기 · 잔잔한 퍼즐) ----------------
   도마 위 재료를 칼로 잘라서, 도시락 통의 빈칸을 빈틈없이 꽉 채우면 성공!
   - 🔪 자르기: 재료 위에 올리면 자를 선이 보여요. 누르면 싹둑 (줄 따라 끝까지)
   - ✋ 옮기기: 조각을 끌어서 도시락 통에 넣어요. 그냥 톡 누르면 90° 돌아가요
   - 칼질을 적게 할수록 별이 많아요 (기준 이하 ⭐⭐⭐). 시간 제한은 없어요.
   단계 데이터는 data/bento-levels.js (모두 풀 수 있는 것만 자동으로 만들었어요) */
var BT = null;
var BT_RAF = null;
var BT_FOODS = [
  { n: '흰쌀밥', fill: '#fbf8f1', edge: '#d8cfbd', tex: 'rice' },
  { n: '계란말이', fill: '#ffd95a', edge: '#d9a92c', tex: 'egg' },
  { n: '연어', fill: '#ff9566', edge: '#d46a3f', tex: 'salmon' },
  { n: '녹차 양갱', fill: '#8fc36b', edge: '#5f9446', tex: 'jelly' },
  { n: '김밥', fill: '#2f3a2c', edge: '#141a12', tex: 'kimbap' }
];
var BT_GARNISH = ['🍋', '🌿', '🥢', '🍅', '🥒', '🍙'];

function btSave() { try { localStorage.setItem('gamehub_bento_v1', JSON.stringify(BT_PROG)); } catch (e) {} }
var BT_PROG = (function () { try { return JSON.parse(localStorage.getItem('gamehub_bento_v1') || 'null') || { stars: {} }; } catch (e) { return { stars: {} }; } })();

function stopBentoGame() { cancelAnimationFrame(BT_RAF); BT_RAF = null; }
function startBentoGame() {
  stopBentoGame();
  btShowLevels();
}
function btShowLevels() {
  document.getElementById('bt-levels').style.display = '';
  document.getElementById('bt-play').style.display = 'none';
  var total = 0;
  var html = BENTO_LEVELS.map(function (L, i) {
    var st = BT_PROG.stars[i] || 0; total += st;
    var open = i === 0 || BT_PROG.stars[i - 1];
    return '<button class="bt-lv' + (open ? '' : ' locked') + (st ? ' done' : '') + '" ' + (open ? 'onclick="btStart(' + i + ')"' : 'disabled') + '><b>' + (i + 1) + '</b><span>' + (open ? '★★★'.slice(0, st) + '<i>' + '★★★'.slice(st) + '</i>' : '🔒') + '</span></button>';
  }).join('');
  document.getElementById('bt-lv-grid').innerHTML = html;
  document.getElementById('bt-total').textContent = total + ' / ' + BENTO_LEVELS.length * 3;
}

function btStart(i) {
  var L = BENTO_LEVELS[i];
  BT = {
    lv: i, L: L, cuts: 0, limit: L.p + 2, tool: 'knife', pieces: [], hist: [], drag: null, hover: null, hint: 0, won: false, nid: 1,
    cv: document.getElementById('bt-canvas')
  };
  BT.ctx = BT.cv.getContext('2d');
  BT.pieces.push({ id: BT.nid++, w: L.s[0], h: L.s[1], food: L.f, bx: null, by: null, x: 0, y: 0 });
  document.getElementById('bt-levels').style.display = 'none';
  document.getElementById('bt-play').style.display = '';
  document.getElementById('bt-done').style.display = 'none';
  btLayout(true);
  btSetTool('knife');
  btHud();
  cancelAnimationFrame(BT_RAF);
  BT_RAF = requestAnimationFrame(btFrame);
}
function btNext() { if (BT && BT.lv + 1 < BENTO_LEVELS.length) btStart(BT.lv + 1); else btShowLevels(); }
function btRestart() { if (BT) btStart(BT.lv); }

/* ---- 화면 배치: 왼쪽 도마 + 오른쪽 도시락 (휴대폰처럼 좁으면 위/아래) ---- */
function btLayout(resetPieces) {
  var cv = BT.cv, r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  var W = cv.width, H = cv.height, L = BT.L;
  var tall = H > W * 0.9;
  /* 칸 크기: 도마와 도시락이 둘 다 들어가게 */
  var boardCells = Math.max(L.s[0], L.s[1]) + 2.4;
  var S = tall ? Math.min(W / (Math.max(L.b[0], boardCells) + 1.2), H / (L.b[1] + boardCells + 2)) : Math.min(W / (boardCells + L.b[0] + 2.2), H / (Math.max(L.b[1], boardCells) + 1.4));
  S = Math.floor(Math.min(S, 70 * dpr));
  BT.S = S; BT.W = W; BT.H = H; BT.dpr = dpr;
  if (tall) {
    BT.board = { x: 0, y: 0, w: W, h: H - (L.b[1] + 1.4) * S };
    BT.box = { x: Math.round((W - L.b[0] * S) / 2), y: Math.round(H - (L.b[1] + 0.8) * S) };
  } else {
    BT.board = { x: 0, y: 0, w: W - (L.b[0] + 1.6) * S, h: H };
    BT.box = { x: Math.round(W - (L.b[0] + 0.8) * S), y: Math.round((H - L.b[1] * S) / 2) };
  }
  if (resetPieces) {
    var p = BT.pieces[0];
    p.x = BT.board.x + (BT.board.w - p.w * S) / 2; p.y = BT.board.y + (BT.board.h - p.h * S) / 2;
  }
}
window.addEventListener('resize', function () { if (BT && document.getElementById('bento').classList.contains('active')) btLayout(false); });

function btBlocked(gx, gy) { return BT.L.x.some(function (c) { return c[0] === gx && c[1] === gy; }); }
function btSnap() { return JSON.stringify({ p: BT.pieces, c: BT.cuts, n: BT.nid }); }
function btPush() { BT.hist.push(btSnap()); if (BT.hist.length > 80) BT.hist.shift(); }
function btUndo() {
  if (!BT || !BT.hist.length || BT.won) return;
  var s = JSON.parse(BT.hist.pop());
  BT.pieces = s.p; BT.cuts = s.c; BT.nid = s.n;
  btHud();
}
function btSetTool(t) {
  if (!BT) return;
  BT.tool = t;
  document.querySelectorAll('.bt-tool').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
  BT.cv.style.cursor = t === 'knife' ? 'crosshair' : 'grab';
}
function btHint() {
  if (!BT || BT.won) return;
  BT.hint = Date.now() + 3000;
}
function btHud() {
  var left = BT.limit - BT.cuts;
  document.getElementById('bt-lvname').textContent = (BT.lv + 1) + '단계 · ' + BT_FOODS[BT.L.f].n;
  document.getElementById('bt-cuts').innerHTML = '🔪 <b>' + BT.cuts + '</b> / ' + BT.limit + ' <small>(⭐⭐⭐ ' + BT.L.p + '번 이하)</small>';
  document.getElementById('bt-cuts').classList.toggle('warn', left <= 0);
}

/* ---- 조각 위치 ---- */
function btRect(p) {
  if (p.bx != null) return { x: BT.box.x + p.bx * BT.S, y: BT.box.y + p.by * BT.S, w: p.w * BT.S, h: p.h * BT.S };
  return { x: p.x, y: p.y, w: p.w * BT.S, h: p.h * BT.S };
}
function btPieceAt(px, py) {
  for (var i = BT.pieces.length - 1; i >= 0; i--) {
    var r = btRect(BT.pieces[i]);
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return BT.pieces[i];
  }
  return null;
}
/* 자를 선 고르기: 마우스에서 가장 가까운 안쪽 줄 */
function btCutLine(p, px, py) {
  if (p.bx != null) return null;
  var r = btRect(p), S = BT.S;
  var lx = (px - r.x) / S, ly = (py - r.y) / S;
  var cv = Math.round(lx), ch = Math.round(ly);
  var dv = (cv > 0 && cv < p.w) ? Math.abs(lx - cv) : 99, dh = (ch > 0 && ch < p.h) ? Math.abs(ly - ch) : 99;
  if (dv === 99 && dh === 99) return null;
  return dv <= dh ? { o: 'v', c: cv } : { o: 'h', c: ch };
}
function btCut(p, line) {
  if (BT.cuts >= BT.limit) { btToast('칼질을 다 썼어요! ↩ 되돌리기나 🔄 처음부터'); return; }
  btPush();
  var a, b, gap = BT.S * 0.18;
  if (line.o === 'v') {
    a = { id: BT.nid++, w: line.c, h: p.h, food: p.food, x: p.x - gap / 2, y: p.y, bx: null, by: null };
    b = { id: BT.nid++, w: p.w - line.c, h: p.h, food: p.food, x: p.x + line.c * BT.S + gap / 2, y: p.y, bx: null, by: null };
  } else {
    a = { id: BT.nid++, w: p.w, h: line.c, food: p.food, x: p.x, y: p.y - gap / 2, bx: null, by: null };
    b = { id: BT.nid++, w: p.w, h: p.h - line.c, food: p.food, x: p.x, y: p.y + line.c * BT.S + gap / 2, bx: null, by: null };
  }
  var i = BT.pieces.indexOf(p);
  BT.pieces.splice(i, 1, a, b);
  BT.cuts++;
  BT.flash = { at: Date.now(), line: line, r: btRect(a), p: p, o: line.o, X: line.o === 'v' ? p.x + line.c * BT.S : null, Y: line.o === 'h' ? p.y + line.c * BT.S : null, pw: p.w * BT.S, ph: p.h * BT.S, px: p.x, py: p.y };
  if (typeof mmSound === 'function') mmSound('mash');
  btHud();
}
/* 도시락에 들어갈 수 있는지 */
function btFits(p, gx, gy, w, h) {
  var L = BT.L;
  if (gx < 0 || gy < 0 || gx + w > L.b[0] || gy + h > L.b[1]) return false;
  for (var y = gy; y < gy + h; y++) for (var x = gx; x < gx + w; x++) {
    if (btBlocked(x, y)) return false;
    for (var k = 0; k < BT.pieces.length; k++) {
      var q = BT.pieces[k];
      if (q === p || q.bx == null) continue;
      if (x >= q.bx && x < q.bx + q.w && y >= q.by && y < q.by + q.h) return false;
    }
  }
  return true;
}
function btCheckWin() {
  var L = BT.L, need = L.b[0] * L.b[1] - L.x.length, got = 0;
  BT.pieces.forEach(function (p) { if (p.bx != null) got += p.w * p.h; });
  var onBoard = BT.pieces.some(function (p) { return p.bx == null; });
  if (got >= need && !onBoard) {
    BT.won = true;
    var st = BT.cuts <= L.p ? 3 : (BT.cuts <= L.p + 1 ? 2 : 1);
    if (st > (BT_PROG.stars[BT.lv] || 0)) { BT_PROG.stars[BT.lv] = st; btSave(); }
    if (typeof mmSound === 'function') mmSound('win');
    setTimeout(function () {
      document.getElementById('bt-done').style.display = '';
      document.getElementById('bt-done-stars').innerHTML = '★★★'.slice(0, st) + '<i>' + '★★★'.slice(st) + '</i>';
      document.getElementById('bt-done-msg').textContent = st === 3 ? '완벽한 도시락! 🍱' : (st === 2 ? '맛있어 보여요! 한 번만 덜 잘라 볼까요?' : '완성! 칼질을 줄이면 별이 더 많아요');
      document.getElementById('bt-done-next').style.display = BT.lv + 1 < BENTO_LEVELS.length ? '' : 'none';
    }, 650);
  }
}

var BT_TOAST_T = null;
function btToast(t) {
  var el = document.getElementById('bt-toast');
  el.textContent = t; el.classList.add('show');
  clearTimeout(BT_TOAST_T); BT_TOAST_T = setTimeout(function () { el.classList.remove('show'); }, 1800);
}

/* ---- 그리기 ---- */
function btFrame() {
  BT_RAF = requestAnimationFrame(btFrame);
  if (!BT || !document.getElementById('bento').classList.contains('active') || document.getElementById('bt-play').style.display === 'none') return;
  var r = BT.cv.getBoundingClientRect();
  if (Math.round(r.width * BT.dpr) !== BT.W || Math.round(r.height * BT.dpr) !== BT.H) btLayout(false);
  btDraw();
}
function btDraw() {
  var ctx = BT.ctx, W = BT.W, H = BT.H, S = BT.S, L = BT.L, now = Date.now();
  /* 나무 도마 */
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#c8955e'); g.addColorStop(1, '#b07d47');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(90,50,20,0.10)'; ctx.lineWidth = 2 * BT.dpr;
  for (var i = 0; i < 14; i++) { ctx.beginPath(); var yy = (i + 0.5) * H / 14; ctx.moveTo(0, yy); ctx.bezierCurveTo(W * 0.3, yy - 8, W * 0.6, yy + 10, W, yy - 4); ctx.stroke(); }
  /* 도시락 통 */
  var bx = BT.box.x, by = BT.box.y, bw = L.b[0] * S, bh = L.b[1] * S, pad = S * 0.32;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; btRound(ctx, bx - pad + 6, by - pad + 8, bw + pad * 2, bh + pad * 2, S * 0.3); ctx.fill();
  ctx.fillStyle = '#b3262e'; btRound(ctx, bx - pad, by - pad, bw + pad * 2, bh + pad * 2, S * 0.3); ctx.fill();
  ctx.fillStyle = '#2a1416'; ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  for (var gx = 0; gx <= L.b[0]; gx++) { ctx.beginPath(); ctx.moveTo(bx + gx * S, by); ctx.lineTo(bx + gx * S, by + bh); ctx.stroke(); }
  for (var gy = 0; gy <= L.b[1]; gy++) { ctx.beginPath(); ctx.moveTo(bx, by + gy * S); ctx.lineTo(bx + bw, by + gy * S); ctx.stroke(); }
  /* 막힌 칸: 장식 */
  L.x.forEach(function (c, k) {
    ctx.fillStyle = '#3d2224'; ctx.fillRect(bx + c[0] * S + 1, by + c[1] * S + 1, S - 2, S - 2);
    ctx.font = Math.round(S * 0.62) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(BT_GARNISH[(c[0] * 3 + c[1] * 5 + k) % BT_GARNISH.length], bx + (c[0] + 0.5) * S, by + (c[1] + 0.55) * S);
  });
  /* 힌트: 정답 배치 윤곽 */
  if (BT.hint > now) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (BT.hint - now) / 600) * 0.9;
    ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 3 * BT.dpr; ctx.setLineDash([8 * BT.dpr, 6 * BT.dpr]);
    L.sol.forEach(function (q) { ctx.strokeRect(bx + q[0] * S + 3, by + q[1] * S + 3, q[2] * S - 6, q[3] * S - 6); });
    ctx.restore();
  }
  /* 조각들 (끌고 있는 건 맨 위에) */
  var order = BT.pieces.slice().sort(function (a, b) { return (a === (BT.drag && BT.drag.p)) - (b === (BT.drag && BT.drag.p)); });
  order.forEach(function (p) { btDrawPiece(ctx, p, btRect(p)); });
  /* 끌고 있을 때: 들어갈 자리 미리보기 */
  if (BT.drag && BT.drag.moved) {
    var d = BT.drag, rr = btRect(d.p);
    var gx2 = Math.round((rr.x - bx) / S), gy2 = Math.round((rr.y - by) / S);
    if (btFits(d.p, gx2, gy2, d.p.w, d.p.h)) {
      ctx.strokeStyle = '#9be08f'; ctx.lineWidth = 3 * BT.dpr;
      ctx.strokeRect(bx + gx2 * S + 2, by + gy2 * S + 2, d.p.w * S - 4, d.p.h * S - 4);
    }
  }
  /* 칼 선 미리보기 */
  if (BT.tool === 'knife' && BT.hover && !BT.drag && !BT.won) {
    var hp = BT.hover.p, hl = BT.hover.line, hr = btRect(hp);
    ctx.save(); ctx.strokeStyle = BT.cuts >= BT.limit ? '#ff5252' : '#ffffff'; ctx.lineWidth = 3 * BT.dpr; ctx.setLineDash([10 * BT.dpr, 7 * BT.dpr]);
    ctx.beginPath();
    if (hl.o === 'v') { ctx.moveTo(hr.x + hl.c * S, hr.y - S * 0.3); ctx.lineTo(hr.x + hl.c * S, hr.y + hr.h + S * 0.3); }
    else { ctx.moveTo(hr.x - S * 0.3, hr.y + hl.c * S); ctx.lineTo(hr.x + hr.w + S * 0.3, hr.y + hl.c * S); }
    ctx.stroke(); ctx.restore();
  }
  /* 싹둑 효과 */
  if (BT.flash && now - BT.flash.at < 300) {
    var f = BT.flash, t = (now - f.at) / 300;
    ctx.save(); ctx.globalAlpha = 1 - t; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * BT.dpr * (1 - t);
    ctx.beginPath();
    if (f.o === 'v') { ctx.moveTo(f.X, f.py - S * 0.5); ctx.lineTo(f.X, f.py + f.ph + S * 0.5); }
    else { ctx.moveTo(f.px - S * 0.5, f.Y); ctx.lineTo(f.px + f.pw + S * 0.5, f.Y); }
    ctx.stroke(); ctx.restore();
  }
}
function btRound(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function btDrawPiece(ctx, p, r) {
  var F = BT_FOODS[p.food], S = BT.S, lift = BT.drag && BT.drag.p === p ? S * 0.12 : 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; btRound(ctx, r.x + 3, r.y + 5 + lift, r.w, r.h, S * 0.14); ctx.fill();
  ctx.translate(0, -lift);
  ctx.fillStyle = F.fill; btRound(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, S * 0.14); ctx.fill();
  ctx.save(); btRound(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, S * 0.14); ctx.clip();
  /* 재료 무늬 */
  if (F.tex === 'rice') {
    ctx.fillStyle = 'rgba(200,190,170,0.55)';
    for (var i = 0; i < p.w * p.h * 9; i++) { var sx = r.x + ((i * 37 + p.id * 13) % 97) / 97 * r.w, sy = r.y + ((i * 59 + p.id * 7) % 89) / 89 * r.h; ctx.beginPath(); ctx.ellipse(sx, sy, S * 0.05, S * 0.025, i, 0, Math.PI * 2); ctx.fill(); }
  } else if (F.tex === 'egg') {
    ctx.strokeStyle = 'rgba(214,150,30,0.45)'; ctx.lineWidth = S * 0.06;
    for (var e = 1; e < p.h * 3; e++) { ctx.beginPath(); ctx.moveTo(r.x, r.y + e * S / 3); ctx.lineTo(r.x + r.w, r.y + e * S / 3 + S * 0.04); ctx.stroke(); }
  } else if (F.tex === 'salmon') {
    ctx.strokeStyle = 'rgba(255,240,225,0.75)'; ctx.lineWidth = S * 0.07;
    for (var s2 = -p.h * 2; s2 < p.w * 2 + 2; s2++) { ctx.beginPath(); ctx.moveTo(r.x + s2 * S * 0.5, r.y); ctx.lineTo(r.x + s2 * S * 0.5 + r.h * 0.6, r.y + r.h); ctx.stroke(); }
  } else if (F.tex === 'jelly') {
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(r.x, r.y, r.w, S * 0.2);
    ctx.fillStyle = 'rgba(60,100,40,0.35)';
    for (var j = 0; j < p.w * p.h * 2; j++) { ctx.beginPath(); ctx.arc(r.x + ((j * 41 + 7) % 83) / 83 * r.w, r.y + ((j * 29 + 3) % 71) / 71 * r.h, S * 0.06, 0, Math.PI * 2); ctx.fill(); }
  } else if (F.tex === 'kimbap') {
    for (var ky = 0; ky < p.h; ky++) for (var kx = 0; kx < p.w; kx++) {
      var cx = r.x + (kx + 0.5) * S, cy = r.y + (ky + 0.5) * S;
      ctx.fillStyle = '#fbf8f1'; ctx.beginPath(); ctx.arc(cx, cy, S * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb300'; ctx.fillRect(cx - S * 0.18, cy - S * 0.06, S * 0.12, S * 0.12);
      ctx.fillStyle = '#e53935'; ctx.fillRect(cx + 0.02 * S, cy - S * 0.14, S * 0.1, S * 0.1);
      ctx.fillStyle = '#43a047'; ctx.fillRect(cx - S * 0.02, cy + S * 0.06, S * 0.14, S * 0.08);
    }
  }
  ctx.restore();
  ctx.strokeStyle = F.edge; ctx.lineWidth = Math.max(2, S * 0.06); btRound(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, S * 0.14); ctx.stroke();
  ctx.restore();
}

/* ---- 조작 ---- */
(function btSetupInput() {
  var cv = document.getElementById('bt-canvas');
  if (!cv) return;
  var pos = function (e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * BT.dpr, (e.clientY - r.top) * BT.dpr]; };
  cv.addEventListener('pointermove', function (e) {
    if (!BT || BT.won) return;
    var p = pos(e);
    if (BT.drag) {
      var d = BT.drag;
      if (Math.abs(p[0] - d.sx) + Math.abs(p[1] - d.sy) > 6 * BT.dpr) d.moved = true;
      if (d.moved) {
        if (d.p.bx != null) { var rr = btRect(d.p); d.p.x = rr.x; d.p.y = rr.y; d.p.bx = d.p.by = null; }
        d.p.x = p[0] - d.ox; d.p.y = p[1] - d.oy;
      }
      return;
    }
    if (BT.tool === 'knife') {
      var pc = btPieceAt(p[0], p[1]);
      var line = pc ? btCutLine(pc, p[0], p[1]) : null;
      BT.hover = line ? { p: pc, line: line } : null;
    }
  });
  cv.addEventListener('pointerleave', function () { if (BT) BT.hover = null; });
  cv.addEventListener('pointerdown', function (e) {
    if (!BT || BT.won) return;
    e.preventDefault();
    var p = pos(e), pc = btPieceAt(p[0], p[1]);
    if (!pc) return;
    if (BT.tool === 'knife') {
      var line = btCutLine(pc, p[0], p[1]);
      if (line) btCut(pc, line);
      else if (pc.bx != null) btToast('도시락 안의 조각은 ✋ 옮기기로 꺼내서 잘라요');
      BT.hover = null;
      return;
    }
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    var r = btRect(pc);
    btPush();
    BT.drag = { p: pc, sx: p[0], sy: p[1], ox: p[0] - r.x, oy: p[1] - r.y, moved: false, wasBox: pc.bx != null ? [pc.bx, pc.by] : null };
    BT.pieces.splice(BT.pieces.indexOf(pc), 1); BT.pieces.push(pc);
  });
  var up = function () {
    if (!BT || !BT.drag) return;
    var d = BT.drag, pc = d.p, S = BT.S;
    BT.drag = null;
    if (!d.moved) {
      /* 톡: 90° 돌리기 */
      if (pc.bx != null) {
        if (btFits(pc, pc.bx, pc.by, pc.h, pc.w)) { var t = pc.w; pc.w = pc.h; pc.h = t; }
        else { var rr = btRect(pc); pc.x = rr.x; pc.y = rr.y; pc.bx = pc.by = null; var t2 = pc.w; pc.w = pc.h; pc.h = t2; }
      } else {
        var cx = pc.x + pc.w * S / 2, cy = pc.y + pc.h * S / 2, t3 = pc.w; pc.w = pc.h; pc.h = t3;
        pc.x = cx - pc.w * S / 2; pc.y = cy - pc.h * S / 2;
      }
      if (typeof mmSound === 'function') mmSound('plop');
      return;
    }
    var gx = Math.round((pc.x - BT.box.x) / S), gy = Math.round((pc.y - BT.box.y) / S);
    if (btFits(pc, gx, gy, pc.w, pc.h)) {
      pc.bx = gx; pc.by = gy;
      if (typeof mmSound === 'function') mmSound('plop');
      btCheckWin();
    } else {
      /* 도마 밖이면 도마 안쪽으로 */
      pc.x = Math.max(BT.board.x + 4, Math.min(BT.board.x + BT.board.w - pc.w * S - 4, pc.x));
      pc.y = Math.max(BT.board.y + 4, Math.min(BT.board.y + BT.board.h - pc.h * S - 4, pc.y));
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  document.addEventListener('keydown', function (e) {
    if (!BT || !document.getElementById('bento').classList.contains('active')) return;
    if (e.key === ' ' || e.key === 'Tab') { e.preventDefault(); btSetTool(BT.tool === 'knife' ? 'hand' : 'knife'); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); btUndo(); }
  });
})();
