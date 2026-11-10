/* ---------------- 도시락 칼질 (혼자 하기 · 잔잔한 퍼즐) ----------------
   도마 위 재료를 칼로 잘라서, 도시락 통의 빈칸을 빈틈없이 꽉 채우면 성공!
   - 재료 위에 올리면 자를 점선이 보여요. 톡 누르면(PC는 우클릭도) 싹둑 (줄 따라 끝까지)
   - 끌면 옮기기. 도시락 안 조각을 톡 누르면 도마로 꺼내요. (돌리기는 없어요)
   - 칼질을 적게 할수록 별이 많아요 (기준 이하 ⭐⭐⭐). 시간 제한은 없어요.
   단계 데이터는 data/bento-levels.js (모두 풀 수 있는 것만 자동으로 만들었어요) */
var BT = null;
var BT_RAF = null;
var BT_FOODS = [
  { n: '흰쌀밥', fill: '#fbfaf6', edge: '#d9d2c4', tex: 'rice' },
  { n: '계란말이', fill: '#ffd95a', edge: '#d9a92c', tex: 'egg' },
  { n: '연어', fill: '#ff9566', edge: '#d46a3f', tex: 'salmon' },
  { n: '녹차 양갱', fill: '#8fc36b', edge: '#5f9446', tex: 'jelly' }
];
var BT_GARNISH = ['🍋', '🌿', '🥢', '🍅', '🥒', '🍙'];

function btSave() { try { localStorage.setItem('gamehub_bento_v2', JSON.stringify(BT_PROG)); } catch (e) {} }
var BT_PROG = (function () { try { return JSON.parse(localStorage.getItem('gamehub_bento_v2') || 'null') || { stars: {} }; } catch (e) { return { stars: {} }; } })();

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
    lv: i, L: L, cuts: 0, limit: L.p + 2, pieces: [], hist: [], drag: null, hover: null, hint: 0, won: false, nid: 1,
    tset: {}, cv: document.getElementById('bt-canvas')
  };
  L.tgt.forEach(function (c) { BT.tset[c[0] + ',' + c[1]] = 1; });
  BT.tw = 1 + Math.max.apply(null, L.tgt.map(function (c) { return c[0]; }));
  BT.th = 1 + Math.max.apply(null, L.tgt.map(function (c) { return c[1]; }));
  BT.ctx = BT.cv.getContext('2d');
  BT.pieces.push(btMakePiece(L.src, L.f, 0, 0));
  document.getElementById('bt-levels').style.display = 'none';
  document.getElementById('bt-play').style.display = '';
  document.getElementById('bt-done').style.display = 'none';
  btLayout(true);
  btHud();
  cancelAnimationFrame(BT_RAF);
  BT_RAF = requestAnimationFrame(btFrame);
}
function btNext() { if (BT && BT.lv + 1 < BENTO_LEVELS.length) btStart(BT.lv + 1); else btShowLevels(); }
function btRestart() { if (BT) btStart(BT.lv); }

/* 조각 = 칸 목록 (왼쪽 위가 0,0이 되게 정리) */
function btMakePiece(cells, food, x, y) {
  var mx = Math.min.apply(null, cells.map(function (c) { return c[0]; }));
  var my = Math.min.apply(null, cells.map(function (c) { return c[1]; }));
  var cs = cells.map(function (c) { return [c[0] - mx, c[1] - my]; });
  var p = { id: BT.nid++, cells: cs, food: food, x: x, y: y, bx: null, by: null, seed: Math.floor(Math.random() * 1000) };
  btDims(p);
  return p;
}
function btDims(p) {
  p.w = 1 + Math.max.apply(null, p.cells.map(function (c) { return c[0]; }));
  p.h = 1 + Math.max.apply(null, p.cells.map(function (c) { return c[1]; }));
  p.has = {}; p.cells.forEach(function (c) { p.has[c[0] + ',' + c[1]] = 1; });
}

/* ---- 화면 배치: 왼쪽 도마 + 오른쪽 도시락 (휴대폰처럼 좁으면 위/아래) ---- */
function btLayout(resetPieces) {
  var cv = BT.cv, r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  var W = cv.width, H = cv.height, L = BT.L;
  var tall = H > W * 0.9;
  var src = BT.pieces.length ? BT.pieces[0] : null;
  var sw = 1 + Math.max.apply(null, L.src.map(function (c) { return c[0]; })), sh = 1 + Math.max.apply(null, L.src.map(function (c) { return c[1]; }));
  var boardCells = Math.max(sw, sh) + 2.6;
  var S = tall ? Math.min(W / (Math.max(BT.tw, boardCells) + 1.6), H / (BT.th + boardCells + 2.6)) : Math.min(W / (boardCells + BT.tw + 2.6), H / (Math.max(BT.th, boardCells) + 1.8));
  S = Math.floor(Math.min(S, 64 * dpr));
  BT.S = S; BT.W = W; BT.H = H; BT.dpr = dpr; BT.tall = tall;
  if (tall) {
    BT.board = { x: 0, y: S * 0.9, w: W, h: H - (BT.th + 1.6) * S - S * 0.9 };
    BT.box = { x: Math.round((W - BT.tw * S) / 2), y: Math.round(H - (BT.th + 0.9) * S) };
  } else {
    BT.board = { x: 0, y: S * 0.9, w: W - (BT.tw + 1.8) * S, h: H - S * 0.9 };
    BT.box = { x: Math.round(W - (BT.tw + 1.0) * S), y: Math.round((H - BT.th * S) / 2 + S * 0.3) };
  }
  if (resetPieces) {
    var p = BT.pieces[0];
    p.x = BT.board.x + (BT.board.w - p.w * S) / 2; p.y = BT.board.y + (BT.board.h - p.h * S) / 2;
  }
}
window.addEventListener('resize', function () { if (BT && document.getElementById('bento').classList.contains('active')) btLayout(false); });

function btSnap() { return JSON.stringify({ p: BT.pieces, c: BT.cuts, n: BT.nid }, function (k, v) { return (k === '_sp' || k === '_sk') ? undefined : v; }); }
function btPush() { BT.hist.push(btSnap()); if (BT.hist.length > 80) BT.hist.shift(); }
function btUndo() {
  if (!BT || !BT.hist.length || BT.won) return;
  var s = JSON.parse(BT.hist.pop());
  BT.pieces = s.p; BT.cuts = s.c; BT.nid = s.n;
  btHud();
}
function btSetTool() {}
function btHint() {
  if (!BT || BT.won) return;
  BT.hint = Date.now() + 3500;
}
function btStars() { return BT.cuts <= BT.L.p ? 3 : (BT.cuts <= BT.L.p + 1 ? 2 : 1); }
function btHud() {
  var left = BT.limit - BT.cuts;
  document.getElementById('bt-lvname').textContent = (BT.lv + 1) + '단계 · ' + BT_FOODS[BT.L.f].n;
  document.getElementById('bt-cuts').innerHTML = '🔪 <b>' + BT.cuts + '</b> / ' + BT.limit + ' <small>(⭐⭐⭐ ' + BT.L.p + '번)</small>';
  document.getElementById('bt-cuts').classList.toggle('warn', left <= 0);
}

/* ---- 조각 위치 ---- */
function btOrigin(p) {
  if (p.bx != null) return { x: BT.box.x + p.bx * BT.S, y: BT.box.y + p.by * BT.S };
  return { x: p.x, y: p.y };
}
function btPieceAt(px, py) {
  for (var i = BT.pieces.length - 1; i >= 0; i--) {
    var p = BT.pieces[i], o = btOrigin(p);
    var cx = Math.floor((px - o.x) / BT.S), cy = Math.floor((py - o.y) / BT.S);
    if (p.has[cx + ',' + cy]) return p;
  }
  return null;
}
/* 자를 선 고르기: 마우스에서 가장 가까운 안쪽 줄 (조각을 끝까지 가로질러요) */
function btCutLine(p, px, py) {
  if (p.bx != null || p.cells.length < 2) return null;
  var o = btOrigin(p), S = BT.S;
  var lx = (px - o.x) / S, ly = (py - o.y) / S;
  var cv = Math.max(1, Math.min(p.w - 1, Math.round(lx))), ch = Math.max(1, Math.min(p.h - 1, Math.round(ly)));
  var dv = p.w > 1 ? Math.abs(lx - cv) : 99, dh = p.h > 1 ? Math.abs(ly - ch) : 99;
  if (dv === 99 && dh === 99) return null;
  return dv <= dh ? { o: 'v', c: cv } : { o: 'h', c: ch };
}
function btComps(cells) {
  var left = {}, out = [];
  cells.forEach(function (c) { left[c[0] + ',' + c[1]] = c; });
  Object.keys(left).forEach(function (k) {
    if (!left[k]) return;
    var st = [left[k]], comp = []; left[k] = null;
    while (st.length) {
      var c = st.pop(); comp.push(c);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nk = (c[0] + d[0]) + ',' + (c[1] + d[1]);
        if (left[nk]) { st.push(left[nk]); left[nk] = null; }
      });
    }
    out.push(comp);
  });
  return out;
}
function btCut(p, line) {
  if (BT.cuts >= BT.limit) { btToast('칼질을 다 썼어요! ↩ 되돌리기나 🔄 처음부터'); return; }
  btPush();
  var S = BT.S, gap = S * 0.22, o = btOrigin(p);
  var ax = line.o === 'v' ? 0 : 1;
  var sideA = p.cells.filter(function (c) { return c[ax] < line.c; }), sideB = p.cells.filter(function (c) { return c[ax] >= line.c; });
  var made = [];
  [[sideA, -1], [sideB, 1]].forEach(function (pair) {
    btComps(pair[0]).forEach(function (comp) {
      var mx = Math.min.apply(null, comp.map(function (c) { return c[0]; })), my = Math.min.apply(null, comp.map(function (c) { return c[1]; }));
      var np = btMakePiece(comp, p.food, o.x + mx * S + (ax === 0 ? pair[1] * gap / 2 : 0), o.y + my * S + (ax === 1 ? pair[1] * gap / 2 : 0));
      np.seed = p.seed;
      made.push(np);
    });
  });
  var i = BT.pieces.indexOf(p);
  BT.pieces.splice.apply(BT.pieces, [i, 1].concat(made));
  BT.cuts++;
  BT.flash = { at: Date.now(), o: line.o, X: o.x + line.c * S, Y: o.y + line.c * S, px: o.x, py: o.y, pw: p.w * S, ph: p.h * S };
  if (typeof mmSound === 'function') mmSound('mash');
  btHud();
}
/* 도시락에 들어갈 수 있는지 */
function btFits(p, gx, gy) {
  var occ = {};
  BT.pieces.forEach(function (q) { if (q !== p && q.bx != null) q.cells.forEach(function (c) { occ[(c[0] + q.bx) + ',' + (c[1] + q.by)] = 1; }); });
  return p.cells.every(function (c) { var k = (c[0] + gx) + ',' + (c[1] + gy); return BT.tset[k] && !occ[k]; });
}
function btCheckWin() {
  var L = BT.L, got = 0;
  BT.pieces.forEach(function (p) { if (p.bx != null) got += p.cells.length; });
  var onBoard = BT.pieces.some(function (p) { return p.bx == null; });
  if (got >= L.tgt.length && !onBoard) {
    BT.won = true;
    var st = btStars();
    var oldSt = BT_PROG.stars[BT.lv] || 0;
    if (st > oldSt) { BT_PROG.stars[BT.lv] = st; btSave(); typeof soloCoin === 'function' && soloCoin((st - oldSt) * 5, '별 ' + (st - oldSt) + '개!'); }
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
/* 모서리마다 따로 둥글게 [왼위, 오위, 오아래, 왼아래] */
function btRoundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r[0], y);
  ctx.lineTo(x + w - r[1], y); if (r[1]) ctx.arcTo(x + w, y, x + w, y + r[1], r[1]);
  ctx.lineTo(x + w, y + h - r[2]); if (r[2]) ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
  ctx.lineTo(x + r[3], y + h); if (r[3]) ctx.arcTo(x, y + h, x, y + h - r[3], r[3]);
  ctx.lineTo(x, y + r[0]); if (r[0]) ctx.arcTo(x, y, x + r[0], y, r[0]);
  ctx.closePath();
}
/* 칸 모양을 하나로 이어진 덩어리로 그려요 (바깥쪽만 m만큼 들어가고, 바깥 모서리는 둥글게) */
function btShapePath(ctx, cells, has, ox, oy, S, m, rad) {
  ctx.beginPath();
  cells.forEach(function (c) {
    var x = c[0], y = c[1];
    var L = !has[(x - 1) + ',' + y], R = !has[(x + 1) + ',' + y], U = !has[x + ',' + (y - 1)], D = !has[x + ',' + (y + 1)];
    var x0 = ox + x * S + (L ? m : -0.5), y0 = oy + y * S + (U ? m : -0.5);
    var x1 = ox + (x + 1) * S - (R ? m : -0.5), y1 = oy + (y + 1) * S - (D ? m : -0.5);
    btRoundRect(ctx, x0, y0, x1 - x0, y1 - y0, [U && L ? rad : 0, U && R ? rad : 0, D && R ? rad : 0, D && L ? rad : 0]);
  });
}
function btDraw() {
  var ctx = BT.ctx, W = BT.W, H = BT.H, S = BT.S, L = BT.L, now = Date.now(), dpr = BT.dpr;
  /* 나무 도마 */
  var g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#d3a46c'); g.addColorStop(1, '#bb8a52');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(110,60,25,0.12)'; ctx.lineWidth = 2 * dpr;
  for (var i = 0; i < 16; i++) { ctx.beginPath(); var yy = (i + 0.5) * H / 16; ctx.moveTo(0, yy); ctx.bezierCurveTo(W * 0.3, yy - 10, W * 0.6, yy + 12, W, yy - 5); ctx.stroke(); }
  /* 김발(대나무 발) */
  var bx = BT.box.x, by = BT.box.y, pad = S * 0.75;
  var mx0 = bx - pad, my0 = by - pad, mw = BT.tw * S + pad * 2, mh = BT.th * S + pad * 2;
  ctx.save();
  ctx.translate(mx0 + mw / 2, my0 + mh / 2); ctx.rotate(-0.03); ctx.translate(-(mx0 + mw / 2), -(my0 + mh / 2));
  ctx.fillStyle = 'rgba(60,30,10,0.25)'; ctx.fillRect(mx0 + 5 * dpr, my0 + 8 * dpr, mw, mh);
  ctx.fillStyle = '#c99a5c'; ctx.fillRect(mx0, my0, mw, mh);
  var slat = Math.max(4 * dpr, S * 0.16);
  for (var sx = mx0; sx < mx0 + mw; sx += slat) {
    ctx.fillStyle = 'rgba(120,70,25,0.35)'; ctx.fillRect(sx, my0, 1.4 * dpr, mh);
    ctx.fillStyle = 'rgba(255,230,180,0.25)'; ctx.fillRect(sx + 2 * dpr, my0, 1.2 * dpr, mh);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6 * dpr;
  var nstr = Math.max(3, Math.round(mh / (S * 1.3)));
  for (var k = 0; k < nstr; k++) { var sy = my0 + (k + 0.5) * mh / nstr; ctx.beginPath(); ctx.moveTo(mx0 - 6 * dpr, sy); ctx.lineTo(mx0 + mw + 6 * dpr, sy); ctx.stroke(); }
  ctx.restore();
  /* 도시락 자리 (빨간 칸) */
  var thas = BT.tset;
  var bw2 = S * 0.12;
  ctx.fillStyle = '#7a2a24'; L.tgt.forEach(function (c) { ctx.fillRect(bx + c[0] * S - bw2, by + c[1] * S - bw2, S + bw2 * 2, S + bw2 * 2); });
  ctx.fillStyle = '#c93d42'; L.tgt.forEach(function (c) { ctx.fillRect(bx + c[0] * S - 0.5, by + c[1] * S - 0.5, S + 1, S + 1); });
  L.tgt.forEach(function (c) {
    ctx.fillStyle = '#e8605f'; btRoundRect(ctx, bx + c[0] * S + S * 0.08, by + c[1] * S + S * 0.08, S * 0.84, S * 0.84, [S * 0.08, S * 0.08, S * 0.08, S * 0.08]);
    ctx.beginPath(); btRoundRect(ctx, bx + c[0] * S + S * 0.08, by + c[1] * S + S * 0.08, S * 0.84, S * 0.84, [S * 0.08, S * 0.08, S * 0.08, S * 0.08]); ctx.fill();
  });
  /* 힌트: 정답 조각 윤곽 */
  if (BT.hint > now) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (BT.hint - now) / 600);
    ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 3 * dpr; ctx.setLineDash([7 * dpr, 5 * dpr]);
    L.sol.forEach(function (q) {
      var has = {}; q[0].forEach(function (c) { has[(c[0] + q[1][0]) + ',' + (c[1] + q[1][1])] = 1; });
      q[0].forEach(function (c) {
        var x = c[0] + q[1][0], y = c[1] + q[1][1], X = bx + x * S, Y = by + y * S, e = 4 * dpr;
        ctx.beginPath();
        if (!has[x + ',' + (y - 1)]) { ctx.moveTo(X + e, Y + e); ctx.lineTo(X + S - e, Y + e); }
        if (!has[x + ',' + (y + 1)]) { ctx.moveTo(X + e, Y + S - e); ctx.lineTo(X + S - e, Y + S - e); }
        if (!has[(x - 1) + ',' + y]) { ctx.moveTo(X + e, Y + e); ctx.lineTo(X + e, Y + S - e); }
        if (!has[(x + 1) + ',' + y]) { ctx.moveTo(X + S - e, Y + e); ctx.lineTo(X + S - e, Y + S - e); }
        ctx.stroke();
      });
    });
    ctx.restore();
  }
  /* 조각들 (끌고 있는 건 맨 위에) */
  var dp = BT.drag && BT.drag.p;
  BT.pieces.forEach(function (p) { if (p !== dp) btDrawPiece(ctx, p); });
  /* 끌고 있을 때: 들어갈 자리 미리보기 */
  if (BT.drag && BT.drag.moved) {
    var o2 = btOrigin(dp);
    var gx2 = Math.round((o2.x - bx) / S), gy2 = Math.round((o2.y - by) / S);
    if (btFits(dp, gx2, gy2)) {
      ctx.save(); ctx.globalAlpha = 0.4; ctx.drawImage(btSprite(dp), bx + gx2 * S - dp._pad, by + gy2 * S - dp._pad); ctx.restore();
    }
  }
  if (dp) btDrawPiece(ctx, dp);
  /* 칼 선 미리보기 (점선) */
  if (BT.hover && !BT.drag && !BT.won) {
    var hp = BT.hover.p, hl = BT.hover.line, ho = btOrigin(hp);
    ctx.save(); ctx.strokeStyle = BT.cuts >= BT.limit ? '#ff5252' : '#ffffff'; ctx.lineWidth = 3 * dpr; ctx.setLineDash([3 * dpr, 6 * dpr]); ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 3 * dpr;
    ctx.beginPath();
    if (hl.o === 'v') { ctx.moveTo(ho.x + hl.c * S, ho.y - S * 0.35); ctx.lineTo(ho.x + hl.c * S, ho.y + hp.h * S + S * 0.35); }
    else { ctx.moveTo(ho.x - S * 0.35, ho.y + hl.c * S); ctx.lineTo(ho.x + hp.w * S + S * 0.35, ho.y + hl.c * S); }
    ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = '#fff';
    var ends = hl.o === 'v' ? [[ho.x + hl.c * S, ho.y - S * 0.35], [ho.x + hl.c * S, ho.y + hp.h * S + S * 0.35]] : [[ho.x - S * 0.35, ho.y + hl.c * S], [ho.x + hp.w * S + S * 0.35, ho.y + hl.c * S]];
    ends.forEach(function (e) { ctx.beginPath(); ctx.arc(e[0], e[1], 4 * dpr, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }
  /* 싹둑 효과 */
  if (BT.flash && now - BT.flash.at < 300) {
    var f = BT.flash, t = (now - f.at) / 300;
    ctx.save(); ctx.globalAlpha = 1 - t; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * dpr * (1 - t);
    ctx.beginPath();
    if (f.o === 'v') { ctx.moveTo(f.X, f.py - S * 0.5); ctx.lineTo(f.X, f.py + f.ph + S * 0.5); }
    else { ctx.moveTo(f.px - S * 0.5, f.Y); ctx.lineTo(f.px + f.pw + S * 0.5, f.Y); }
    ctx.stroke(); ctx.restore();
  }
  /* 위쪽 가운데: 별 3개 (칼질이 늘면 하나씩 비어요) */
  var st = BT.won ? btStars() : (BT.cuts <= L.p ? 3 : (BT.cuts <= L.p + 1 ? 2 : 1));
  var R = Math.max(11 * dpr, S * 0.26), cx0 = W / 2 - R * 2.5;
  for (var si = 0; si < 3; si++) {
    var cx = cx0 + si * R * 2.5, cy = R + 10 * dpr;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    if (si < st) { ctx.fillStyle = '#f6c945'; ctx.fill(); ctx.strokeStyle = '#8a5a1c'; ctx.lineWidth = 2 * dpr; ctx.stroke(); btStar(ctx, cx, cy, R * 0.62, '#fff3b0', '#8a5a1c'); }
    else { ctx.setLineDash([4 * dpr, 3 * dpr]); ctx.strokeStyle = 'rgba(110,60,25,0.7)'; ctx.lineWidth = 2 * dpr; ctx.stroke(); ctx.setLineDash([]); }
  }
}
function btStar(ctx, cx, cy, r, fill, edge) {
  ctx.beginPath();
  for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.2 * BT.dpr; ctx.stroke();
}
function btRand(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }
/* 조각 모양을 한 덩어리로 칠한 캔버스: 칸을 꽉 채운 뒤, 바깥 테두리를 inset만큼 지우고, 바깥 모서리를 둥글게 깎아요 */
function btShapeCanvas(cells, has, S, w, h, pad, inset, rad, color) {
  var c = document.createElement('canvas');
  c.width = Math.ceil(w * S + pad * 2); c.height = Math.ceil(h * S + pad * 2);
  var x = c.getContext('2d');
  x.fillStyle = color;
  cells.forEach(function (cl) { x.fillRect(pad + cl[0] * S - 0.5, pad + cl[1] * S - 0.5, S + 1, S + 1); });
  x.globalCompositeOperation = 'destination-out';
  /* 바깥 경계선 따라 지우기 */
  x.lineWidth = inset * 2; x.lineCap = 'square'; x.strokeStyle = '#000';
  x.beginPath();
  cells.forEach(function (cl) {
    var X = pad + cl[0] * S, Y = pad + cl[1] * S, i = cl[0], j = cl[1];
    if (!has[i + ',' + (j - 1)]) { x.moveTo(X, Y); x.lineTo(X + S, Y); }
    if (!has[i + ',' + (j + 1)]) { x.moveTo(X, Y + S); x.lineTo(X + S, Y + S); }
    if (!has[(i - 1) + ',' + j]) { x.moveTo(X, Y); x.lineTo(X, Y + S); }
    if (!has[(i + 1) + ',' + j]) { x.moveTo(X + S, Y); x.lineTo(X + S, Y + S); }
  });
  x.stroke();
  /* 바깥(볼록) 모서리 둥글게 */
  x.beginPath();
  cells.forEach(function (cl) {
    var i = cl[0], j = cl[1], X = pad + i * S, Y = pad + j * S;
    var U = !has[i + ',' + (j - 1)], D = !has[i + ',' + (j + 1)], L = !has[(i - 1) + ',' + j], R = !has[(i + 1) + ',' + j];
    [[U && L, X + inset, Y + inset, 1, 1], [U && R, X + S - inset, Y + inset, -1, 1], [D && R, X + S - inset, Y + S - inset, -1, -1], [D && L, X + inset, Y + S - inset, 1, -1]].forEach(function (k) {
      if (!k[0]) return;
      var cx = k[1], cy = k[2], sx = k[3], sy = k[4];
      x.moveTo(cx, cy); x.lineTo(cx + sx * rad, cy); x.arcTo(cx, cy, cx, cy + sy * rad, rad); x.lineTo(cx, cy); x.closePath();
    });
  });
  x.fill();
  x.globalCompositeOperation = 'source-over';
  return c;
}
function btSprite(p) {
  var S = BT.S, key = S + ':' + p.food + ':' + p.seed + ':' + JSON.stringify(p.cells);
  if (p._sk === key && p._sp) return p._sp;
  var F = BT_FOODS[p.food], pad = Math.ceil(S * 0.1);
  var edge = btShapeCanvas(p.cells, p.has, S, p.w, p.h, pad, S * 0.05, S * 0.26, F.edge);
  var fill = btShapeCanvas(p.cells, p.has, S, p.w, p.h, pad, S * 0.095, S * 0.22, F.fill);
  var x = fill.getContext('2d');
  x.globalCompositeOperation = 'source-atop';
  p.cells.forEach(function (c) {
    var X = pad + c[0] * S, Y = pad + c[1] * S, seed = p.seed * 7 + (c[0] + 11) * 31 + (c[1] + 7) * 57;
    if (F.tex === 'rice') {
      for (var i = 0; i < 18; i++) {
        var gx = X + btRand(seed + i) * S, gy = Y + btRand(seed + i + 50) * S;
        x.fillStyle = i % 3 ? 'rgba(200,190,170,0.5)' : 'rgba(255,255,255,1)';
        x.beginPath(); x.ellipse(gx, gy, S * 0.075, S * 0.033, btRand(seed + i + 99) * 3.14, 0, Math.PI * 2); x.fill();
      }
    } else if (F.tex === 'egg') {
      x.strokeStyle = 'rgba(214,150,30,0.45)'; x.lineWidth = S * 0.06;
      for (var e = 1; e < 3; e++) { x.beginPath(); x.moveTo(X, Y + e * S / 3); x.lineTo(X + S, Y + e * S / 3 + S * 0.03); x.stroke(); }
    } else if (F.tex === 'salmon') {
      x.strokeStyle = 'rgba(255,240,225,0.75)'; x.lineWidth = S * 0.07;
      for (var s2 = -1; s2 < 3; s2++) { x.beginPath(); x.moveTo(X + s2 * S * 0.5, Y); x.lineTo(X + s2 * S * 0.5 + S * 0.6, Y + S); x.stroke(); }
    } else if (F.tex === 'jelly') {
      x.fillStyle = 'rgba(60,100,40,0.3)';
      for (var j = 0; j < 3; j++) { x.beginPath(); x.arc(X + btRand(seed + j) * S, Y + btRand(seed + j + 9) * S, S * 0.06, 0, Math.PI * 2); x.fill(); }
    }
  });
  var hg = x.createLinearGradient(0, 0, 0, fill.height);
  hg.addColorStop(0, 'rgba(255,255,255,0.16)'); hg.addColorStop(1, 'rgba(0,0,0,0.07)');
  x.fillStyle = hg; x.fillRect(0, 0, fill.width, fill.height);
  var ex = edge.getContext('2d'); ex.drawImage(fill, 0, 0);
  p._sk = key; p._sp = edge; p._pad = pad;
  return edge;
}
function btDrawPiece(ctx, p) {
  var S = BT.S, o = btOrigin(p), lift = BT.drag && BT.drag.p === p ? S * 0.12 : 0;
  var sp = btSprite(p), pad = p._pad;
  ctx.save();
  ctx.shadowColor = 'rgba(70,35,10,0.35)'; ctx.shadowOffsetX = 3 * BT.dpr; ctx.shadowOffsetY = 5 * BT.dpr + lift; ctx.shadowBlur = 4 * BT.dpr + lift * 0.6;
  ctx.drawImage(sp, o.x - pad, o.y - pad - lift);
  ctx.restore();
}

/* ---- 조작: 끌면 옮기기 · 톡 누르면(우클릭) 자르기 ---- */
(function btSetupInput() {
  var cv = document.getElementById('bt-canvas');
  if (!cv) return;
  var pos = function (e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * BT.dpr, (e.clientY - r.top) * BT.dpr]; };
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  cv.addEventListener('pointermove', function (e) {
    if (!BT || BT.won) return;
    var p = pos(e);
    if (BT.drag) {
      var d = BT.drag;
      if (Math.abs(p[0] - d.sx) + Math.abs(p[1] - d.sy) > 8 * BT.dpr) d.moved = true;
      if (d.moved) {
        if (d.p.bx != null) { var oo = btOrigin(d.p); d.p.x = oo.x; d.p.y = oo.y; d.p.bx = d.p.by = null; }
        d.p.x = p[0] - d.ox; d.p.y = p[1] - d.oy;
      }
      return;
    }
    var pc = btPieceAt(p[0], p[1]);
    var line = pc ? btCutLine(pc, p[0], p[1]) : null;
    BT.hover = line ? { p: pc, line: line } : null;
  });
  cv.addEventListener('pointerleave', function () { if (BT) BT.hover = null; });
  cv.addEventListener('pointerdown', function (e) {
    if (!BT || BT.won) return;
    e.preventDefault();
    var p = pos(e), pc = btPieceAt(p[0], p[1]);
    if (!pc) return;
    if (e.button === 2) {   /* 우클릭: 바로 자르기 */
      var ln = btCutLine(pc, p[0], p[1]);
      if (ln) btCut(pc, ln); else if (pc.bx != null) btToast('도시락 안의 조각은 꺼내서 잘라요');
      BT.hover = null;
      return;
    }
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    var o = btOrigin(pc);
    BT.drag = { p: pc, sx: p[0], sy: p[1], ox: p[0] - o.x, oy: p[1] - o.y, moved: false, snap: btSnap() };
    BT.pieces.splice(BT.pieces.indexOf(pc), 1); BT.pieces.push(pc);
  });
  var up = function (e) {
    if (!BT || !BT.drag) return;
    var d = BT.drag, pc = d.p, S = BT.S;
    BT.drag = null;
    if (!d.moved) {
      if (pc.bx != null) {
        /* 도시락 안 조각을 톡: 도마로 꺼내요 */
        BT.hist.push(d.snap);
        var oo = btOrigin(pc); pc.bx = pc.by = null;
        pc.x = BT.board.x + (BT.board.w - pc.w * S) / 2; pc.y = BT.board.y + (BT.board.h - pc.h * S) / 2;
        if (typeof mmSound === 'function') mmSound('plop');
        return;
      }
      /* 톡: 점선 따라 자르기 */
      var p = pos(e), ln = btCutLine(pc, p[0], p[1]);
      if (ln) btCut(pc, ln);
      BT.hover = null;
      return;
    }
    BT.hist.push(d.snap); if (BT.hist.length > 80) BT.hist.shift();
    var gx = Math.round((pc.x - BT.box.x) / S), gy = Math.round((pc.y - BT.box.y) / S);
    if (btFits(pc, gx, gy)) {
      pc.bx = gx; pc.by = gy;
      if (typeof mmSound === 'function') mmSound('plop');
      btCheckWin();
    } else {
      pc.x = Math.max(4, Math.min(BT.W - pc.w * S - 4, pc.x));
      pc.y = Math.max(4, Math.min(BT.H - pc.h * S - 4, pc.y));
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', function () { if (BT && BT.drag) { BT.drag = null; } });
  document.addEventListener('keydown', function (e) {
    if (!BT || !document.getElementById('bento').classList.contains('active')) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); btUndo(); }
  });
})();
